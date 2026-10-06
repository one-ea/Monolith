export type CommentTreeItem = {
  id: number;
  parentId: number | null;
};

export type CommentTreeNode<T extends CommentTreeItem> = {
  comment: T;
  children: CommentTreeNode<T>[];
};

export function buildCommentForest<T extends CommentTreeItem>(comments: T[]): CommentTreeNode<T>[] {
  const nodes = new Map<number, CommentTreeNode<T>>(
    comments.map((comment) => [comment.id, { comment, children: [] }]),
  );
  const roots: CommentTreeNode<T>[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id)!;
    const parent = comment.parentId == null ? undefined : nodes.get(comment.parentId);
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }

  const reachable = new Set<number>();
  const visit = (node: CommentTreeNode<T>) => {
    if (reachable.has(node.comment.id)) return;
    reachable.add(node.comment.id);
    node.children = node.children.filter((child) => !reachable.has(child.comment.id));
    node.children.forEach(visit);
  };
  roots.forEach(visit);
  for (const comment of comments) {
    if (!reachable.has(comment.id)) {
      const node = nodes.get(comment.id)!;
      roots.push(node);
      visit(node);
    }
  }
  return roots;
}

export function commentIndentStep(depth: number): number {
  // 嵌套视觉层级由每层 border-l + padding 提供；此偏移对所有子层级保持恒定
  return depth > 0 ? 10 : 0;
}

export function removeCommentThread<T extends CommentTreeItem>(comments: T[], deletedId: number): T[] {
  const removed = new Set<number>([deletedId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const comment of comments) {
      if (comment.parentId != null && removed.has(comment.parentId) && !removed.has(comment.id)) {
        removed.add(comment.id);
        changed = true;
      }
    }
  }
  return comments.filter((comment) => !removed.has(comment.id));
}
