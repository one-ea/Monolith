import { test } from "vitest";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { TursoAdapter } from "../src/storage/db/turso.ts";
import { createDatabase } from "../src/storage/factory.ts";
import { toCommentReplyErrorResponse } from "../src/comment-reply-errors.ts";
import { parsePublicCommentInput } from "../src/public-comment-input.ts";

test("Turso allows arbitrary-depth approved admin replies", async () => {
  const directory = await mkdtemp(join(tmpdir(), "monolith-comment-replies-"));
  try {
    const adapter = new TursoAdapter(`file:${join(directory, "test.db")}`);
    await adapter.ensureCoreTables();
    await adapter.createPost({
      slug: "reply-test",
      title: "Reply test",
      content: "Post body",
    });
    const parent = await adapter.addComment({
      postSlug: "reply-test",
      authorName: "Reader",
      authorEmail: "reader@example.com",
      content: "Parent",
    });
    await adapter.approveComment(parent.id);
    const { reply } = await adapter.addCommentReply(parent.id, {
      authorName: "Author",
      content: "First-level reply",
    });

    const { reply: nested } = await adapter.addCommentReply(reply.id, { authorName: "Author", content: "Nested reply" });
    assert.equal(nested.parentId, reply.id);
    assert.equal(nested.approved, true);
    assert.equal((await adapter.getApprovedComments("reply-test")).length, 3);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("public replies stay pending and require an approved parent on the same post", async () => {
  const directory = await mkdtemp(join(tmpdir(), "monolith-public-replies-"));
  try {
    const adapter = new TursoAdapter(`file:${join(directory, "test.db")}`);
    await adapter.ensureCoreTables();
    await adapter.createPost({ slug: "one", title: "One", content: "Body" });
    await adapter.createPost({ slug: "two", title: "Two", content: "Body" });
    const parent = await adapter.addComment({ postSlug: "one", authorName: "Reader", authorEmail: "reader@example.com", content: "Parent" });
    await assert.rejects(adapter.addComment({ postSlug: "one", authorName: "Other", content: "Too soon", parentId: parent.id }), /只能回复同一文章中已审核的评论/);
    await adapter.approveComment(parent.id);
    await assert.rejects(adapter.addComment({ postSlug: "two", authorName: "Other", content: "Wrong post", parentId: parent.id }), /只能回复同一文章中已审核的评论/);
    const reply = await adapter.addComment({ postSlug: "one", authorName: "Other", authorEmail: "other@example.com", content: "Pending reply", parentId: parent.id });
    assert.equal(reply.approved, false);
    assert.equal(reply.parentId, parent.id);
    assert.equal((await adapter.getApprovedComments("one")).length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("approval reports a pending reply exactly once with its direct parent", async () => {
  const directory = await mkdtemp(join(tmpdir(), "monolith-reply-approval-"));
  try {
    const adapter = new TursoAdapter(`file:${join(directory, "test.db")}`);
    await adapter.ensureCoreTables();
    await adapter.createPost({ slug: "approval", title: "Approval", content: "Body" });
    const parent = await adapter.addComment({ postSlug: "approval", authorName: "Parent", authorEmail: "parent@example.com", content: "Parent" });
    await adapter.approveComment(parent.id);
    const reply = await adapter.addComment({ postSlug: "approval", authorName: "Child", authorEmail: "child@example.com", content: "Child", parentId: parent.id });
    const first = await adapter.approveComment(reply.id);
    const repeated = await adapter.approveComment(reply.id);
    assert.equal(first.found, true);
    assert.equal(first.becameApproved, true);
    assert.equal(first.parent?.id, parent.id);
    assert.equal(first.parent?.authorEmail, "parent@example.com");
    assert.equal(repeated.found, true);
    assert.equal(repeated.becameApproved, false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("deleting a comment cascades through every descendant", async () => {
  const directory = await mkdtemp(join(tmpdir(), "monolith-reply-delete-"));
  try {
    const adapter = new TursoAdapter(`file:${join(directory, "test.db")}`);
    await adapter.ensureCoreTables();
    await adapter.createPost({ slug: "delete", title: "Delete", content: "Body" });
    const root = await adapter.addComment({ postSlug: "delete", authorName: "Root", content: "Root" });
    await adapter.approveComment(root.id);
    const { reply: child } = await adapter.addCommentReply(root.id, { authorName: "Admin", content: "Child" });
    await adapter.addCommentReply(child.id, { authorName: "Admin", content: "Grandchild" });
    assert.equal(await adapter.deleteComment(root.id), true);
    assert.equal((await adapter.getAllComments()).length, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("the existing Turso factory lifecycle provisions the reply column", async () => {
  const directory = await mkdtemp(join(tmpdir(), "monolith-comment-schema-"));
  const databaseUrl = `file:${join(directory, "factory.db")}`;
  try {
    await createDatabase({ DB_PROVIDER: "turso", TURSO_URL: databaseUrl });
    const client = createClient({ url: databaseUrl });
    const result = await client.execute("PRAGMA table_info(comments)");

    assert.ok(result.rows.some((row) => row.name === "parent_id"));
    client.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unexpected reply errors are logged and hidden from clients", () => {
  const logged: unknown[][] = [];
  const result = toCommentReplyErrorResponse(new Error("database credentials leaked"), (...args) => logged.push(args));

  assert.deepEqual(result, { error: "回复失败", status: 500 });
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], "Failed to add comment reply");
  assert.match(String(logged[0][1]), /database credentials leaked/);
});

test("ineligible parents retain a specific client error", () => {
  const logged: unknown[][] = [];
  const result = toCommentReplyErrorResponse(new Error("只能回复同一文章中已审核的评论"), (...args) => logged.push(args));

  assert.deepEqual(result, { error: "只能回复同一文章中已审核的评论", status: 400 });
  assert.equal(logged.length, 0);
});

test("public comment input is type-checked and normalized", () => {
  assert.deepEqual(parsePublicCommentInput({
    authorName: "  Reader  ",
    authorEmail: "  reader@example.com  ",
    content: "  Hello  ",
    parentId: 12,
  }), {
    ok: true,
    value: { authorName: "Reader", authorEmail: "reader@example.com", content: "Hello", parentId: 12 },
  });

  for (const input of [
    { authorName: 42, content: "Hello" },
    { authorName: "Reader", authorEmail: 42, content: "Hello" },
    { authorName: "Reader", content: {} },
  ]) {
    assert.equal(parsePublicCommentInput(input).ok, false);
  }
});

test("public comment input rejects oversized fields rather than truncating them", () => {
  const cases = [
    [{ authorName: "a".repeat(51), content: "Hello" }, "昵称不能超过 50 字"],
    [{ authorName: "Reader", authorEmail: `${"a".repeat(89)}@example.com`, content: "Hello" }, "邮箱不能超过 100 字"],
    [{ authorName: "Reader", content: "a".repeat(2001) }, "评论内容不能超过 2000 字"],
  ] as const;

  for (const [input, error] of cases) {
    assert.deepEqual(parsePublicCommentInput(input), { ok: false, error });
  }
});

test("public comment input validates optional email and safe positive parent ids", () => {
  assert.deepEqual(parsePublicCommentInput({ authorName: "Reader", authorEmail: "bad", content: "Hello" }), { ok: false, error: "邮箱格式无效" });
  for (const parentId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1", null]) {
    assert.deepEqual(parsePublicCommentInput({ authorName: "Reader", content: "Hello", parentId }), { ok: false, error: "无效的回复目标" });
  }
  assert.deepEqual(parsePublicCommentInput({ authorName: "Reader", content: "Hello" }), {
    ok: true,
    value: { authorName: "Reader", authorEmail: "", content: "Hello", parentId: null },
  });
});

test("Turso supports authenticated admin comments with instant approval and isAdmin flag", async () => {
  const directory = await mkdtemp(join(tmpdir(), "monolith-comment-admin-"));
  try {
    const adapter = new TursoAdapter(`file:${join(directory, "test.db")}`);
    await adapter.ensureCoreTables();
    await adapter.createPost({
      slug: "admin-badge-post",
      title: "Admin Badge Post",
      content: "Content",
      published: true,
    });

    // 1. Regular visitor comment -> approved: false, isAdmin: false
    const visitorComment = await adapter.addComment({
      postSlug: "admin-badge-post",
      authorName: "博主", // Pretending to be blogger without token
      authorEmail: "fake@example.com",
      content: "I am fake",
      isAdmin: false,
    });
    assert.equal(visitorComment.approved, false);
    assert.equal(visitorComment.isAdmin, false);

    // 2. Authenticated admin comment -> approved: true, isAdmin: true
    const adminComment = await adapter.addComment({
      postSlug: "admin-badge-post",
      authorName: "真正博主",
      content: "Official comment",
      isAdmin: true,
    });
    assert.equal(adminComment.approved, true);
    assert.equal(adminComment.isAdmin, true);

    // 3. Approved comments list returns admin comment immediately with isAdmin: true
    const approved = await adapter.getApprovedComments("admin-badge-post");
    assert.equal(approved.length, 1);
    assert.equal(approved[0].authorName, "真正博主");
    assert.equal(approved[0].isAdmin, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("concurrent approvals flip becameApproved exactly once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "monolith-concurrent-approval-"));
  try {
    const adapter = new TursoAdapter(`file:${join(directory, "test.db")}`);
    await adapter.ensureCoreTables();
    await adapter.createPost({ slug: "concurrent", title: "Concurrent", content: "Body", published: true });
    const parent = await adapter.addComment({ postSlug: "concurrent", authorName: "Parent", authorEmail: "p@example.com", content: "Parent" });
    await adapter.approveComment(parent.id);
    const reply = await adapter.addComment({ postSlug: "concurrent", authorName: "Child", content: "Child", parentId: parent.id });

    const results = await Promise.all([adapter.approveComment(reply.id), adapter.approveComment(reply.id)]);
    assert.equal(results.filter((result) => result.becameApproved).length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("getCommentById returns the joined post context and null for unknown ids", async () => {
  const directory = await mkdtemp(join(tmpdir(), "monolith-comment-by-id-"));
  try {
    const adapter = new TursoAdapter(`file:${join(directory, "test.db")}`);
    await adapter.ensureCoreTables();
    await adapter.createPost({ slug: "by-id", title: "By Id", content: "Body", published: true });
    const comment = await adapter.addComment({ postSlug: "by-id", authorName: "Reader", authorEmail: "r@example.com", content: "Hello" });

    const found = await adapter.getCommentById(comment.id);
    assert.equal(found?.postSlug, "by-id");
    assert.equal(found?.postTitle, "By Id");
    assert.equal(found?.authorEmail, "r@example.com");

    assert.equal(await adapter.getCommentById(987654), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("deleting a comment whose parent chain forms a cycle terminates and cleans up", async () => {
  const directory = await mkdtemp(join(tmpdir(), "monolith-cycle-delete-"));
  try {
    const adapter = new TursoAdapter(`file:${join(directory, "test.db")}`);
    await adapter.ensureCoreTables();
    await adapter.createPost({ slug: "cycle", title: "Cycle", content: "Body", published: true });
    const root = await adapter.addComment({ postSlug: "cycle", authorName: "Root", content: "Root" });
    await adapter.approveComment(root.id);
    const { reply: child } = await adapter.addCommentReply(root.id, { authorName: "Admin", content: "Child" });

    // 直接改库制造 root↔child 环（API 层无法构造，模拟外部迁移脏数据）：
    // UNION 版递归 CTE 必须自然终止而不是无限递归
    const raw = adapter as unknown as { db: { run: (query: unknown) => Promise<unknown> } };
    await raw.db.run(sql`UPDATE comments SET parent_id = ${child.id} WHERE id = ${root.id}`);

    assert.equal(await adapter.deleteComment(root.id), true);
    assert.equal((await adapter.getAllComments()).length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
