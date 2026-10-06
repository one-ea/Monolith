export type PublicCommentInput = {
  authorName: string;
  authorEmail: string;
  content: string;
  parentId: number | null;
};

export type ParsePublicCommentInputResult =
  | { ok: true; value: PublicCommentInput }
  | { ok: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parsePublicCommentInput(body: unknown): ParsePublicCommentInputResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "请求体格式无效" };
  }

  const record = body as Record<string, unknown>;

  if (typeof record.authorName !== "string" || typeof record.content !== "string") {
    return { ok: false, error: "昵称和评论内容不能为空" };
  }

  if (record.authorName.length > 50) {
    return { ok: false, error: "昵称不能超过 50 字" };
  }
  if (record.content.length > 2000) {
    return { ok: false, error: "评论内容不能超过 2000 字" };
  }

  const authorName = record.authorName.trim();
  const content = record.content.trim();

  if (!authorName || !content) {
    return { ok: false, error: "昵称和评论内容不能为空" };
  }

  let authorEmail = "";
  if (record.authorEmail !== undefined && record.authorEmail !== null && record.authorEmail !== "") {
    if (typeof record.authorEmail !== "string") {
      return { ok: false, error: "邮箱格式无效" };
    }
    if (record.authorEmail.length > 100) {
      return { ok: false, error: "邮箱不能超过 100 字" };
    }
    const trimmedEmail = record.authorEmail.trim();
    if (trimmedEmail !== "") {
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        return { ok: false, error: "邮箱格式无效" };
      }
      authorEmail = trimmedEmail;
    }
  }

  let parentId: number | null = null;
  if ("parentId" in record && record.parentId !== undefined) {
    const rawParentId = record.parentId;
    if (rawParentId === null) {
      return { ok: false, error: "无效的回复目标" };
    }
    if (typeof rawParentId !== "number" || !Number.isSafeInteger(rawParentId) || rawParentId <= 0) {
      return { ok: false, error: "无效的回复目标" };
    }
    parentId = rawParentId;
  }

  return {
    ok: true,
    value: {
      authorName,
      authorEmail,
      content,
      parentId,
    },
  };
}
