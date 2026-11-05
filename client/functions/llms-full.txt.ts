import {
  buildTargetUrl,
  createPlainApiBaseErrorResponse,
  getBackendUrl,
} from "./_shared";

// 代理 /llms-full.txt 到 Workers 后端（全文输出，可能较大；后端带 ETag/304）
// 仅允许 GET/HEAD，避免成为开放 method 转发器
export const onRequest: PagesFunction<{ API_BASE: string }> = async (context) => {
  const method = context.request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const backend = getBackendUrl(context.env);
  if (!backend) {
    return createPlainApiBaseErrorResponse();
  }

  const target = buildTargetUrl(backend, context.request);
  // 不透传客户端 headers（含 If-None-Match 由后端统一处理 304），避免泄漏凭据
  const res = await fetch(target, {
    method,
    headers: { Accept: "text/plain" },
  });
  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};
