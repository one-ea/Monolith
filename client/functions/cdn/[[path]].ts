// 代理 /cdn/* 到 Workers 后端
export const onRequest: PagesFunction<{ API_BASE: string }> = async (context) => {
  const backend = context.env.API_BASE || "https://monolith-server.h005-9d9.workers.dev";
  const url = new URL(context.request.url);
  const target = `${backend}${url.pathname}${url.search}`;
  const res = await fetch(target, {
    method: context.request.method,
    headers: context.request.headers,
  });
  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};
