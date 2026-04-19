import { SeoHead } from "@/components/seo-head";

export function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-[720px] py-[32px] lg:py-[56px] px-[16px] lg:px-0">
      <SeoHead
        title="隐私政策"
        description="Monolith 博客的数据收集与隐私保护政策。"
        url="/privacy"
      />
      <h1 className="text-[28px] font-semibold tracking-[-0.02em]">隐私政策</h1>
      <p className="text-[13px] text-muted-foreground/40 mt-[4px] mb-[24px]">
        最后更新：2025-04-19 · Last updated: 2026-04-19
      </p>
      <div className="prose-monolith space-y-[24px]">
        <section>
          <h2>数据收集声明</h2>
          <p>Monolith 博客在您访问时可能自动收集以下非个人身份信息：</p>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/20">
                <th className="text-left py-[8px] pr-[12px]">数据类型</th>
                <th className="text-left py-[8px] pr-[12px]">来源</th>
                <th className="text-left py-[8px]">用途</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/10">
                <td className="py-[8px] pr-[12px]">访问页面路径</td>
                <td className="py-[8px] pr-[12px]">请求 URL</td>
                <td className="py-[8px]">内容统计</td>
              </tr>
              <tr className="border-b border-border/10">
                <td className="py-[8px] pr-[12px]">访客来源国家</td>
                <td className="py-[8px] pr-[12px]">Cloudflare 头</td>
                <td className="py-[8px]">流量分析</td>
              </tr>
              <tr className="border-b border-border/10">
                <td className="py-[8px] pr-[12px]">来源域名</td>
                <td className="py-[8px] pr-[12px]">Referer 头</td>
                <td className="py-[8px]">流量分析</td>
              </tr>
              <tr className="border-b border-border/10">
                <td className="py-[8px] pr-[12px]">设备类型</td>
                <td className="py-[8px] pr-[12px]">User-Agent</td>
                <td className="py-[8px]">响应式优化</td>
              </tr>
              <tr>
                <td className="py-[8px] pr-[12px]">评论者昵称</td>
                <td className="py-[8px] pr-[12px]">用户主动填写</td>
                <td className="py-[8px]">公开展示</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[13px] text-muted-foreground/60 mt-[8px]">
            我们不收集 IP 地址原始值（仅做不可逆哈希用于投票去重），邮箱地址不会在公开 API 中返回。
          </p>
        </section>

        <section>
          <h2>Cookie 使用</h2>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border/20">
                <th className="text-left py-[8px] pr-[12px]">Cookie</th>
                <th className="text-left py-[8px] pr-[12px]">用途</th>
                <th className="text-left py-[8px]">持续时间</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/10">
                <td className="py-[8px] pr-[12px]">认证 Token</td>
                <td className="py-[8px] pr-[12px]">管理员登录</td>
                <td className="py-[8px]">7 天</td>
              </tr>
              <tr>
                <td className="py-[8px] pr-[12px]">_gdpr_consent</td>
                <td className="py-[8px] pr-[12px]">记录隐私同意</td>
                <td className="py-[8px]">1 年</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>第三方脚本同意机制</h2>
          <p>
            当站点配置了第三方脚本（如 Google Analytics）时，访客将看到 Cookie 同意横幅。
            在您明确同意之前，第三方脚本<strong>不会</strong>被加载。您可以随时撤回同意。
          </p>
        </section>

        <section>
          <h2>数据存储与处理</h2>
          <ul>
            <li>所有数据存储在 Cloudflare 边缘网络（Workers + D1/R2），位于就近的数据中心</li>
            <li>评论者邮箱仅用于管理员审核通知，不会在评论旁公开显示</li>
            <li>我们不出售、共享或传输用户数据给第三方</li>
          </ul>
        </section>

        <section>
          <h2>数据删除请求</h2>
          <p>
            如您希望删除您的评论或相关数据，请通过以下方式联系：
          </p>
          <ul>
            <li><a href="https://github.com/one-ea/Monolith/issues" className="text-foreground/70 underline hover:text-foreground transition-colors">GitHub Issue</a>（公开请求）</li>
            <li><a href="https://github.com/one-ea/Monolith/security/advisories/new" className="text-foreground/70 underline hover:text-foreground transition-colors">GitHub Security Advisories</a>（私密请求）</li>
          </ul>
          <p className="text-[13px] text-muted-foreground/60">我们将在 14 个工作日内处理您的请求。</p>
        </section>

        <section>
          <h2>政策更新</h2>
          <p>本隐私政策可能不定期更新，重大变更将在博客页面上公告。继续访问本站即表示您同意本政策。</p>
        </section>
      </div>
    </div>
  );
}