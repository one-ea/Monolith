# Monolith 品牌规范

Monolith 的视觉标志采用几何化的 **F 方案**：两侧立柱构成抽象的 `M`，中央蓝色核心代表边缘计算、内容流和系统连接。标志在小尺寸下优先保持清晰的轮廓与中央识别点。

## Logo 资源

| 文件 | 用途 | 画布 |
| --- | --- | --- |
| `/monolith-logo.svg` | 深色背景主标，网页和高分屏优先 | 512 × 512 SVG |
| `/monolith-logo-light.svg` | 浅色背景版本 | 512 × 512 SVG |
| `/monolith-logo-mono.svg` | 单色版本，使用 `currentColor` | 512 × 512 SVG |
| `/monolith-lockup.svg` | 标志与 `MONOLITH` 横向组合 | 960 × 256 SVG |
| `/monolith-og.svg` | Open Graph 分享图源文件 | 1200 × 630 SVG |
| `/favicon.png` | 浏览器标签页 | 32 × 32 PNG |
| `/icon-192.png` | PWA、Apple Touch Icon、导航栏回退 | 192 × 192 PNG |
| `/icon-512.png` | PWA 大图标和仓库展示 | 512 × 512 PNG |
| `/og-default.png` | 默认 Open Graph 图片 | 1200 × 630 PNG |

PNG 是部署兼容资源；SVG 是可编辑的主源文件。替换 Logo 时应从 SVG 重新导出全部 PNG，避免同一标志出现几何或颜色偏差。

## 色彩

| 名称 | 色值 | 使用 |
| --- | --- | --- |
| Deep Navy | `#0D1117` | 深色背景、深色图标底色 |
| Cool White | `#F0F6FC` | 深色背景上的标志和文字 |
| Edge Blue | `#4493F8` | 中央核心、强调色、交互重点 |
| Light Canvas | `#F6F8FA` | 浅色图标背景 |
| Light Ink | `#24292F` | 浅色背景上的标志 |
| Light Edge Blue | `#0969DA` | 浅色版本中央核心 |
| Muted Gray | `#8B949E` | 辅助文字和次要信息（不用于主标） |

深色版本使用 `#0D1117 / #F0F6FC / #4493F8`。浅色版本使用 `#F6F8FA / #24292F / #0969DA`。不要在同一个主标中混用两套主题色。

## 尺寸与安全区

- 主标在常规界面中建议不小于 **24 × 24 CSS px**；低于 20px 时使用专门优化的小尺寸图标。
- 横向锁定组合建议不小于 **160px 宽**，文字保持可读。
- 图标四周保留至少 **标志高度的 12.5%** 安全区；方形资源对应 64px（512px 画布）或 24px（192px 画布）。
- Open Graph 画布为 **1200 × 630px**，四周至少保留 80px 内容安全边距；动态标题不得覆盖主标。
- maskable 图标的 Logo 必须位于 Android safe zone 内，主体不得触碰圆形或自适应裁切边缘。

## 使用规则

### 推荐

- 深色页面使用深色主标，浅色页面使用浅色主标。
- 在 favicon、PWA 和分享图中保持相同的 M 几何比例。
- 需要单色输出时使用 `monolith-logo-mono.svg`，通过 CSS 的 `color` 控制颜色。
- 导航栏和高分屏页面优先使用 SVG；PNG 用于浏览器和 PWA 兼容入口。
- Logo 链接应提供可访问名称，例如 `aria-label="Monolith"`。

### 禁止

- 不要拉伸、压扁、倾斜或旋转标志。
- 不要改变中央核心的位置、宽度或颜色。
- 不要添加渐变、投影、描边、纹理或额外图形。
- 不要在低对比度背景上使用主标，也不要把深色版直接放在浅色背景上。
- 不要裁切安全区；不要让文字或文章标题覆盖主标。
- 不要把 `monolith-logo-mono.svg` 当作带品牌蓝色核心的彩色版本使用。

## 文件变更检查

运行下面的脚本可以检查品牌资源是否存在、尺寸是否正确、SVG 是否包含必要的结构和品牌色：

```bash
node scripts/check-brand-assets.mjs
```

脚本只读取本地资源，不访问网络，也不会修改文件。新增或替换资源后应在提交前运行一次。
