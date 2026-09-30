import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sign } from "hono/jwt";
import { app } from "../src/index.ts";
import { TursoAdapter } from "../src/storage/db/turso.ts";

type ResendCall = { to: string[]; subject: string };

type Harness = {
  directory: string;
  adapter: TursoAdapter;
  jwtSecret: string;
  resendCalls: ResendCall[];
  postJson: (path: string, body: unknown, headers?: Record<string, string>) => Promise<Response>;
  getJson: (path: string) => Promise<Response>;
};

let visitorIpCounter = 0;

async function createHarness(): Promise<Harness> {
  const directory = await mkdtemp(join(tmpdir(), "monolith-comment-routes-"));
  const databaseUrl = `file:${join(directory, "test.db")}`;
  const adapter = new TursoAdapter(databaseUrl);
  await adapter.ensureCoreTables();

  const resendCalls: ResendCall[] = [];
  vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
    if (String(input).includes("api.resend.com")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as ResendCall;
      resendCalls.push(body);
      return new Response("{}", { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });

  const jwtSecret = "test-comment-secret";
  const env = {
    DB_PROVIDER: "turso",
    TURSO_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    SITE_ORIGIN: "https://test.monolith.local",
    RESEND_API_KEY: "test-key",
    RESEND_FROM: "noreply@monolith.local",
    // 评论路由不触对象存储，BUCKET 仅为满足中间件初始化
    BUCKET: {},
    // ADMIN_EMAIL 故意不设置：待审通知邮件静默跳过，只统计回复通知
  };
  const executionCtx = { waitUntil: () => {}, passThroughOnException: () => {} };

  const request = (path: string, init?: RequestInit) => app.request(path, init, env as never, executionCtx as never);
  const postJson = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": `198.51.100.${++visitorIpCounter % 250}`, ...headers },
      body: JSON.stringify(body),
    });
  const getJson = (path: string) => request(path);

  return { directory, adapter, jwtSecret, resendCalls, postJson, getJson };
}

async function disposeHarness(harness: Harness): Promise<void> {
  vi.unstubAllGlobals();
  await rm(harness.directory, { recursive: true, force: true });
}

afterEach(async () => {
  vi.unstubAllGlobals();
});

test("visitor submissions stay pending even when forging is_admin in the body", async () => {
  const h = await createHarness();
  try {
    await h.adapter.createPost({ slug: "forgery", title: "Forgery", content: "Body", published: true });

    const plain = await h.postJson("/api/posts/forgery/comments", { authorName: "Guest", content: "Hello", isAdmin: true });
    assert.equal(plain.status, 200);
    assert.match((await plain.json()).message, /等待审核/);

    const list = await (await h.getJson("/api/posts/forgery/comments")).json();
    assert.equal(list.length, 0);
  } finally {
    await disposeHarness(h);
  }
});

test("invalid or wrongly-signed bearer tokens fall back to the visitor flow", async () => {
  const h = await createHarness();
  try {
    await h.adapter.createPost({ slug: "tokens", title: "Tokens", content: "Body", published: true });
    const forged = await sign({ sub: "admin", exp: Math.floor(Date.now() / 1000) + 3600 }, "wrong-secret");

    const garbage = await h.postJson("/api/posts/tokens/comments", { authorName: "A", content: "x" }, { Authorization: "Bearer not-a-jwt" });
    assert.match((await garbage.json()).message, /等待审核/);

    const wrongKey = await h.postJson("/api/posts/tokens/comments", { authorName: "B", content: "y" }, { Authorization: `Bearer ${forged}` });
    assert.match((await wrongKey.json()).message, /等待审核/);

    const list = await (await h.getJson("/api/posts/tokens/comments")).json();
    assert.equal(list.length, 0);
  } finally {
    await disposeHarness(h);
  }
});

test("a valid admin token publishes instantly with isAdmin badge and no email leak", async () => {
  const h = await createHarness();
  try {
    await h.adapter.createPost({ slug: "official", title: "Official", content: "Body", published: true });
    const token = await sign({ sub: "admin", exp: Math.floor(Date.now() / 1000) + 3600 }, h.jwtSecret);

    const res = await h.postJson("/api/posts/official/comments", { content: "官方说明" }, { Authorization: `Bearer ${token}` });
    const payload = await res.json();
    assert.equal(res.status, 200);
    assert.equal(payload.comment.approved, true);
    assert.equal(payload.comment.isAdmin, true);
    assert.equal(payload.comment.parentId, null);

    const list = await (await h.getJson("/api/posts/official/comments")).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].isAdmin, true);
    assert.equal(list[0].parentId, null);
    assert.equal(list[0].authorEmail, undefined, "公开列表不得返回邮箱");
  } finally {
    await disposeHarness(h);
  }
});

