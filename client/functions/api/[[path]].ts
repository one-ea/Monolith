import {
  buildTargetUrl,
  createApiBaseErrorResponse,
  getBackendUrl,
} from "../_shared";

// Cloudflare Pages Function — 反向代理所有 /api/* 请求到 Workers 后端
export const onRequest: PagesFunction<{ API_BASE: string }> = async (context) => {
  // 直接处理 CORS 预检请求，不转发
  if (context.request.method === "OPTIONS") {
    const origin = context.request.headers.get("Origin") || "*";
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      },
    });
  }

  const backend = getBackendUrl(context.env);
  if (!backend) {
    const origin = context.request.headers.get("Origin") || "*";
    return createApiBaseErrorResponse({
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
    });
  }

  const target = buildTargetUrl(backend, context.request);

  const res = await fetch(target, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.method !== "GET" && context.request.method !== "HEAD"
      ? context.request.body
      : undefined,
    redirect: "manual", // 不跟随重定向，原样返回 30x
  });

  const origin = context.request.headers.get("Origin") || "*";
  const responseHeaders = new Headers(res.headers);
  responseHeaders.set("Access-Control-Allow-Origin", origin);
  responseHeaders.set("Vary", "Origin");

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
};
