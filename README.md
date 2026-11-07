# Paste to Cue · v1.2

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
- 英文跟读：整词 token；完全一致 1.0、数字词互认（`seven  /  7`、`sixty  /  60`、`first  /  1st`）0.95、词干 / 编辑距离 ≤1 / 公共前缀 ≥75%（`optimizing  /  optimize`、`ads  /  ad`）0.86；自动过滤 `um / uh / er / ah / hmm / like / you know`。

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
`中文 | EN` switches all UI text instantly. Recognition language is **Auto** by default (`en-US` when > 55% of the script is English words, otherwise `zh-CN`), or set it in Settings. Chinese matching uses a built-in offline pinyin table; English matching is word-level with number words (`seven  /  7`), stems (`optimizing  /  optimize`, `ads  /  ad`) and filler removal (`um`, `uh`, `like`, `you know` …).

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

### v1.2 release / 版本更新

搜索范围是**当前屏幕可见文字，加屏幕外上方 2 行、下方 3 行实际文字**。设置中「屏幕外上方多搜几行 / 屏幕外下方多搜几行」可分别调到 0–10；0 表示该方向不补搜屏幕外文字。行数根据文字的实际矩形计算，包含表格单元格和折行，不按段落数或估算行高计算。字号、缩放、窗口、舞台大小和滚动变化会更新范围；隐藏首页没有可匹配候选，编辑台按其实际视口计算。

The search covers **the text currently visible on screen, plus 2 actual text lines above and 3 below**. Settings has separate “Extra lines above screen / Extra lines below screen” controls from 0–10; zero adds no off-screen lines in that direction. Lines come from actual rendered text rectangles, including wrapped table cells, rather than paragraph counts or estimated line heights. Font, zoom, viewport, stage size and scrolling update membership. Hidden Home has no matching candidates; the editor uses its actual viewport.

范围内部最多保留 600 个有效字词（中文字符 / 英文单词），从离当前阅读锚点最远的两端裁掉，尽量保留连续范围；匹配与命令共用同一份裁剪结果。此上限没有设置项。屏幕范围之外不再另搜未来几段的段首，范围内仍可跳读。相同或相近证据优先选离当前阅读位置较近的句子；更长、更独特的有效证据可以胜过距离优势。重读前面一两行或一两段仍可平滑倒回，较远回退需要至少 8 个有效命中、连续 6 个命中、更高质量和足够不同的文字，重复短语会留在原位。v1.1 的口吃去重、数字归一化、40% 视线、清空识别与粘滞滚动保留。

The shared matcher/command membership has an internal limit of 600 effective Chinese characters / English words. The farthest endpoints from the reading anchor are trimmed first, preserving a contiguous range where possible. There is no cap control. Paragraph heads outside this screen-derived scope are not searched; jump reading within it remains supported. Equal or comparable evidence favors the nearer occurrence, while longer distinctive evidence can outweigh proximity. Rereading previous lines or paragraphs still rewinds smoothly. Backtracking needs at least 8 matched tokens, a run of 6, stronger quality and enough distinct text; short repetitions hold position. v1.1 stutter tolerance, number normalization, 40% eyeline, recognition clearing and sticky scrolling remain.

设置中可添加、编辑、删除命令文本和动作，自动保存在本浏览器。默认包含「上一页 / 下一页 / 回到顶部」和「previous page / next page / back to top」，两套语言均可用；可选动作仅限上一页、下一页、顶部、上一段、下一段。英文按整词匹配。必须单独说完整命令，并等识别 final 才执行；interim 候选先隐藏，完整句子里顺带提到命令不会触发。对应命令完整出现在同一份屏幕可见加额外文字行范围内时，按稿文跟读；范围外或被上限裁掉的内容不抑制命令。文档别处出现相同命令仍可触发。

Add, edit or delete command text and actions in Settings; changes persist in this browser. Both Chinese and English defaults are available. Actions are restricted to previous/next page, top and previous/next paragraph. English uses whole words. Say a complete command on its own and wait for final recognition; interim candidates are withheld, while incidental mentions in longer sentences remain ordinary speech. A complete command inside the exact same visible-plus-extra-lines membership is treated as script. Text outside it, including text dropped by the cap, does not suppress commands. An occurrence elsewhere in the document does not block it.

命令从匹配和字幕缓冲中移除。浏览器封住已完成结果槽并检查识别 epoch；本地引擎消费命令后通过 reset/ack 切换序列，拒绝旧序列结果。相同命令在 1.5 秒内的重复 final 视为重传；要连续执行两次相同动作，请间隔 1.5 秒。自定义命令只接受清理后的纯文本，最多 32 条，每条 80 字，无代码执行能力。

Commands are removed from matching and subtitle buffers. Browser results use closed final slots and recognition epochs; Local Streaming resets its sequence after a command and rejects stale messages until reset acknowledgement. Repeated identical command endpoints within 1.5 seconds count as retransmissions; leave 1.5 seconds between intentional repeats. Up to 32 sanitized plain-text commands of 80 characters are supported. Settings cannot execute code.

