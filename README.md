# dsh-needy-skin

给 **DSH（DeepSeek Harness）Web 界面**加两个小部件：

| 部件 | 效果 |
| --- | --- |
| 🎲 **随机字样**（`random-hero.mjs`） | 把空态首页的大标题「**探索未至之境** ＋ `预览版`」（英文界面是 *Into the Unknown ＋ Preview*）替换为一份文案列表里**随机抽到的那一组**，左右成对排版；会话头部左上角标题下方也同步显示同一组。默认内置 33 组《主播女孩重度依赖》成就文案，可用 `pairs.json` 换成任意内容。 |
| 🖼️ **随机壁纸**（`random-wallpaper.mjs`） | 每次打开页面从图片目录里**随机挑一张**铺满背景（可放任意张数），自动叠加暗色遮罩 + 主界面毛玻璃，壁纸透出来的同时保证文字可读。没放图片时本部件完全不生效。 |

两个部件都通过 **dsh profile 的 widget 机制**加载，不修改 DSH 本体、不依赖任何 npm 包，卸载就是删掉两行配置。

---

## 效果

```
                       🐟  盈利
                    洗脑・榨取・虎之卷          ← 每次打开随机换一组
```

- **左右成对**：左半是主文案（26px / 主色），右半是副文案（15px / 次级色），整体居中
- **过长自动换行**：一行放不下时，副文案落到第二行（不会挤压变形）
- **会话头部同步**：进入会话后，标题下方会显示同一组文案（紧凑版：14px / 13px）
- **可选自定义图标**：放一张 `assets/icon.png` 就会替换界面里的鲸鱼图标（英雄区 + 会话头部两处）；不放则保持原样

---

## 安装

### 1. 找到你的 dsh profile 目录

```bash
ls ~/.dsh/profiles/          # macOS / Linux
dir %USERPROFILE%\.dsh\profiles   # Windows
```

里面通常是 `web`（`dsh web` 用的那个 profile）。下文以 `~/.dsh/profiles/web` 为例。

### 2. 放入部件文件

把仓库里的东西复制进 profile 目录：

```
~/.dsh/profiles/web/
├── random-hero.mjs          ← 部件一
├── random-wallpaper.mjs     ← 部件二
├── pairs.json               ← 文案（可选，不放就用内置的）
├── wallpaper.json           ← 观感调节（可选）
└── assets/
    ├── icon.png             ← 自定义图标（可选）
    └── bg/                  ← 壁纸图片（任意张数）
        ├── 1.jpg
        └── 2.jpg
```

> 也可以不复制、直接让配置指向本仓库的绝对路径（见下一步的备注）。

### 3. 在 profile 补丁里注册

编辑 `~/.dsh/profiles/web/cordis.patch.yml`，加入（完整示例见 [`examples/cordis.patch.yml`](examples/cordis.patch.yml)）：

```yaml
- insert:
    - id: needy-random-hero
      name: ./random-hero.mjs?v=1

    - id: needy-random-wallpaper
      name: ./random-wallpaper.mjs?v=1
```

- 想只装一个部件，就只留对应那一条。
- `name` 也可以写成绝对路径，例如 `name: /Users/you/dsh-needy-skin/random-hero.mjs?v=1`，这样仓库可以直接当"源"，不必复制文件。
- profile 补丁文件本身会**热加载**，保存后刷新页面即可生效，不需要重启 `dsh web`。

### 4. 刷新页面

打开（或刷新）你的 DSH Web 界面即可看到效果。每次刷新都会重新随机。

---

## 自定义

### 文案：`pairs.json`

放在widget 同目录，两种写法都支持：

```json
[
  ["左半文案", "右半文案"],
  ["Crossing the line", "我只是一个过客 从你的世界路过"]
]
```

```json
{
  "headline": ["探索未至之境", "Into the Unknown"],
  "badge": ["预览版", "Preview"],
  "pairs": [
    ["左半文案", "右半文案"]
  ]
}
```

- `headline` / `badge`：被替换掉的原文案。一般不用改；如果你的界面文案不同（换了语言或 DSH 改了文案），在这里补上对应原文即可，否则部件不会套用。
- 改完 `pairs.json` **刷新页面即可**，不需要动 `?v=` 版本号（文案是每次请求实时读取的）。

### 图标：`assets/icon.(png|jpg|jpeg|webp|svg)`

