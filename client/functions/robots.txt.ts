import {
  buildTargetUrl,
  createPlainApiBaseErrorResponse,
  getBackendUrl,
} from "./_shared";

// 代理 /robots.txt 到 Workers 后端
export const onRequest: PagesFunction<{ API_BASE: string }> = async (context) => {
  const backend = getBackendUrl(context.env);
  if (!backend) {
    return createPlainApiBaseErrorResponse();
  }

  const target = buildTargetUrl(backend, context.request);
  const res = await fetch(target, {
    method: context.request.method,
    headers: context.request.headers,
  });
  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};