粘贴、导入、载入稿文或示例时，冲突对话框列出命令及段落号，说明「这些位置附近不会触发」。可直接去编辑命令，或点「知道了」继续。标题不计段落，表格逐行只统计口播单元格，普通正文按段落计数。同一次粘贴再导入及后台 token 重建不会反复弹窗。全新首页不会为尚未选择的内置示例弹窗；选择示例后会提示。插入的富文本在进入页面前移除脚本、事件属性和嵌入内容。

Pasting, importing or loading scripts and samples lists conflicting phrases and paragraph numbers in an accessible dialog: “These commands will not trigger near these passages”. Choose “Go edit commands” or “Got it”. Headings are excluded; each table spoken cell counts as one paragraph. Importing an already reviewed paste and rebuilding tokens do not repeat the dialog. The initial Home does not interrupt users for an unselected built-in sample. Inserted rich text is stripped of scripts, event attributes and embedded active content before entering the page.

### Defaults and migration / 默认与迁移

发布版本为 v1.2，沿用内部存储键 `paste-to-cue-v4.0`，继续读取 v3.3 / v3.2 / v3 / v2。所有旧字词窗口设置，包括旧默认 40、90/8 及带手动标记的自定义字词数，都迁移为上方 2 行、下方 3 行，旧键从新保存的配置中移除。新设置使用 `lineWindowVer: 1`、`extraAboveLines`、`extraBelowLines`；仅当版本正确且两个值都是 0–10 的整数时原样保留，包括 0。缺少版本或任一数值无效时，两项均回到 2/3，不把旧字词数解释成行数。文稿、命令、主题、缩放等设置不受影响。旧默认视线 23% / 34% 在没有 `eyeLineVer: 2` 时仍迁移为 40%；明确保存的手动视线保留。

Release v1.2 retains the internal `paste-to-cue-v4.0` storage key and reads v3.3 / v3.2 / v3 / v2. All old token-count windows, including stock 40, older 90/8 and deliberate custom counts, migrate to 2 lines above / 3 below. Old keys are removed from newly saved settings. New keys are `lineWindowVer: 1`, `extraAboveLines` and `extraBelowLines`. They persist only with the correct version and two integer values from 0–10, including zero. A missing version or invalid value resets both to 2/3; token counts are never interpreted as lines. Scripts, commands, theme and zoom remain intact. Legacy eyelines 23% / 34% still migrate to 40% unless `eyeLineVer: 2` records a manual choice.

### Automated tests / 自动测试

需要 Node 24、已安装的 Edge / Chrome，以及现有本地 Python 环境与模型 WAV。无需 npm install 或构建。运行全部测试：

Requires Node 24, installed Edge / Chrome and the existing local Python environment with model WAVs. No npm install or build is needed:

```powershell
npm test
# Equivalent / 等价
node --test --test-concurrency=1 tests/*.test.mjs
```

`CUE_BROWSER` 可指定浏览器可执行文件，`CUE_PYTHON` 可指定装有现有 ASR 依赖的 Python。测试通过端口 0 分配临时端口和独立浏览器 profile，只清理自身创建的子进程。按文件串行运行，避免并发模型与浏览器负载干扰原有 500 ms 启动断言。不要为测试运行安装或模型下载脚本。旧测试的默认值断言随新要求更新；真实 A/B 07→08、数字、清空、语音引擎回归保留，并在真实可见编辑台运行。新增 CDP 测试覆盖字号、缩放、窗口、滚动改变成员，实际折行和表格行数，独立 0/10 设置，600 上限和范围外泄漏，近邻重复选择，旧缓存迁移，双语命令与持久化，局部冲突、重传、实际粘贴和三个导入入口、主题与本地 ASR 消息链路。真实 WAV 测试验证模型流式识别；命令专项测试注入识别结果，不能代表麦克风声学准确率。

Set `CUE_BROWSER` or `CUE_PYTHON` to override executables. Tests use port 0, isolated browser profiles and only their own child processes. Files run serially so concurrent model/browser load does not distort the existing 500 ms startup assertion. Do not run installation or model download scripts for acceptance. Intentional default assertions reflect the new requirements; real A/B 07→08, numeric, clear and ASR regressions remain and now use a visible editor. New CDP tests cover dynamic font/zoom/viewport/scroll membership, wrapped and table text lines, independent 0/10 settings, the 600 cap and leakage prevention, nearest repetitions, old cache migration, bilingual commands and persistence, local conflicts, retransmits, real paste and all three import routes, themes and the Local Streaming message path. Real WAV tests exercise recognition; injected command transcripts do not measure microphone recognition accuracy.

本地预览也可用临时端口，命令输出实际 URL：

Preview on a random port (the command prints its URL):

```powershell
python -c "from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler; s=ThreadingHTTPServer(('127.0.0.1',0),SimpleHTTPRequestHandler); print('http://127.0.0.1:'+str(s.server_port),flush=True); s.serve_forever()"
```

从本 worktree 运行，不启动或更改其他工作区服务。当前改动未部署到公开 demo。
Run from this worktree without changing other workspace services. These changes have not been deployed to the public demo.
