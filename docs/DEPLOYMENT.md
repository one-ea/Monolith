# Monolith 部署指南

> 本文聚焦 Cloudflare 全栈部署。Turso / PostgreSQL 等替代后端见 [Wiki · 存储适配器](https://github.com/one-ea/Monolith/wiki/Storage-Adapters)。

## 5 分钟速通（已有 Cloudflare 账号 + Node ≥ 20）

```bash
git clone https://github.com/one-ea/Monolith.git && cd Monolith
npm install
npx wrangler login          # 浏览器 OAuth 一次
npm run deploy:cloudflare   # 一键全链路
```

执行成功后访问：
- 前端：https://&lt;your-pages-project&gt;.pages.dev
- 后端：https://monolith-server.&lt;subdomain&gt;.workers.dev/api/health → `{"ok":true,...}`

---

## 部署方案对比

| 方案 | 状态 | 优点 | 缺点 |
|------|------|------|------|
| **本机 CLI** `npm run deploy:cloudflare` | ✅ 生产验证 | 全平台支持，预检完善，可调试 | 需本机装 Node + wrangler |
| **GitHub Actions** `deploy-cloudflare.yml` | ⚠️ 待端到端验证 | 推到 main 自动触发，无需本机环境 | CI 端尚未跑通完整链路，验收前请慎用 |
| **手动 wrangler** 分步执行 | 🟡 可用兜底 | 极致掌控、便于排错 | 步骤多易遗漏 |

> **强烈推荐**：首次部署务必走 **本机 CLI**，验证 Cloudflare 资源齐全后再考虑接入 CI。

---

## 一、首次部署完整流程

### 步骤 1 · Cloudflare 侧资源准备

#### 1.1 注册账号 / 准备域名（可选）

无自有域名时，Pages 会自动分配 `*.pages.dev`，Workers 自动分配 `*.workers.dev`，足够生产使用。

#### 1.2 在 Dashboard 创建以下资源

| 资源 | 创建路径 | 默认名称（可改） |
|------|---------|----------------|
| **D1 数据库** | Workers & Pages → D1 → Create database | `monolith-db` |
| **R2 存储桶** | R2 → Create bucket | `monolith-assets` |
| **Pages 项目** | Workers & Pages → Create → Pages → Direct Upload | `monolith-client` |

> Pages 项目首次创建可以选 **Direct Upload** 占位空项目，后续脚本会通过 wrangler 推送真实产物。

#### 1.3 把 D1 ID 填回仓库

创建完 D1 后复制 `database_id`，写入 `server/wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "monolith-db"
database_id = "你刚才复制的-uuid"   # ← 替换这里
migrations_dir = "src/migrations"
```

### 步骤 2 · 本机环境准备

| 工具 | 最低版本 | 验证命令 |
|------|---------|---------|
| Node.js | ≥ 20 | `node -v` |
| npm | ≥ 10 | `npm -v` |
| Git | 任意 | `git --version` |

> Windows 用户建议用 [nvm-windows](https://github.com/coreybutler/nvm-windows) 安装 Node，避免直接安装包路径污染。

### 步骤 3 · 生成必备密钥

Monolith 需要三个 secret，本机生成后由部署脚本写入 Workers：

```bash
# Linux / macOS
export ADMIN_PASSWORD="$(openssl rand -base64 24)"
export JWT_SECRET="$(openssl rand -base64 48)"
export REACTION_SALT="$(openssl rand -hex 16)"
echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"   # 记下来，登录 /admin 用
```

```powershell
# Windows PowerShell
$env:ADMIN_PASSWORD = [Convert]::ToBase64String((1..18 | %{ Get-Random -Max 256 } | %{ [byte]$_ }))
$env:JWT_SECRET     = [Convert]::ToBase64String((1..36 | %{ Get-Random -Max 256 } | %{ [byte]$_ }))
$env:REACTION_SALT  = -join ((48..57)+(97..102) | Get-Random -Count 32 | %{ [char]$_ })
```

| Secret | 用途 | 长度建议 |
|--------|------|---------|
| `ADMIN_PASSWORD` | 后台 `/admin` 登录密码 | ≥ 24 字符 |
| `JWT_SECRET` | Session token 签名密钥 | ≥ 48 字符 |
| `REACTION_SALT` | 文末 Reaction 匿名 ID 加盐 | ≥ 32 字符 |

> 三个 secret 也可以在 Cloudflare Dashboard → 对应 Worker → Settings → Variables and Secrets 手动添加，只要在 deploy 脚本前完成即可。

### 步骤 4 · 一键部署

```bash
npx wrangler login            # 首次执行
npm run deploy:cloudflare
```

脚本会按顺序执行：

```
==> 应用远程数据库迁移          (drizzle-kit + wrangler d1 execute --remote)
==> 写入 Backend 的 ADMIN_PASSWORD / JWT_SECRET   (如已 export)
==> 部署 Cloudflare Workers 后端  (自动从输出抓 workers.dev URL)
==> 写入 Cloudflare Pages 的 API_BASE
==> 构建前端                    (vite build + PWA generateSW)
==> 部署 Cloudflare Pages 前端  (wrangler pages deploy --branch main)
```

### 步骤 5 · 验证

```bash
# 后端健康检查
curl https://monolith-server.<your-subdomain>.workers.dev/api/health
# 应返回: {"ok":true,"db":"d1",...}

# 前端首页
curl -I https://<your-pages-project>.pages.dev
# 应返回 HTTP/2 200
```

浏览器打开 `/admin`，用 `ADMIN_PASSWORD` 登录。看到「主页 / 文章 / 媒体 / 设置」面板即部署成功。

---

## 二、部署脚本参数

`scripts/deploy-cloudflare.mjs` 支持以下参数：

| 参数 | 默认 | 说明 |
|------|------|------|
| `--pages-project <name>` | `monolith-client` | Pages 项目名 |
| `--branch <name>` | `main` | Pages 部署分支（main = production，其余 = preview） |
| `--api-base <url>` | 自动探测 | 手动指定 Workers URL（用于域名定制场景） |
| `--skip-migrate` | false | 跳过远程数据库迁移 |
| `--skip-server` | false | 跳过 Workers 部署 |
| `--skip-client` | false | 跳过 Pages 前端部署 |

示例：

```bash
# 仅重新部署前端（后端无变更时加速）
npm run deploy:cloudflare -- --skip-migrate --skip-server

# 部署到 preview 分支
npm run deploy:cloudflare -- --branch dev

# 自定义 Pages 项目名
npm run deploy:cloudflare -- --pages-project my-blog
```

---

## 三、GitHub Actions 在线部署（⚠️ 待端到端验证）

### 触发方式

`.github/workflows/deploy-cloudflare.yml` 支持两种触发：

1. **自动**：推送到 `main` 且变更命中 `client/**` `server/**` `scripts/**` 等
2. **手动**：Actions 页 → Cloudflare Deploy → Run workflow

### 必备 Repository Secrets

| Secret | 取得位置 |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Dashboard → My Profile → API Tokens → Create Custom Token |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → 任意 Worker / Pages 项目右侧栏 |
| `ADMIN_PASSWORD` | 同步本机生成的值 |
| `JWT_SECRET` | 同步本机生成的值 |

### Token 权限组合（最小化）

- `Account → Cloudflare Pages → Edit`
- `Account → Workers Scripts → Edit`
- `Account → D1 → Edit`
- `Account → Workers R2 Storage → Edit`
- `Zone → Workers Routes → Edit`（如使用自定义域名）

### 已知问题

- 截至 v2.3.0，CI 端尚未跑通完整链路。本机 CLI 修复 Windows 兼容性后，CI 路径需主人单独触发一次 workflow_dispatch 验收
- 在线部署稳定前，**严禁直接推 main 触发自动部署**，请先用本机 CLI 部署，再手动触发 CI 做对比验证

---

## 四、故障排查

### 4.1 脚本卡在「应用远程数据库迁移」（Windows）

**现象**：跑到第一步后无任何输出，进程长时间挂起。

**根因**：v2.3.0 之前的脚本未对 `spawnSync` 启用 `shell:true`，Windows 找不到 `npm.cmd` 时静默挂起。

**解决**：升级到 v2.3.0+，脚本已自动 `shell:true`，并在 ENOENT 时给出明确提示。

### 4.2 `wrangler whoami` 401 Unauthorized

```bash
npx wrangler logout
npx wrangler login
```

或换用 API Token 模式：

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."
npm run deploy:cloudflare
```

### 4.3 D1 迁移报 `database not found`

- 检查 `server/wrangler.toml` 的 `database_id` 是否填对
- 确认 wrangler 当前账户与 D1 所属账户一致：`npx wrangler whoami`

### 4.4 Pages 部署成功但 `/api/*` 404

- 检查 `Cloudflare Pages → Settings → Variables → Production` 是否有 `API_BASE`
- 值应为 Workers 完整 URL，如 `https://monolith-server.<sub>.workers.dev`
- 重新触发一次部署：`npm run deploy:cloudflare -- --skip-migrate --skip-server`（仅前端）

### 4.5 OAuth 部署 429 Too Many Requests

Wrangler OAuth 模式连续部署会触发限流。等待约 60 秒，或切换 API Token：

```bash
export CLOUDFLARE_API_TOKEN="<your-token>"
npm run deploy:cloudflare
```

### 4.6 健康检查 `/health` 返回 404

Worker 仅暴露 `/api/health`，根路径 `/health` 不存在。请用：

```bash
curl https://monolith-server.<sub>.workers.dev/api/health
```

### 4.7 PWA 旧版本不更新

Service Worker 缓存所致。强制刷新：

- Chrome / Edge: F12 → Application → Service Workers → Unregister，再 Ctrl+Shift+R
- 或在 `/admin → 设置 → 缓存` 里点击「清空 PWA 缓存」

---

## 五、手动 wrangler 分步部署（兜底方案）

当一键脚本失败时，可逐步手动执行：

```bash
# 1. 远程数据库迁移
npm -w monolith-server run db:migrate:remote

# 2. 写入 secret
echo "$ADMIN_PASSWORD" | npx wrangler secret put ADMIN_PASSWORD --name monolith-server
echo "$JWT_SECRET"     | npx wrangler secret put JWT_SECRET     --name monolith-server
echo "$REACTION_SALT"  | npx wrangler secret put REACTION_SALT  --name monolith-server

# 3. 部署 Workers
npm -w monolith-server run deploy
# 输出尾部记录 https://monolith-server.<sub>.workers.dev，记下来

# 4. 写入 Pages 的 API_BASE（Production 环境）
echo "https://monolith-server.<sub>.workers.dev" | \
  npx wrangler pages secret put API_BASE --project-name monolith-client --env production

# 5. 构建 + 发布前端
npm -w monolith-client run build
cd client && npx wrangler pages deploy dist \
  --project-name monolith-client --branch main --commit-dirty=true
```

---

## 六、回滚

### 6.1 Workers 回滚

Cloudflare Dashboard → Workers & Pages → monolith-server → Deployments → 选历史版本 → Rollback。

### 6.2 Pages 回滚

Dashboard → Pages → monolith-client → Deployments → 选历史 deployment → 「Rollback to this deployment」。

### 6.3 D1 回滚

D1 不支持原生回滚，但 Cloudflare 自动保留最近 30 天的 PITR 快照：

```bash
npx wrangler d1 time-travel restore monolith-db --bookmark <bookmark-id>
```

获取 bookmark：`npx wrangler d1 time-travel info monolith-db`。

---

## 七、参考链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 时光机](https://developers.cloudflare.com/d1/reference/time-travel/)
- [wrangler CLI 命令参考](https://developers.cloudflare.com/workers/wrangler/commands/)
- [Monolith Wiki · 架构概览](https://github.com/one-ea/Monolith/wiki/Architecture)
- [Monolith Wiki · 故障排查](https://github.com/one-ea/Monolith/wiki/Troubleshooting)

