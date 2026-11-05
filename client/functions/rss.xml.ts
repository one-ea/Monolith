import {
  buildTargetUrl,
  createPlainApiBaseErrorResponse,
  getBackendUrl,
} from "./_shared";

// 代理 /rss.xml 到 Workers 后端
export const onRequest: PagesFunction<{ API_BASE: string }> = async (context) => {
  const backend = getBackendUrl(context.env);
  if (!backend) {
    return createPlainApiBaseErrorResponse();
  }

  const target = buildTargetUrl(backend, context.request);
  // RSS 永远匿名：不透传 Cookie / Authorization，避免解锁内容进入 public 缓存。
  const res = await fetch(target, {
    method: context.request.method,
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};
