import { test } from "vitest";
import assert from "node:assert/strict";
import { buildCommentReplyEmail, shouldNotifyCommentReply } from "../src/comment-notifications.ts";

test("reply email HTML-escapes every user-controlled field", () => {
  const { subject, html } = buildCommentReplyEmail({
    recipientName: '<Alice "x">',
    replyAuthorName: "<script>alert(1)</script>",
    replyContent: "a & b < c > d \" '",
    postTitle: "标题 <t>",
    postSlug: "my/post",
    parentCommentId: 7,
    siteOrigin: "https://example.com/",
  });

  assert.ok(!html.includes("<script>"), "script 标签必须被转义");
  assert.ok(!html.includes('<Alice'), "收件人昵称必须被转义");
  assert.ok(html.includes("&amp;"), "& 必须被转义");
  assert.ok(html.includes("my%2Fpost"), "slug 必须经过 encodeURIComponent");
  assert.ok(html.includes("#comment-7"), "锚点必须指向父评论");
  assert.ok(subject.includes("标题 <t>"), "subject 为纯文本，不做 HTML 转义");
});

test("shouldNotifyCommentReply requires an approved parent with an email", () => {
  assert.equal(shouldNotifyCommentReply({ approved: true, authorEmail: "reader@example.com" }), true);
  assert.equal(shouldNotifyCommentReply({ approved: false, authorEmail: "reader@example.com" }), false);
  assert.equal(shouldNotifyCommentReply({ approved: true, authorEmail: "" }), false);
  assert.equal(shouldNotifyCommentReply({ approved: true, authorEmail: "   " }), false);
});
