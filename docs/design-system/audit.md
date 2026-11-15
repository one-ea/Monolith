# Monolith 双主题 Design System — 现状审计与迁移清单（Phase 1）

> 依据 `tmp/Monolith-双主题-Design-System-任务书.md` 执行要求产出：审计现有 UI → 差距 → 可复用资产 → Token 映射 → 分阶段实施清单。
> 审计范围：`client/src/app.tsx`、`client/src/components/**`、`client/src/pages/**`、`client/src/globals.css`、`client/index.html`、`server/src/index.ts`（设置白名单）。

## 1. 现状盘点

### 1.1 主题体系（现状）

站点主题 = **控制台全站设置**，三段链路：

```
server /api/settings/public（白名单归一化）
  → cookie `monolith_site_theme`（首屏内联脚本同步，防 FOUC）
  → index.html 内联脚本在 React 挂载前写 data-theme / data-style
  → SiteSettingsProvider 加载公共设置后 applySiteTheme() 校正
```

现有两轴：

| 轴 | 属性 | 取值 | 说明 |
|----|------|------|------|
| 明暗 | `data-theme` | `dark`(默认)/`light`，设置支持 `system` | GitHub Primer 语义色（`#0d1117` / `#ffffff` 基底） |
| 风格 | `data-style` | `default` / `fluid` | `fluid` = 液态玻璃主题（青紫光斑 + 玻璃 token + 弹簧动画，2026-08 本地增强） |

**与任务书冲突点**：任务书要求 `<html data-theme="apple">`，即 `data-theme` 应表达**设计语言**而非明暗。现有 `data-theme` 的明暗语义需要迁移到独立轴。

### 1.2 Token 现状（globals.css，2977 行单文件）

- **shadcn 语义色**（--background/--foreground/--card/--popover/--primary/--secondary/--muted/--accent/--destructive/--border/--input/--ring/--chart-1..5/--sidebar*）：✅ 已语义化，组件几乎全部通过 Tailwind 语义类消费（`bg-card` / `text-muted-foreground` / `border-border`）。
- **半径**：单一 `--radius: 0.625rem` 派生 `--radius-sm..4xl`（×0.6~×2.6）。
- **排版**：Work Sans（正文）/ Space Grotesk（标题，被错误挂到 `--font-mono`）双字体 + Google Fonts 运行时导入；标题字号硬编码在 `@layer base`（h1~h4）与组件 className 中；**无 Typography Token 层**。
- **间距**：组件统一 Tailwind 4px 数值刻度（p-[16px] 等），符合 4/8 律，但属"隐式 token"。
- **阴影/材质**：无 elevation token；`backdrop-blur` 直接散落在 navbar/admin-layout/sheet 等处；fluid 风格有 `--glass-border`/`--border-strong` 两个材质变量。
- **动效**：`cubic-bezier(0.16,1,0.3,1)` 苹果阻尼曲线全局统一；fluid 风格覆写为弹簧曲线 `cubic-bezier(0.34,1.56,0.64,1)`；已有全局 `prefers-reduced-motion` 降级。**无 motion token**（时长/缓动散落硬编码）。
- **组件态**：状态色靠 Tailwind 透明度后缀（`hover:bg-muted`、`disabled:opacity-50`），无 state-layer token。
- **领域变量块**：prose / code / hljs / toc / series / reaction / analytics 七大块、每主题 ×3 重复定义（default dark / default light / fluid dark / fluid light），共约 400+ 行 × 4。**这是主题扩展成本的主要来源：每加一个主题需复制全部变量。**

### 1.3 组件层现状

`client/src/components/ui/`：仅 button / badge / sheet / separator（shadcn + Base UI 实现，cva 管变体）。业务组件（navbar、article-card、admin-layout、search、reading-controls 等）直接组合语义类，未沉淀 Input/Card/Dialog/Tabs/Tooltip/Popover 等基础件——admin 页面存在大量手写 `<input>`/`<button>` 模式（如 settings.tsx 1406 行）。

### 1.4 硬编码色彩残留

