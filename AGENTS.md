# Monolith 项目规则

## 项目概览
Monolith 是基于 Cloudflare 边缘计算的全栈博客系统。
- 前端：Vite 6 + React 19 + Tailwind CSS v4 + shadcn/ui + wouter
- 后端：Hono Workers + Drizzle ORM
- 代理层：Pages Functions（反向代理 /api/* /cdn/* /rss.xml）
- 存储：D1 (SQLite) + R2 (对象存储)，支持 Turso/PostgreSQL/S3 切换
- 主题：OKLCH 色彩空间双主题系统（暗色 Slate & Cyan / 亮色模式）

## 架构要点
- 存储层采用适配器模式：路由只依赖 `IDatabase` / `IObjectStorage` 接口，通过 `DB_PROVIDER` / `STORAGE_PROVIDER` 环境变量切换适配器
- Pages Functions 代理层拦截 `/api/*`、`/cdn/*`、`/rss.xml`，转发到 Workers
- Pages Functions 的 `tsconfig.json` 独立引入 `@cloudflare/workers-types`，避免与主项目 DOM 类型冲突
- DOMPurify 净化 Markdown 渲染输出，白名单允许 iframe/video 嵌入
- `searchPosts()` 只搜索 `title + excerpt`，不扫描 `content` 大字段

## 工作区路径
- 项目根目录：`/home/easy/001/Monolith`
- 客户端：`/home/easy/001/Monolith/client`
- 服务端：`/home/easy/001/Monolith/server`

## 分支管理
- 生产分支：`main`（Cloudflare Pages 自动部署绑定）
- 开发分支：`dev`
- 工作流：dev 开发 → commit → push → PR → squash merge 到 main → 部署
- 严禁直接向 main 推送

## 常用命令
- `npm run dev` — 同时启动前后端（client :5173, server :8787）
- `npm run dev:client` / `npm run dev:server` — 单独启动
- `npm run build` — 构建前端
- `npm run deploy:cloudflare` — 一键部署（迁移 + Workers + Pages）
- `npm run db:migrate:local` / `db:migrate:remote` — 数据库迁移
- Node.js 需要 `source $HOME/.nvm/nvm.sh` 后才可用

## 部署铁律
- 使用 `npm run deploy:cloudflare` 一键部署，禁止手动 `wrangler pages deploy`
- 必须从 `client/` 目录部署 `dist`，否则 Pages Functions 会被遗漏
- `package-lock.json` 绝不能放入 `.gitignore`
- CI "Sync Worker secrets" 步骤通过 `wrangler secret put` 注入 ADMIN_PASSWORD / JWT_SECRET

## 踩坑记录（项目特有）
- D1 迁移标记不同步时需手动 `INSERT INTO d1_migrations`
- Cloudflare CDN 有短暂缓存，验证时用部署唯一 URL
- 本地 `client/functions/api/` 目录的 tsconfig 独立，不与主项目混用
- Hono v4 `verify()` 需要 3 个参数：`verify(token, secret, "HS256")`

## 记忆库
项目记忆库路径：`.agents/memory_bank/`
- `README.md` — 索引入口
- `monolith_architecture.md` — 完整架构手册
- `monolith_roadmap.md` — 功能路线图
- `monolith_v1_status.md` — V1 状态报告
- `system_config.md` — 系统配置与凭据
- `ui_design_parameters.md` — UI 排版设计规范
- `typecho_dev_guide.md` — Typecho 开发指南（已弃用项目）

## CI 与安全
- 仓库：`https://github.com/one-ea/Monolith`
- GitHub PAT：已配置在 system_config.md
- 后台密码：`monolith2026`
- 分支保护：main 需要 1 人审批 + 线性历史 + 状态检查