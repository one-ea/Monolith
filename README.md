<div align="center">

<img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/box.svg" width="96" height="96" alt="Monolith" />

# Monolith

**高质感无服务器边缘博客系统**

*极致视觉 · 边缘计算 · 多后端存储 · 零运维成本*

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<br/>

[**📚 文档**](https://github.com/one-ea/Monolith/wiki) · [**☁️ 在线预览**](https://monolith-client.pages.dev) · [**🐛 反馈**](https://github.com/one-ea/Monolith/issues) · [**🛡️ 安全**](./SECURITY.md) · [**🔒 隐私**](./PRIVACY.md)

</div>

---

## ✨ 简介

**Monolith** 是一套运行在 Cloudflare 全球边缘网络上的现代化博客系统，前后端通过适配器模式解耦，零运维即可获得全球 < 50ms 的访问延迟。

设计哲学：**内容优先 · 边缘原生 · 沉浸式阅读**。

---

## 🌟 核心特性

### ✍️ 创作体验
- **沉浸式编辑器** — Markdown + 实时预览，KaTeX 数学公式，代码高亮一键复制
- **多平台导入** — 一键迁移 WordPress / Ghost / Hexo / Hugo / Jekyll / Halo
- **内容编排** — 草稿、定时发布、置顶、系列合集、独立页动态导航

### 🎨 阅读体验
- **暗/亮双主题** — OKLCH 色值系统，过渡顺滑无闪烁
- **文章导航** — 自动 TOC、阅读进度条、IntersectionObserver 章节追踪
- **⌘K 全站搜索** — 防抖检索、键盘导航、关键词高亮
- **Reaction 表情** — 文末轻互动，无需登录即可表态

### ⚡ 性能架构
- **边缘原生** — Hono + Cloudflare Workers，无冷启动，全球 < 50ms
- **存储适配** — 数据库 D1 / Turso / PostgreSQL，对象存储 R2 / S3 兼容
- **零运维成本** — 单脚本一键部署，前后端走同一条流水线

### 🛡️ 安全合规
- **认证与防护** — JWT + 限流，CSP/HSTS 全套头，SSRF 拦截
- **隐私优先** — Cookie 同意横幅，第三方脚本门控，GDPR 数据导出
- **多端备份** — JSON / R2-S3 / WebDAV 自由切换

### 🤖 智能扩展
- **MCP 工具链** — 配套 [Monolith-MCP](https://github.com/one-ea/Monolith-MCP)，让 AI 助手代为写稿、审评、备份
- **SEO 友好** — sitemap、RSS 2.0、JSON-LD、OG/Twitter Card
- **数据洞察** — 浏览量、14 日趋势、热门 Top 10

---

## 🏗️ 架构

```
                        ┌──────────────────────────────────────────┐
                        │            Cloudflare Edge               │
                        │       (200+ PoPs · global anycast)       │
                        └──────────────────────────────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│  Cloudflare      │            │  Cloudflare      │            │  Cloudflare R2   │
│  Pages           │            │  Workers         │            │  (or S3 兼容)    │
│                  │            │                  │            │                  │
│  React SPA       │            │  Hono Router     │            │  上传 / 媒体库    │
│  ├ 阅读端        │  /api/*    │  ├ Public  API   │            │  ├ 文章封面      │
│  ├ ⌘K 搜索       │ ─────────▶ │  ├ Admin   API   │ ─对象存储─▶ │  ├ Markdown 图片 │
│  ├ TOC / 阅读条  │  反向代理  │  ├ Auth (JWT)    │            │  └ 备份归档      │
│  └ 后台 App Shell│            │  └ Importers     │            └──────────────────┘
│                  │            │                  │                      ▲
│  Pages Functions │            │  Storage Factory │                      │
│  ├ /api/*  转发  │            │  ├ IDatabase     │                      │
│  ├ /cdn/*  代理  │            │  │  ├ D1         │                      │
│  └ /rss.xml      │            │  │  ├ Turso      │                      │
└──────────────────┘            │  │  └ Postgres   │ ◀── 参数化 SQL ─┐    │
                                │  └ IObjectStorage│                 │    │
                                │     ├ R2         │ ─────────────────┘    │
                                │     └ S3 兼容    │                       │
                                └──────────────────┘                       │
                                          ▲                                │
                                          │ MCP Protocol                   │
                                          │                                │
                                ┌──────────────────┐                       │
                                │  Monolith-MCP    │                       │
                                │  (AI 助手通道)    │                       │
                                │  ├ 写稿 / 审评    │ ──────────────────────┘
                                │  ├ 备份 / 恢复    │   (写入媒体库)
                                │  └ 数据洞察       │
                                └──────────────────┘
```

**分层职责**

| 层级 | 模块 | 关键路径 |
|------|------|---------|
| 边缘网络 | Cloudflare 全球 anycast | 200+ PoPs · 自动 TLS · DDoS 防护 |
| 前端 | React SPA + Pages Functions | `client/src` · `client/functions` |
| 后端 | Hono Workers + Storage Factory | `server/src/index.ts` · `server/src/storage` |
| 持久层 | D1 / Turso / PostgreSQL · R2 / S3 | `server/src/storage/db` · `server/src/storage/object` |
| 智能层 | Monolith-MCP（独立仓库） | [one-ea/Monolith-MCP](https://github.com/one-ea/Monolith-MCP) |

**关键设计决策**

- **适配器模式** — 数据库与对象存储均实现统一接口（`IDatabase` / `IObjectStorage`），切换后端零侵入
- **Pages Functions 反向代理** — 前端域名直连 `/api/*`，规避 CORS 复杂度，同步注入安全头
- **Drizzle ORM** — 所有 SQL 参数化，Schema 一处定义、三端同步生成
- **Monorepo 单脚本部署** — `npm run deploy:cloudflare` 串起迁移 → Workers → Pages 全链路

> 详细架构、模块图与设计决策请参阅 [**Wiki · 架构概览**](https://github.com/one-ea/Monolith/wiki/Architecture)。

---

## 🚀 快速开始

```bash
git clone https://github.com/one-ea/Monolith.git && cd Monolith
npm install
npm run dev
```

> 完整环境准备、密钥配置与本地数据库初始化请参阅 [**Wiki · 快速开始**](https://github.com/one-ea/Monolith/wiki/Quick-Start)。

## ☁️ 部署

```bash
npm run deploy:cloudflare
```

一条命令完成「远程迁移 → Workers → API_BASE 注入 → Pages 前端」全链路，亦支持 GitHub Actions 触发。

> 部署参数、CI 配置与故障排查请参阅 [**Wiki · 部署指南**](https://github.com/one-ea/Monolith/wiki/Deployment)。

---

## 📚 文档导航

| 入口 | 内容 |
|------|------|
| [Wiki](https://github.com/one-ea/Monolith/wiki) | 架构、部署、API、二次开发 |
| [SECURITY.md](./SECURITY.md) | 安全策略与漏洞披露 |
| [PRIVACY.md](./PRIVACY.md) | 隐私政策 |
| [LICENSE](./LICENSE) | MIT 开源协议 |

---

## 🤝 贡献

欢迎通过 [Issue](https://github.com/one-ea/Monolith/issues) 反馈问题，或通过 Pull Request 贡献代码。提交前请阅读 [Wiki · 贡献指南](https://github.com/one-ea/Monolith/wiki/Contributing)。

## 📄 License

基于 [MIT License](./LICENSE) 开源发布。

<div align="center">

<sub>Crafted with ♡ on the edge.</sub>

</div>
