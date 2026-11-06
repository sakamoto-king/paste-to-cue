# Paste to Cue · v4.0

> 粘贴带样式文稿，开口即自动跟读 · Paste rich scripts. Speak, and it scrolls with your voice.

**Live demo:** [https://sakamoto-king.github.io/paste-to-cue/](https://sakamoto-king.github.io/paste-to-cue/)

单文件 `index.html`，本地打开或直接用 GitHub Pages 在线体验；文稿与配置保存在本机浏览器（`localStorage: paste-to-cue-v4.0`）。浏览器语音使用厂商识别服务，可选本地流式引擎在本机处理音频。
A single-file `index.html` — open locally or use the GitHub Pages demo. Scripts and settings stay in this browser (`localStorage: paste-to-cue-v4.0`). Browser Speech uses the browser vendor’s service. Optional Local Streaming processes audio on this machine.

---

## 中文

### 三态流转
| 视图 | 进入方式 | 用途 |
| --- | --- | --- |
| **首页 Home** | 首次打开 / 点左上角 Logo 或「首页」 | 单框富文本粘贴（`contenteditable`，飞书 / Word / Notion 的加粗、字色、荧光笔、表格原样保留）→「一键导入并准备」直达提词台；「智能格式化导入」顺便拆段排版；「进入编辑台」先改字。已有文稿时显示「继续当前文稿：《标题》（N 段）」胶囊。 |
| **整备台 Setup**（`#edit`） | 首页「进入编辑台」/ 提词台按 `Esc` | 左侧目录全文显示（无省略号，可勾选、可拖宽）；格式化（保留原标记）/ AI 标重音 / 还原；字号、画幅、镜像、示例稿。 |
| **提词台 Cue**（`#cue`） | 「一键导入并准备」/「进入提词准备」/「语音开拍」 | 左 8 右 2 满屏；左上角「← 返回整备 · 03 / 19」；40%（五分之二）视线；已读段落淡出；左下角语音监控小窗；右侧三段全高触控栏 + 缩放 / 灵敏度滑块。 |

### 视觉
- **暗色 = A · shadcn/ui Zinc Dark**（`#09090b`，纯白加粗 + 底横线重音，深灰描边胶囊关键词）
- **浅色 = D · Vercel Geist Paper Light**（`#FAF9F6`，墨黑正文，`#0070F3` 电光蓝下划线 / 淡蓝胶囊关键词）
- 全部图标为 Lucide 1.5px 线性 SVG，零 Emoji。
- 粘贴的近黑 / 近白中性字色（且无底色）会被剥离、继承主题前景色，两套主题切换都清晰可读；彩色字与荧光笔底色原样保留。

### 中英双语
- 右上角 `中文 | EN` 一键切换全站文案（无需刷新），记忆在本机。
- 识别语言默认「自动」：文稿英文单词占比 > 55% 用 `en-US`，否则 `zh-CN`；也可在右上角「配置」里手动指定。
- 中文跟读：内置离线拼音表 + 平翘舌 / 前后鼻音模糊匹配。
- 英文跟读：整词 token；完全一致 1.0、数字词互认（`seven ↔ 7`、`sixty ↔ 60`、`first ↔ 1st`）0.95、词干 / 编辑距离 ≤1 / 公共前缀 ≥75%（`optimizing ↔ optimize`、`ads ↔ ad`）0.86；自动过滤 `um / uh / er / ah / hmm / like / you know`。

### 排版与缩放
- **50%–500%** 真实字号重排缩放，最外层铁壁防横向溢出；行距约 **1.34**。
- 「格式化」清除飞书 / Word 固定列宽与字号，**完整保留**加粗、字色、荧光笔底色与下划线。

### 快捷键
`空格` 匀速开始/暂停 · `W/S` 调速 · `M` 镜像 · `L` 目录 · `F` 全屏 · `+/-` 缩放（50%–500%）· `Esc` 返回整备 · `?` 帮助 · 首页 `Ctrl+Enter` 一键导入

### 本地流式识别（可选）
GitHub Pages / 单 HTML 的浏览器语音模式无需安装。需要本机低延迟中英识别时，Windows 运行 `./local-asr/start.ps1`，macOS / Linux 运行 `bash local-asr/start.sh`。
首次启动会安装依赖并下载模型，默认监听 `ws://127.0.0.1:5329`。设置与语音监控窗均可切换引擎。
「自动」最多等待本地 ready 350 ms，连接失败或中途掉线后使用浏览器语音。「本地流式引擎」在离线时显示启动提示。
麦克风授权及浏览器的本地网络权限需要用户允许。详细配置与协议见 [local-asr/README.md](local-asr/README.md)。

### 语音识别说明
浏览器 Web Speech API 需要联网：Microsoft Edge 走微软语音（国内一般可直连）；Chrome 走其云端语音（国内通常需代理）。没有麦克风可点「模拟试读」看效果。

---

## English

### Three views
| View | How to get there | What it's for |
| --- | --- | --- |
| **Home** | First visit / click the logo or "Home" | One rich-text paste box (`contenteditable`, keeps bold, colors, highlights and tables from Docs / Word / Notion / Lark). "Import & Cue" goes straight to the cue stage; "Smart Format" also splits it into tidy paragraphs; "Open in Editor" lets you edit first. A "Resume current script" pill appears when a script exists. |
| **Editor** (`#edit`) | "Open in Editor" / `Esc` from the cue stage | Full outline (never truncated), Format (keeps marks), AI Emphasis, Revert, text size, frame, mirror, sample script. |
| **Cue stage** (`#cue`) | "Import & Cue" / "Get Ready" / "Voice Take" | 8:2 full screen, "← Back to Edit · 03 / 19" pill, eyeline at 40% (2/5), read paragraphs fade, voice monitor bottom-left, three-zone touch rail plus zoom / sensitivity sliders on the right. |

### Look
Dark = **shadcn/ui Zinc** (`#09090b`), light = **Vercel Geist Paper** (`#FAF9F6`, `#0070F3` accents). Lucide 1.5px line icons, no emoji.

### Bilingual
`中文 | EN` switches all UI text instantly. Recognition language is **Auto** by default (`en-US` when > 55% of the script is English words, otherwise `zh-CN`), or set it in Settings. Chinese matching uses a built-in offline pinyin table; English matching is word-level with number words (`seven ↔ 7`), stems (`optimizing ↔ optimize`, `ads ↔ ad`) and filler removal (`um`, `uh`, `like`, `you know` …).

### Layout & zoom
**50%–500%** real font-size reflow with zero horizontal overflow; ~**1.34** line height. Format strips fixed column widths / font sizes while **keeping** bold, colors, highlights and underlines.

### Shortcuts
`Space` start/pause · `W/S` speed · `M` mirror · `L` outline · `F` full screen · `+/-` zoom (50%–500%) · `Esc` back to edit · `?` help · `Ctrl+Enter` on Home = Import & Cue

### Optional Local Streaming
GitHub Pages / single HTML Browser Speech requires no installation. For on-device bilingual streaming, run `./local-asr/start.ps1` on Windows or `bash local-asr/start.sh` on macOS / Linux.
The first run installs dependencies and downloads the model. The default endpoint is `ws://127.0.0.1:5329`.
Choose Auto, Local Streaming or Browser Speech in Settings or the voice monitor. Auto waits up to 350 ms for local readiness and falls back to Browser Speech on failure or a dropped connection.
Allow microphone and local-network permissions if prompted. See [local-asr/README.md](local-asr/README.md).

### Speech recognition
The Web Speech API needs a network connection. Microsoft Edge uses Microsoft's service; Chrome uses its cloud speech service (often blocked in mainland China). No mic? Click "Simulate".

---

### Upgrade from v3.3
Scripts, zoom, eyeline and follow settings saved by v3.3 / v3.2 are carried over automatically. MIT License.

### Defaults and migration / 默认与迁移
默认视线为 40%（五分之二），向前匹配窗口为 90。v4.0 / v3.3 / v3.2 / v3 / v2 中的旧默认 23% / 34% 与窗口 40 自动迁移，手动拖动保存的设置和其他自定义值保留。
The default eyeline is 40% (2/5), with a 90-token look-ahead. Legacy default values migrate automatically. Custom values and explicitly saved manual overrides are retained.

### Automated tests / 自动测试
Run `node --test tests/*.test.mjs` with Node 24, installed Edge / Chrome, the local Python environment and model test WAVs. Tests use ephemeral ports and isolated browser profiles, and clean up their own children.
