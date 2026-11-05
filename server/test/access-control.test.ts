import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "../src/index.ts";
import { TursoAdapter } from "../src/storage/db/turso.ts";
import { hashPassword } from "../src/security/password.ts";

type Harness = {
  directory: string;
  adapter: TursoAdapter;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  postJson: (path: string, body: unknown) => Promise<Response>;
};

let ipCounter = 0;
const FAST_ITERATIONS = 10_000;

async function createHarness(): Promise<Harness> {
  const directory = await mkdtemp(join(tmpdir(), "monolith-access-"));
  const databaseUrl = `file:${join(directory, "test.db")}`;
  const adapter = new TursoAdapter(databaseUrl);
  await adapter.ensureCoreTables();

  const env = {
    DB_PROVIDER: "turso",
    TURSO_URL: databaseUrl,
    JWT_SECRET: "test-access-secret",
    SITE_ORIGIN: "https://test.monolith.local",
    BUCKET: {},
  };
  const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {} };
  const request = (path: string, init?: RequestInit) =>
    app.request(path, init, env as never, executionCtx as never);
  const postJson = (path: string, body: unknown) =>
    request(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": `198.51.100.${++ipCounter % 250}`,
      },
      body: JSON.stringify(body),
    });

  return { directory, adapter, request, postJson };
}

async function disposeHarness(harness: Harness): Promise<void> {
  await rm(harness.directory, { recursive: true, force: true });
}

test("per-post password blocks content and public aggregates, then unlocks", async () => {
  const h = await createHarness();
  try {
    const passwordHash = await hashPassword("post-pass", FAST_ITERATIONS);
    await h.adapter.createPost({
      slug: "locked-post",
      title: "Locked Title",
      content: "SECRET BODY",
      published: true,
      listed: true,
      passwordHash,
      tags: ["private-tag"],
      category: "private-cat",
    });

    const locked = await h.request("/api/posts/locked-post");
    assert.equal(locked.status, 401);
    const lockedBody = await locked.text();
    assert.equal(lockedBody.includes("SECRET BODY"), false);
    assert.equal(JSON.parse(lockedBody).code, "post_locked");

    const list = await (await h.request("/api/posts")).json();
    assert.equal(list.some((post: { slug: string }) => post.slug === "locked-post"), false);

    const search = await (await h.request("/api/search?q=Locked")).json();
    assert.equal(search.length, 0);

    for (const path of ["/rss.xml", "/sitemap.xml", "/llms.txt"]) {
      const body = await (await h.request(path)).text();
      assert.equal(body.includes("locked-post"), false, `${path} leaked locked post`);
    }

    assert.equal((await h.request("/posts/locked-post.md")).status, 401);
    assert.equal((await h.request("/api/posts/locked-post/comments")).status, 401);
    assert.equal((await h.request("/api/posts/locked-post/reactions")).status, 401);
    assert.equal((await h.request("/cdn/backups/backup.json")).status, 404);

    const wrong = await h.postJson("/api/posts/locked-post/unlock", { password: "wrong" });
    assert.equal(wrong.status, 401);

    const unlock = await h.postJson("/api/posts/locked-post/unlock", { password: "post-pass" });
    assert.equal(unlock.status, 200);
    assert.equal((await unlock.json()).fullyUnlocked, true);
    const cookie = (unlock.headers.get("set-cookie") || "").split(";")[0];
    assert.ok(cookie.startsWith("monolith_unlock="));

    const unlocked = await h.request("/api/posts/locked-post", { headers: { Cookie: cookie } });
    assert.equal(unlocked.status, 200);
    assert.match(await unlocked.text(), /SECRET BODY/);
  } finally {
    await disposeHarness(h);
  }
});

test("tag group lock applies to posts and hides the tag from public lists", async () => {
  const h = await createHarness();
  try {
    await h.adapter.createPost({
      slug: "tagged",
      title: "Tagged",
      content: "GROUP SECRET",
      published: true,
      listed: true,
      tags: ["group-tag"],
    });
    await h.adapter.setContentLock("tag", "group-tag", await hashPassword("tag-pass", FAST_ITERATIONS));

    const locked = await h.request("/api/posts/tagged");
    assert.equal(locked.status, 401);
    const body = await locked.json();
    assert.equal(body.locks.length, 1);
    assert.equal(body.locks[0].kind, "tag");

    const tags = await (await h.request("/api/tags")).json();
    assert.equal(tags.some((tag: { name: string }) => tag.name === "group-tag"), false);

    const unlock = await h.postJson("/api/posts/tagged/unlock", { password: "tag-pass" });
    assert.equal(unlock.status, 200);
    const cookie = (unlock.headers.get("set-cookie") || "").split(";")[0];
    const unlocked = await h.request("/api/posts/tagged", { headers: { Cookie: cookie } });
    assert.equal(unlocked.status, 200);
    assert.match(await unlocked.text(), /GROUP SECRET/);
  } finally {
    await disposeHarness(h);
  }
});

test("series lock gates the series list and grants access to member posts", async () => {
  const h = await createHarness();
  try {
    await h.adapter.createPost({
      slug: "series-a",
      title: "Series A",
      content: "SERIES SECRET",
      published: true,
      listed: true,
      seriesSlug: "locked-series",
      seriesOrder: 1,
    });
    await h.adapter.setContentLock("series", "locked-series", await hashPassword("series-pass", FAST_ITERATIONS));

    const locked = await h.request("/api/series/locked-series");
    assert.equal(locked.status, 401);
    assert.equal((await locked.json()).code, "series_locked");

    const unlock = await h.postJson("/api/series/locked-series/unlock", { password: "series-pass" });
    assert.equal(unlock.status, 200);
    const cookie = (unlock.headers.get("set-cookie") || "").split(";")[0];

    const list = await h.request("/api/series/locked-series", { headers: { Cookie: cookie } });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).length, 1);

    const post = await h.request("/api/posts/series-a", { headers: { Cookie: cookie } });
    assert.equal(post.status, 200);
    assert.match(await post.text(), /SERIES SECRET/);
  } finally {
    await disposeHarness(h);
  }
});
