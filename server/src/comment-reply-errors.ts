export const INELIGIBLE_COMMENT_REPLY_ERROR = "只能回复同一文章中已审核的评论";

type ReplyErrorResponse = {
  error: string;
  status: 400 | 500;
};

type ErrorLogger = (...args: unknown[]) => void;

export function toCommentReplyErrorResponse(error: unknown, logError: ErrorLogger = console.error): ReplyErrorResponse {
  if (error instanceof Error && error.message === INELIGIBLE_COMMENT_REPLY_ERROR) {
    return { error: INELIGIBLE_COMMENT_REPLY_ERROR, status: 400 };
  }

  logError("Failed to add comment reply", error);
  return { error: "回复失败", status: 500 };
}

export function toPublicCommentSubmissionErrorResponse(
  error: unknown,
  options?: { isReply?: boolean; logError?: ErrorLogger },
): ReplyErrorResponse {
  const logError = options?.logError ?? console.error;
  if (error instanceof Error && error.message === INELIGIBLE_COMMENT_REPLY_ERROR) {
    return { error: INELIGIBLE_COMMENT_REPLY_ERROR, status: 400 };
  }

  logError(options?.isReply ? "Failed to submit public comment reply" : "Failed to submit public comment", error);
  return { error: options?.isReply ? "回复失败" : "提交失败", status: 500 };
}