test("admin replying from the front end notifies the parent author exactly once", async () => {
  const h = await createHarness();
  try {
    await h.adapter.createPost({ slug: "notify", title: "Notify", content: "Body", published: true });
    const parent = await h.adapter.addComment({
      postSlug: "notify",
      authorName: "Reader",
      authorEmail: "reader@example.com",
      content: "Question",
    });
    await h.adapter.approveComment(parent.id);
    const token = await sign({ sub: "admin", exp: Math.floor(Date.now() / 1000) + 3600 }, h.jwtSecret);

    const res = await h.postJson("/api/posts/notify/comments", { content: "官方回复", parentId: parent.id }, { Authorization: `Bearer ${token}` });
    const payload = await res.json();
    assert.equal(payload.comment.parentId, parent.id);
    assert.equal(payload.comment.approved, true);

    assert.equal(h.resendCalls.length, 1);
    assert.equal(h.resendCalls[0].to[0], "reader@example.com");
    assert.ok(h.resendCalls[0].subject.includes("收到了回复"));
  } finally {
    await disposeHarness(h);
  }
});

test("approving a pending reply twice sends exactly one notification", async () => {
  const h = await createHarness();
  try {
    await h.adapter.createPost({ slug: "approve", title: "Approve", content: "Body", published: true });
    const parent = await h.adapter.addComment({
      postSlug: "approve",
      authorName: "Parent",
      authorEmail: "parent@example.com",
      content: "Parent",
    });
    await h.adapter.approveComment(parent.id);
    const reply = await h.adapter.addComment({
      postSlug: "approve",
      authorName: "Child",
      authorEmail: "child@example.com",
      content: "Child",
      parentId: parent.id,
    });
    const token = await sign({ sub: "admin", exp: Math.floor(Date.now() / 1000) + 3600 }, h.jwtSecret);

    const first = await h.postJson(`/api/admin/comments/${reply.id}/approve`, {}, { Authorization: `Bearer ${token}` });
    assert.equal(first.status, 200);
    const second = await h.postJson(`/api/admin/comments/${reply.id}/approve`, {}, { Authorization: `Bearer ${token}` });
    assert.equal(second.status, 200);

    assert.equal(h.resendCalls.length, 1);
    assert.equal(h.resendCalls[0].to[0], "parent@example.com");
  } finally {
    await disposeHarness(h);
  }
});

test("admin reply route rejects bad authorName and content types with 400", async () => {
  const h = await createHarness();
  try {
    await h.adapter.createPost({ slug: "validation", title: "Validation", content: "Body", published: true });
    const token = await sign({ sub: "admin", exp: Math.floor(Date.now() / 1000) + 3600 }, h.jwtSecret);
    const headers = { Authorization: `Bearer ${token}` };

    const badType = await h.postJson("/api/admin/comments/999/replies", { authorName: 42, content: "hi" }, headers);
    assert.equal(badType.status, 400);
    assert.equal((await badType.json()).error, "回复昵称必须为字符串");

    const tooLong = await h.postJson("/api/admin/comments/999/replies", { authorName: "a".repeat(51), content: "hi" }, headers);
    assert.equal(tooLong.status, 400);
    assert.equal((await tooLong.json()).error, "回复昵称不能超过 50 字");

    const badContent = await h.postJson("/api/admin/comments/999/replies", { content: { nested: true } }, headers);
    assert.equal(badContent.status, 400);
    assert.equal((await badContent.json()).error, "回复内容必须为字符串");
  } finally {
    await disposeHarness(h);
  }
});

test("non-string honeypot values are still trapped silently", async () => {
  const h = await createHarness();
  try {
    await h.adapter.createPost({ slug: "honeypot", title: "Honeypot", content: "Body", published: true });

    const res = await h.postJson("/api/posts/honeypot/comments", { authorName: "Bot", content: "spam", _hp: 1 });
    assert.equal(res.status, 200);
    assert.match((await res.json()).message, /等待审核/);

    const list = await (await h.getJson("/api/posts/honeypot/comments")).json();
    assert.equal(list.length, 0);
    assert.equal(h.resendCalls.length, 0, "蜜罐命中不应触发任何邮件");
  } finally {
    await disposeHarness(h);
  }
});