- 尺寸建议：正方形、≥ 128px，显示时高度 36px（英雄区）/ 24px（会话头部）
- 想跟随界面主题变色，就用 **SVG**（`fill="currentColor"`）；PNG/JPG 不会变色
- 图片加载失败时会自动回退到原版鲸鱼图标，不会出现"裂图"
- 没放图标 = 完全不动原图标

### 壁纸：`assets/bg/`

- 放 **任意张数**图片（jpg / jpeg / png / webp / avif / gif），每次打开随机一张
- 也支持 `bg/`、`needy-bg/`、`assets/wallpaper/`、`wallpaper/` 这些目录名
- 壁纸建议横图（≥1920×1080）；竖图会被 `cover` 裁切

### 观感：`wallpaper.json`

复制 [`wallpaper.example.json`](wallpaper.example.json) 为 `wallpaper.json` 后调整：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `overlay` | `0.3` | 壁纸上的暗色遮罩不透明度，**越大越暗** |
| `blur` | `6` | 主界面毛玻璃半径（px），**越大越糊**，`0` 关闭 |
| `base` | `0.5` | 界面背景主色不透明度，**越小壁纸越透**（越亮） |
| `layer1` / `layer2` / `layer3` | `0.72` / `0.8` / `0.85` | 卡片、浮层、菜单等层级底色不透明度 |

- 壁纸太暗不明显 → 减小 `overlay`、`base`
- 壁纸太亮看不清字 → 增大 `overlay`、`base`
- 改完**刷新页面**即可生效。

---

## 工作原理

两个部件都是 **Cordis widget 模块**（服务端跑在 dsh web 进程里），通过 `ctx.webServer` 做两件事：

1. **注册 HTTP 端点**：`/dsh-needy/hero.js`（客户端脚本，请求时按当前 `pairs.json` 实时生成）、`/dsh-needy/icon`、`/dsh-needy/wallpaper.js`、`/dsh-needy/bg/*`（图片，`no-store`）
2. **用 `tapIndex` 往首页 HTML 注入** `<script defer src="...">`

客户端脚本在浏览器里：

- **随机字样**：等待英雄区渲染后，把 `.pXSMma_headlineText` / `.pXSMma_previewBadge` 两个 span 的文本换成随机文案对并重排样式；同时把新行插入会话头部 `.wSkVaW_header` 的标题行下方。因为 React 会重渲染覆盖，脚本用 `MutationObserver` 持续校正（10 秒内的快速重渲染沿用同一组，避免闪烁）。
  - CSS Module 类名是构建时哈希，可能与你的 DSH 版本不同；脚本带**文本兜底**（按原文案查找元素），但若 DSH 大改结构，可能需要更新选择器。
- **随机壁纸**：往 `<head>` 注入一段 `<style>`：`body` 透明 + 遮罩 + 壁纸、`#root` 透明 + `backdrop-filter` 毛玻璃，并用 `!important` 覆盖设计令牌 `--dsw-alias-bg-base` 等，让壁纸从半透明面板后透出来。

---

## 常见问题

**Q：改了 `.mjs` 文件没生效？**
A：模块有缓存。把补丁里的 `?v=1` 改成 `?v=2`（每次 +1）即可让 dsh 重新加载。改 `pairs.json` / `wallpaper.json` / 图片这类**运行时读取**的内容不需要动版本号。

**Q：会影响正在进行的会话吗？**
A：不会。文案/壁纸是纯前端展示层的改动，不碰会话数据与 agent 行为。

**Q：怎么卸载？**
A：删掉 `cordis.patch.yml` 里对应的 insert 条目（两个部件独立），刷新页面即可；再顺手删掉 `.mjs` 文件。

**Q：壁纸生效了但界面变白/看不清字？**
A：把 `wallpaper.json` 里 `overlay` 和 `base` 调大（例如 `0.5` / `0.7`）。

**Q：`/dsh-needy/bg` 这个路径会不会和别的插件冲突？**
A：命名空间是 `${NS}`（默认 `/dsh-needy`），改 `random-*.mjs` 顶部的 `NS` 常量即可换掉。

---

## 版权说明

- 代码以 **MIT** 许可发布，随意使用/修改/再分发。
- `pairs.json` 与内置默认文案来自游戏 **《主播女孩重度依赖》（NEEDY GIRL OVERDOSE）** 的成就文本，版权归 **WSS playground** 所有，此处仅作个人学习与界面美化用途；如需商用请自行替换为自己拥有权利的内容。
- 仓库不包含任何图片素材：图标与壁纸请自行放入 `assets/`（已在 `.gitignore` 中排除）。
