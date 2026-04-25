# 贡献指南

感谢有意为 **Monolith** 出力 ❤️ — 本指南描述本仓库的协作约定，请在动手前快速阅读。

## 分支策略

```
main  ←── PR (squash merge) ←── dev / feat-* / fix-* / chore-*
```

- `main` 为生产分支，**禁止直推**，受分支保护策略约束
- 日常开发在 `dev` 或主题分支（`feat/*`、`fix/*`、`chore/*`）
- 通过 Pull Request 合并到 `main`，**统一使用 squash merge** 保持线性历史

## 提交信息规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
type(scope): description

[optional body]
```

常用 `type`：

| type | 用途 |
|------|------|
| `feat` | 新增功能 |
| `fix` | 修复 Bug |
| `chore` | 构建脚本 / 依赖 / 杂项维护 |
| `docs` | 文档 |
| `refactor` | 重构（无行为变化） |
| `perf` | 性能优化 |
| `test` | 测试 |
| `ci` | CI/CD |

## 本地开发

```bash
# 一次性安装
nvm use            # 读取 .nvmrc，使用 Node 20
npm install

# 同时启动前后端
npm run dev        # client :5173 · server :8787

# 构建
npm run build

# 类型检查 / 代码风格
npm run check
npm run lint
```

## 数据库改动守则

涉及 `server/src/db/schema.ts` 的任何改动必须：

1. 同步更新 `schema-pg.ts`（PostgreSQL 适配器）
2. 三个适配器（D1 / Turso / PostgreSQL）行为保持一致
3. 用 `drizzle-kit generate` 生成迁移，**人工审核 SQL**
4. 新增列必须有 `DEFAULT` 值，避免存量记录崩溃
5. 禁止 `sql.raw()` 拼接，必须参数化

## UI 改动守则

- 同时适配 **暗色 / 亮色** 双主题
- 三档响应式：移动端 / 平板 / 桌面端
- 间距使用偶数模数（2 / 4 / 8 / 12 / 16 / 20px）
- 中文字体 `letter-spacing: 0`，英文大标题 > 22px 使用负向字距

## 部署

主流程统一走：

```bash
npm run deploy:cloudflare   # 远程迁移 + Workers + Pages 一键发布
```

详细步骤见 [Wiki · Deployment](https://github.com/one-ea/Monolith/wiki/Deployment)。

## 提 PR 前自查清单

- [ ] 已基于最新 `main` rebase 或 merge
- [ ] `npm run check` 通过
- [ ] `npm run lint` 零警告
- [ ] 提交信息符合 Conventional Commits
- [ ] 涉及 schema 改动已同步三适配器
- [ ] 涉及 UI 改动已通过双主题与响应式自检
- [ ] 不包含敏感信息（密钥 / Token / 凭据）

## 问题反馈

- Bug：使用 [Bug Report](https://github.com/one-ea/Monolith/issues/new?template=bug_report.md) 模板
- 功能建议：使用 [Feature Request](https://github.com/one-ea/Monolith/issues/new?template=feature_request.md) 模板
- 安全漏洞：请按 [SECURITY.md](./SECURITY.md) 流程私下汇报，**不要**直接提公开 Issue

---

更详细的开发文档见 [项目 Wiki](https://github.com/one-ea/Monolith/wiki)。
