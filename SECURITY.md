# 安全策略

> Monolith 是一个边缘原生（Cloudflare Workers + D1 + R2）的全栈博客系统。
> 我们认真对待每一个安全报告，并致力于以专业、透明的方式响应漏洞披露。

## 支持的版本

我们仅对 `main` 分支的最新版本提供安全更新。

| 版本 | 支持状态 | 说明 |
|------|:-------:|------|
| `main` (latest) | ✅ 持续维护 | 接收所有安全补丁 |
| 历史 commit | ⚠️ 自行升级 | 请 rebase 到 main 获取修复 |

由于本项目采用边缘部署 + 滚动发布，不维护 LTS 分支。请始终基于最新 `main` 部署。

## 报告漏洞

**🚫 请勿在公开 Issue / PR / Discussions 中披露漏洞细节。**

请通过以下任一私密渠道联系：

| 渠道 | 链接 | 说明 |
|------|------|------|
| **GitHub Security Advisories**（首选） | [新建私密报告](https://github.com/one-ea/Monolith/security/advisories/new) | 自带漏洞跟踪 + CVE 申请通道 |
| **GitHub 私信** | [@one-ea](https://github.com/one-ea) | 备用渠道，先发简短摘要 |

### 报告应包含

- **漏洞类型** — 例如 XSS、SSRF、SQL 注入、权限绕过等
- **影响范围** — 受影响的端点 / 模块 / 数据
- **复现步骤** — 最小可复现路径，可附 PoC 或截图
- **风险评估** — 严重程度自评（参考 CVSS）
- **建议修复**（可选） — 若已有思路欢迎附上

### 响应 SLA

| 阶段 | 时限 |
|------|------|
| 确认收到 | 48 小时内 |
| 初步评估 + 严重度分级 | 7 天内 |
| 修复发布 | Critical/High 14 天内；Medium 30 天内；Low 视排期 |
| 公开披露 | 修复上线后 30 天，或与报告人协商 |

负责任披露的报告人将在 Release Notes 与 Security Advisory 中获得致谢（除非希望保持匿名）。

## 安全设计

### 认证与会话
- JWT 签名认证，有效期 7 天，密钥经 `wrangler secret` 注入
- 后台登录速率限制：5 次 / 15 分钟 / IP（边缘 Map 实现）
- 管理入口路径隐藏，前台不暴露 `/admin` 链接

### 输入与输出
- DOMPurify 预过滤所有用户富文本（评论、文章正文）
- Markdown 渲染拦截 `javascript:` / `data:` 协议 URI
- 评论 API 公开返回剥离 `authorEmail`，头像改用 DiceBear 派生
- 反垃圾：Honeypot 蜜罐字段 + 时间戳校验

### 网络与边缘
- HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy 全套响应头
- CORS 动态反射白名单 Origin（Workers + Pages Function 双侧同步）
- SSRF 防护：仅允许 HTTPS，拦截 RFC1918 / loopback / link-local 内网段
- 生产环境关闭 source map（`sourcemap: false`）

### 存储与密钥
- 所有密钥（`ADMIN_PASSWORD` / `JWT_SECRET` / `REACTION_SALT` 等）通过 Wrangler Secrets 注入，**不入仓库**
- `.env*` / `.dev.vars` 全量 gitignore
- D1 全部使用 Drizzle 参数化查询，禁止 `sql.raw()` 字符串拼接
- R2 上传文件名随机化（`uploads/时间戳-随机串.扩展名`），防猜测

### 隐私与合规
- Cookie 同意横幅 + 第三方脚本（统计/分析）门控加载
- `/privacy` 隐私政策页 + 仓库根 [`PRIVACY.md`](./PRIVACY.md)
- 管理端为 GDPR 数据导出/删除请求提供操作面板
- `/api/health` 端点已剥离基础设施提供商信息

### 自动化扫描
- **CodeRabbit** — PR 级别 AI 代码审查
- **Gitleaks / TruffleHog** — 密钥泄漏检测（CI）
- **Dependabot** — 依赖漏洞 + 自动 PR
- **CodeQL** — 静态安全分析

## 范围说明

**本策略覆盖**：
- `client/`（React 前端）
- `server/`（Hono Workers 后端）
- `scripts/` 部署脚本
- `.github/workflows/` CI/CD 配置

**不在范围**：
- 第三方依赖漏洞（请直接报告给上游，我们会及时升级）
- 部署者自行修改的 fork（请联系该 fork 维护者）
- 社会工程攻击 / 物理访问场景

## 致谢墙

感谢所有以负责任态度披露漏洞的安全研究者。漏洞修复后，我们会在此列出贡献者（征得同意后）：

<!-- Hall of Fame 占位符 -->
_暂无公开记录。_

---

最后更新：2026-04-25
