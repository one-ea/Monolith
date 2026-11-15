import { test } from "vitest";
import assert from "node:assert/strict";
import { buildCommentForest, commentIndentStep, removeCommentThread } from "../src/lib/comments-state.ts";

test("deleting a parent removes it and its replies from admin state", () => {
  const comments = [
    { id: 1, parentId: null, content: "parent" },
    { id: 2, parentId: 1, content: "reply" },
    { id: 3, parentId: 2, content: "grandchild" },
    { id: 4, parentId: null, content: "other" },
  ];

  assert.deepEqual(removeCommentThread(comments, 1), [comments[3]]);
});

test("deleting a reply preserves its parent", () => {
  const comments = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
  ];

  assert.deepEqual(removeCommentThread(comments, 2), [comments[0]]);
});


test("buildCommentForest preserves arbitrary depth and orphans visibly", () => {
  const comments = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 2 },
    { id: 4, parentId: 999 },
  ];
  const forest = buildCommentForest(comments);
  assert.deepEqual(forest.map((node) => node.comment.id), [1, 4]);
  assert.equal(forest[0].children[0].children[0].comment.id, 3);
});


test("buildCommentForest surfaces every comment in a multi-node cycle", () => {
  const comments = [
    { id: 1, parentId: 2 },
    { id: 2, parentId: 3 },
    { id: 3, parentId: 1 },
    { id: 4, parentId: null },
  ];

  const forest = buildCommentForest(comments);
  const visited = new Set<number>();
  const visit = (nodes: typeof forest) => {
    for (const node of nodes) {
      assert.equal(visited.has(node.comment.id), false);
      visited.add(node.comment.id);
      visit(node.children);
    }
  };
  visit(forest);

  assert.deepEqual([...visited].sort((a, b) => a - b), [1, 2, 3, 4]);
});


test("comment indentation holds steady for deeply nested replies", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 10].map(commentIndentStep), [0, 10, 10, 10, 10, 10, 10]);
});


test("a 1000-level chain builds without error and deletes in full", () => {
  const comments = Array.from({ length: 1000 }, (_, index) => ({
    id: index + 1,
    parentId: index === 0 ? null : index,
  }));

  const forest = buildCommentForest(comments);
  assert.equal(forest.length, 1);

  let depth = 0;
  let node = forest[0];
  while (node.children.length > 0) {
    node = node.children[0];
    depth += 1;
  }
  assert.equal(depth, 999);

  assert.equal(removeCommentThread(comments, 1).length, 0);
});