`text-zinc-*` 等非语义类仅 2 处文件：app.tsx（loading 兜底 ×4）、admin/dashboard.tsx（×9）。品牌固定色（logo mask `#4493f8`、阅读模式四主题、tag-hue 六色）属**内容级固定色**，保留。

## 2. 差距（目标 vs 现状）

| 目标 | 现状 | 差距 |
|------|------|------|
| `data-theme = apple \| pixel` | `data-theme = dark \| light` | 明暗轴需迁到 `data-mode`，`data-theme` 让位给设计语言 |
| Surface 五级层级 | card/muted 两级 | 需新增 surface-container-low..highest 语义 |
| Typography Token（13 角色） | 字号散落组件 | 需 token 层 + `text-*` 工具类 |
| Motion Token | 曲线硬编码 | 需 duration/easing/spring token + 主题化 |
| Elevation/Material token | 无 | 需 shadow 分级 + glass 材质收敛到 header/overlay 层级 |
| 语义色 success/warning/error/info | 仅 destructive + chart | 需补全状态语义色 |
| 组件规范（Button 7 变体 / Input / Card / Dialog / Tabs…） | 仅 4 个基础件 | Phase 4 沉淀，禁止复制组件 |
| Icon 抽象 `<Icon name=… />` | 直接 import lucide | 需注册表映射层（Lucide 默认实现） |
| 主题切换不刷新/不丢状态 | applySiteTheme 已是热切换 | ✅ 可直接复用 |
| 扩展 system/light/dark | mode 轴已支持 system | ✅ 三轴天然兼容 |

## 3. 可直接复用的资产

- shadcn 语义变量名（--background 等）**就是集成缝**：Apple/Pixel 主题只要重定义同一组变量，全部现有页面自动换肤，无需改页面。
- `applySiteTheme` 热切换 + cookie 首屏同步 + `prefers-color-scheme` 跟随——主题引擎骨架直接沿用并扩展。
- Base UI 行为层（Dialog/Popover/Select/Focus 管理）继续承载，视觉层走 token。
- prose/code/hljs 等领域变量块：变量名即消费接口，各主题只需重赋值。
- fluid 风格整块（LOCAL MOD）继续作为独立风格轴叠加生效。

## 4. Token 映射（新语义层 → 旧变量桥接）

新语义 token 全集（`lib/theme/tokens.css` 定义基线，主题文件覆盖）：

```
背景/表面   background / background-secondary
           surface / surface-secondary / surface-elevated
           surface-container-low / - / -high / -highest
前景       foreground / -secondary / -tertiary / -disabled
品牌       primary(-foreground/-container) secondary(-foreground/-container)
           accent(-foreground) tertiary(-container)
状态       success / warning / error / info (+ on-*)
边框       border / border-subtle / border-strong / focus-ring
```

**旧变量桥接**（每个主题块内重定义，保证存量组件零改动换肤）：

| 旧（shadcn） | 新语义来源 |
|---|---|
| `--background` / `--foreground` | background / foreground |
| `--card` / `--card-foreground` | surface / foreground |
| `--popover` / `--popover-foreground` | surface-elevated / foreground |
| `--muted` / `--muted-foreground` | surface-container / foreground-secondary |
| `--secondary` / `--accent` | secondary / surface-container-high |
| `--border` / `--input` | border / border-strong |
| `--ring` | focus-ring |
| `--destructive` | error |
| `--sidebar*` | surface 系映射 |

Typography：`--type-{role}-size/line-height/weight/tracking`（13 角色），Tailwind `@theme inline` 暴露为 `text-display` … `text-code`；字体栈 `--font-ui` / `--font-display` / `--font-mono` 由主题覆盖（Apple=系统栈，Pixel=Google Sans 系统栈，均不新增运行时字体下载）。

Radius：沿用 `--radius` 派生制 + 新增 `--radius-pill`；Apple `--radius: 0.625rem`、Pixel `--radius: 1rem`（M3 尺度感），主题可对角色单独覆盖。

Motion：`--motion-{fast|normal|slow}`、`--ease-{standard|emphasized|decelerate|accelerate}`、`--spring-{soft|medium|bouncy}`；Apple 覆盖为 HIG 平滑连续系，Pixel 覆盖为弹簧系。

