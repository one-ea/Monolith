# 隐私政策 / Privacy Policy

最后更新 / Last updated: 2026-04-19

---

## 数据收集声明

Monolith 博客在您访问时可能自动收集以下非个人身份信息：

| 数据类型 | 来源 | 用途 | 存储方式 |
|---------|------|------|---------|
| 访问页面路径 | 请求 URL | 内容统计 | 边缘数据库 |
| 访客来源国家 | Cloudflare `CF-IPCountry` 头 | 流量分析 | 边缘数据库 |
| 来源域名 | `Referer` 头 | 流量分析 | 边缘数据库 |
| 设备类型 | `User-Agent` 解析（仅区分 desktop/mobile/bot） | 响应式优化 | 边缘数据库 |
| 评论者昵称 | 用户主动填写 | 公开展示 | 边缘数据库 |

**我们不收集：** IP 地址（仅处理为不可逆哈希用于投票去重）、邮箱地址不在公开 API 中返回。

## Cookie 使用

| Cookie | 用途 | 持续时间 |
|--------|------|---------|
| 认证 Token | 管理员登录 | 7 天 |
| `_gdpr_consent` | 记录隐私同意 | 1 年 |

站点管理员可通过"扩展与注入"设置添加第三方分析脚本（如 Google Analytics）。此类脚本可能设置额外的 Cookie，需遵守本政策的同意机制。

## 第三方脚本同意机制

当站点配置了自定义头部/尾部脚本（如分析服务），访客将看到 Cookie 同意横幅。**在您明确同意之前，第三方脚本不会被加载。** 您可以随时撤回同意。

## 数据存储与处理

- 所有数据存储在 Cloudflare 边缘网络（Workers + D1/R2），位于就近的数据中心
- 评论者邮箱仅用于管理员审核通知，不会在他的评论旁公开显示
- 我们不售卖、共享或传输用户数据给第三方

## 数据删除请求

如您希望删除您的评论或相关数据，请通过以下方式联系：

- GitHub Issue（公开请求）
- [GitHub Security Advisories](https://github.com/one-ea/Monolith/security/advisories/new)（私密请求）

我们将在 14 个工作日内处理您的请求。

## 政策更新

本隐私政策可能不定期更新，重大变更将在博客页面上公告。继续访问本站即表示您同意本政策。

---

## Data Collection Notice

Monolith blog may automatically collect the following non-personally identifiable information when you visit:

| Data Type | Source | Purpose | Storage |
|-----------|--------|---------|---------|
| Page path visited | Request URL | Content analytics | Edge database |
| Visitor country | Cloudflare `CF-IPCountry` header | Traffic analysis | Edge database |
| Referrer domain | `Referer` header | Traffic analysis | Edge database |
| Device type | `User-Agent` parsing (desktop/mobile/bot only) | Responsive optimization | Edge database |
| Commenter nickname | User-provided | Public display | Edge database |

**We do not collect:** IP addresses (only hashed for vote deduplication), email addresses are never returned in public APIs.

## Cookie Usage

| Cookie | Purpose | Duration |
|--------|---------|----------|
| Auth Token | Admin login | 7 days |
| `_gdpr_consent` | Records privacy consent | 1 year |

Site administrators may add third-party analytics scripts via "Extensions & Injection" settings. Such scripts may set additional cookies and are subject to the consent mechanism described in this policy.

## Third-Party Script Consent

When custom header/footer scripts (e.g., analytics) are configured, visitors will see a cookie consent banner. **Third-party scripts are not loaded until you explicitly consent.** You may withdraw consent at any time.

## Data Storage & Processing

- All data is stored on the Cloudflare edge network (Workers + D1/R2) in nearest data centers
- Commenter emails are used only for admin review notifications and are never displayed publicly
- We do not sell, share, or transfer user data to third parties

## Data Deletion Requests

To request deletion of your comments or related data, please contact us via:

- GitHub Issue (public request)
- [GitHub Security Advisories](https://github.com/one-ea/Monolith/security/advisories/new) (private request)

We will process your request within 14 business days.

## Policy Updates

This privacy policy may be updated periodically. Major changes will be announced on the blog. Continued use of this site constitutes acceptance of this policy.