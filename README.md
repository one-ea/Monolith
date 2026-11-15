<div align="center">

<img src="client/public/icon-512.png" width="88" height="88" alt="Monolith logo" />

# Monolith

### 一套真正属于你的边缘原生博客

*GitHub Primer 设计语言 · 边缘计算 · 控制台全站管控 · 零运维成本*

<p>
  <a href="https://monolith-client.pages.dev"><strong>访问在线演示 ↗</strong></a>
  ·
  <a href="https://github.com/one-ea/Monolith/wiki">阅读文档</a>
  ·
  <a href="https://github.com/one-ea/Monolith/issues">提交反馈</a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<br/>

[**📚 文档**](https://github.com/one-ea/Monolith/wiki) · [**☁️ 在线预览**](https://monolith-client.pages.dev) · [**🐛 反馈**](https://github.com/one-ea/Monolith/issues) · [**🛡️ 安全**](./SECURITY.md) · [**🔒 隐私**](./PRIVACY.md)

</div>

---

## Monolith 是什么？

Monolith 是一个面向个人创作者的全栈博客系统：前端运行在 Cloudflare Pages，API 运行在 Cloudflare Workers，数据与媒体通过可替换的存储适配器连接。

设计哲学：**内容优先 · 边缘原生 · 沉浸式阅读 · 一切皆可控制台配置**。

---

## 能做什么

### 写作与内容

### 🎨 阅读体验（GitHub Primer 设计语言）
- **日/夜双主题** — 亮暗两套完整 token 对齐 GitHub "浅色/深色 - 默认"（`@primer/primitives`），蓝色链接与 focus ring、官方语法高亮配色、六色 GitHub 风格标签
- **站点级主题管控** — 明暗模式 × 视觉风格（classic / apple / pixel）由控制台统一设置，支持跟随系统，首屏 cookie 防闪烁
- **文章导航** — 自动 TOC、阅读进度条、IntersectionObserver 章节追踪
- **⌘K 全站搜索** — 防抖检索、键盘导航、关键词高亮
- **Reaction 表情** — 文末轻互动，无需登录即可表态

### 🎛️ 控制台全站管控
行为配置全部进 D1 设置键值，控制台改完即生效（最长 15 秒），不再依赖重部署：

| 配置面 | 能力 |
|--------|------|
| 安全防护 | 登录页 Cloudflare Turnstile 人机验证、JWT 会话时长（1/7/30 天）、登录/友链/留言速率限制 |
| 通知与集成 | Webhook 目标（多地址 + 一键测试）、Resend 邮件收发件人 |
| 主题外观 | 明暗模式、视觉风格（classic / apple / pixel），即时预览 |
| 访问控制 | 文章 / 标签 / 分类 / 系列密码锁，服务端 PBKDF2 验密；列表 / 搜索 / RSS / sitemap 自动排除 |
| 发现与注入 | 片段化代码注入：位置/作用域/同意策略独立控制，常用统计服务预设模板，旧数据一键迁移 |
| 搜索优化 | robots.txt 追加规则（白名单校验）、sitemap 归档开关与额外 URL（自动去重）、站点域名 |
| AE 采集 | 访客统计开关、站点白名单（主域自动匹配子域） |

### ⚡ 性能架构
- **边缘原生** — Hono + Cloudflare Workers，无冷启动，全球 < 50ms
- **存储适配** — 数据库 D1 / Turso / PostgreSQL，对象存储 R2 / S3 兼容
- **轻量交付** — Pages 上传 2.2MB / 97 个文件（旧格式字体经 `.assetsignore` 裁剪），PWA 离线可用
- **访客分析** — 内置 D1 轻量统计；Cloudflare 部署额外解锁 Analytics Engine 增强仪表板（UV/停留时长/浏览器/系统/分辨率/语言）

### 🛡️ 安全合规
- **认证与防护** — JWT + Turnstile 人机验证 + 可调限流，CSP/HSTS 全套头，SSRF 拦截
- **访问控制** — 文章 / 标签 / 分类 / 系列级密码锁，HttpOnly 解锁凭证，限流与改密失效
- **平台安全线** — GitHub secret scanning + push protection、CodeQL extended 查询集、CI Gitleaks 全历史扫描（含 AI 密钥等非提供商模式自定义规则）
- **隐私优先** — Cookie 同意横幅，第三方脚本按片段门控，GDPR 数据导出
- **多端备份** — JSON / R2-S3 / WebDAV 自由切换

### 🔍 SEO 与洞察
- **SEO 友好** — sitemap、RSS 2.0、JSON-LD、OG/Twitter Card
- **数据洞察** — 浏览量、14 日趋势、热门 Top 10

---

## 架构概览

```
        ┌──────────────────────────────────────────┐
        │            Cloudflare Edge               │
        │       (200+ PoPs · global anycast)       │
        └──────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼──────────────────┐
        ▼                                 ▼                  ▼
┌──────────────────┐            ┌──────────────────┐  ┌──────────────┐
│  Cloudflare      │  /api/*    │  Cloudflare      │  │ Cloudflare   │
│  Pages           │ ─────────▶ │  Workers         │  │ R2 / S3      │
│  React 19 SPA    │  反向代理  │  Hono Router     │  │ 媒体 / 备份  │
│  + PWA           │            │  Auth · Admin    │  └──────────────┘
│  Pages Functions │            │  Storage Factory │
└──────────────────┘            │  D1/Turso/PG     │
                                │  R2/S3           │
                                └──────────────────┘
```

### 请求与数据流

| 层级 | 模块 | 关键路径 |
|------|------|---------|
| 边缘网络 | Cloudflare 全球 anycast | 200+ PoPs · 自动 TLS · DDoS 防护 |
| 前端 | React SPA + Pages Functions | `client/src` · `client/functions` |
| 后端 | Hono Workers + Storage Factory | `server/src/index.ts` · `server/src/storage` |
| 持久层 | D1 / Turso / PostgreSQL · R2 / S3 | `server/src/storage/db` · `server/src/storage/object` |

### 核心设计

- **适配器模式** — `IDatabase` / `IObjectStorage` 统一接口，切换后端零侵入
- **配置分层** — 行为配置进 D1 settings（控制台管理）；Workers secret 只放凭据与基础设施拓扑
- **Pages Functions 反向代理** — 前端域名直连 `/api/*`，规避 CORS 复杂度
- **Drizzle ORM** — 所有 SQL 参数化，Schema 一处定义、三端同步
- **Monorepo 单脚本部署** — `npm run deploy:cloudflare` 串起迁移 → Workers → Pages 全链路

> 详细架构与设计决策参阅 [**Wiki · 架构概览**](https://github.com/one-ea/Monolith/wiki/Architecture)。

---

## 快速开始

### 环境要求

- Node.js `>= 22`
- npm
- Cloudflare 账户（部署到 Cloudflare 时需要）

### 本地运行

```bash
git clone https://github.com/one-ea/Monolith.git && cd Monolith
source "$HOME/.nvm/nvm.sh"  # bash/zsh 按需加载 nvm
nvm install && nvm use
npm ci
npm run doctor:local

# 启动前后端开发服务器
npm run dev
```

> 完整环境准备、密钥配置与本地数据库初始化参阅 [**Wiki · 快速开始**](https://github.com/one-ea/Monolith/wiki/Quick-Start)。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 同时启动前端与 Workers 开发服务器 |
| `npm run check` | 执行工作区类型检查 |
| `npm run lint` | 执行工作区 ESLint |
| `npm run build` | 构建前端产物 |
| `npm run db:migrate:local` | 执行本地 D1 迁移 |
| `npm run db:reconcile:local` | 对齐本地 D1 schema |
| `npm run deploy:cloudflare` | 执行完整 Cloudflare 部署链路 |

---

## 部署到 Cloudflare

首次部署前登录 Wrangler：

```bash
npx wrangler login
npm run deploy:cloudflare
```

> 生产 secret 已存在而本地无明文时，请改走[不覆盖 secret 的分步部署链路](https://github.com/one-ea/Monolith/wiki/Deployment)，业务密钥全程不被触碰。

`CLOUDFLARE_ACCOUNT_ID` 不再写死在仓库里：部署脚本按「环境变量 → `wrangler whoami --json` 单账户 → 明确报错」解析。`--skip-migrate` 只跳过远程迁移，schema reconcile 仍会执行；需要完全跳过数据库操作时同时传 `--skip-migrate --skip-reconcile`。

> 访问密码解锁使用 HttpOnly cookie（`Path=/api`），依赖同源 `/api` 代理。若把 `VITE_API_URL` 指向跨域 Worker，解锁 cookie 不会生效；请保持 Pages Functions 同源代理部署。

| 方案 | 状态 | 适用场景 |
|------|------|---------|
| 本机 CLI `npm run deploy:cloudflare` | ✅ 生产验证 | 首次部署推荐 |
| 不覆盖 secret 分步链路 | ✅ 生产验证 | 已上线站点日常更新 |
| GitHub Actions `Cloudflare Deploy` | ✅ 生产验证（含部署后自动健康检查） | 手动触发的一键 CI 部署 |

---

## 文档导航

| 入口 | 内容 |
|------|------|
| [Wiki · 部署指南](https://github.com/one-ea/Monolith/wiki/Deployment) | 部署完整指南（速通 + 密钥清单 + 分步链路 + 排错） |
| [Wiki · 控制台配置](https://github.com/one-ea/Monolith/wiki/Console-Settings) | 控制台可配置项与 secret 边界总览 |
| [Wiki](https://github.com/one-ea/Monolith/wiki) | 架构、API、二次开发 |
| [SECURITY.md](./SECURITY.md) | 安全策略与漏洞披露 |
| [PRIVACY.md](./PRIVACY.md) | 隐私政策 |
| [LICENSE](./LICENSE) | MIT 开源协议 |

---

## 贡献

欢迎提交 Issue、改进文档或发起 Pull Request。

在提交代码前，请先：

1. 阅读 [贡献指南](https://github.com/one-ea/Monolith/wiki/Contributing)。
2. 运行 `npm run check`、`npm run lint` 与 `npm run build`。
3. 确认没有将 secret、`.env`、本地上下文或生成文件提交到仓库。

Bug、功能建议与体验反馈请前往 [GitHub Issues](https://github.com/one-ea/Monolith/issues)。

## License

Monolith 基于 [MIT License](./LICENSE) 开源。

<div align="center">

<br />

<sub>Built for writers. Tuned for the edge. ✦</sub>

</div>