Elevation：`--shadow-e1/e2/e3` + `--shadow-glass`（配合 `--material-blur`/`--material-tint`），Liquid Glass 仅允许 header/toolbar/sheet/overlay/floating 层。

State：`--state-hover / --state-pressed / --state-dragged`（交互态叠加层透明度），供主题调"反馈强度"（Pixel 更强、Apple 更克制）。

## 5. 主题轴架构（决策）

```
data-mode   = dark | light          （明暗；承接原 data-theme 语义 + system 解析）
data-theme  = classic | apple | pixel
                                      （设计语言；任务书 §4/§21 语义。**默认 classic**
                                      = GitHub Primer 基线，走 globals.css 兜底块；
                                      apple = HIG · Liquid Glass，接替原 fluid 液态玻璃
                                      风格轴（该轴已于 2026-09-28 移除）；
                                      pixel = Material 3 Expressive）
```

> 2026-09-28 定稿调整：Classic Primer 为站点默认主题；`data-style="fluid"` 液态玻璃轴整块移除
> （原 LOCAL MOD，git 历史可回溯），玻璃质感角色由 Apple Theme 承担；cookie 简化为 `mode|design`，
> 旧 `mode|style|design` / `mode|style` 格式兼容解析。

- CSS 特异性：主题块用 `:root[data-theme="apple"], :root[data-theme="apple"][data-mode="dark"]` 成对选择器（0,3,0）压过 Primer light 块（0,2,0）；fluid 块在文件更后方、同为 0,3,0 时后者胜出，叠加语义不变。
- 持久化：沿用 **cookie + 控制台全站设置**（本站既定产品决策：主题由管理员统一控制，前台无访客切换），格式升级 `mode|style|design`，向后兼容两段解析。任务书 §21 的"localStorage 优先"以 cookie 等价落实（同为首屏同步本地存储），为未来访客级覆盖预留 `monolith_theme_design` localStorage 键读取优先级。
- 明暗 × 设计语言构成任务书 §4 的 apple-light / apple-dark / pixel-light / pixel-dark 四象限，`system` 在 mode 轴解析。

## 6. 迁移清单（Phase 4 → 7 执行序）

**Phase 2（本次）**：`lib/theme/{tokens,apple,pixel,motion}.css` + Tailwind `@theme inline` 桥接 + globals.css 明暗轴改名（data-theme→data-mode）。
**Phase 3（本次）**：`lib/theme/theme.ts`（三轴 apply/normalize/持久化）+ `hooks/use-theme.ts` + index.html 内联脚本升级 + site-settings/admin-login 引用迁移 + server 白名单加 `site_theme_design`。
**Phase 4（本次）**：ui/ 沉淀 input / card / dialog / tabs / tooltip / popover / segmented-control / icon；Button 扩展 primary/tertiary/tonal 变体与 loading 态。
**Phase 5/6（本次，样式层）**：apple.css / pixel.css 完整定义（色、字、径、影、材质、动效、导航层样式）；navbar/卡片按主题差异化（Apple: 玻璃 header + 下划线选中；Pixel: 容器底 + 胶囊指示器 + tonal 态）。
**Phase 7（后续迭代）**：admin 页面手写控件逐页替换为 ui/ 基础件；`text-zinc-*` 残留清理（app.tsx / dashboard.tsx）。
**Phase 8（每批 UI 改动后）**：按 `skills/ui-dual-theme-audit` 双主题 × 375/768/1440 × reduced-motion 自检；对比度按 WCAG AA 抽查。

## 7. 验收红线（对齐任务书 §28）

- 同一套组件 API，两主题仅靠 `data-theme` 切换；禁止复制业务组件/页面。
- TypeScript strict / ESLint / production build 全绿；主题切换不刷新、不丢状态、不闪变。
- Liquid Glass 仅限 header / sheet / overlay / floating 层，且 `backdrop-filter` 有不透明降级（`@supports` + 低性能环境）。
- 所有动效尊重 `prefers-reduced-motion`。
- 不改数据库 schema、不改 API 契约（新增公开设置键为增量字段）。
