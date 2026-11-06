# Local Streaming ASR

## 中文

GitHub Pages 和直接打开 `index.html` 均可使用浏览器语音，无需安装。
可选的本地流式识别在本机运行中英双语模型，音频经回环 WebSocket 传输。
首次启动需要 Python、网络和约 200 MB 的模型下载空间。模型和虚拟环境保存在本目录并由 Git 忽略。

Windows PowerShell 运行 `./local-asr/start.ps1`。macOS / Linux 运行 `bash local-asr/start.sh`，需要 Python 3 和 curl。
启动器优先使用 uv，否则使用 venv 和 pip，已有模型文件会保留，下载中断后可重新运行。
Windows 可用 `-Port 5330`，macOS / Linux 可用 `--port 5330` 更换端口。
如果端口已占用，换一个端口启动，并在网页设置中填写对应 WS 地址。

默认地址为 `ws://127.0.0.1:5329`。网页配置和语音监控窗均可选「自动」「本地流式引擎」「浏览器语音」。
自动模式等待本地 ready 最多 350 ms，随后使用浏览器语音，本地连接中断也会自动切换。
强制本地模式在连接失败时显示启动提示。网页仍需麦克风权限，浏览器也可能请求本地网络访问权限。
浏览器语音由浏览器厂商提供，通常需要联网，并遵循该服务的数据处理方式。

默认使用 CPU。Windows `-Provider cuda` 或 shell `--provider cuda` 请求 CUDA，运行时未提供 CUDA 时回退 CPU。
模型目录可通过 `python local-asr/server.py --model-dir <目录> --port 5329` 指定。
`GET /health` 和 `OPTIONS /health` 提供健康检查与本地网络 CORS 头。

## English

The static GitHub Pages / single HTML browser mode requires no installation.
For optional on-device bilingual streaming, run `./local-asr/start.ps1` on Windows or
`bash local-asr/start.sh` on macOS / Linux. Python is required. The shell launcher also needs curl.
The launcher prefers uv, otherwise venv / pip, installs dependencies and downloads missing model files
from Hugging Face with a mirror fallback. Existing models and the environment are retained.
The first run needs internet access and approximately 200 MB of model storage.

The default endpoint is `ws://127.0.0.1:5329`. Select the engine in Settings or the voice monitor.
Auto waits up to 350 ms for local readiness, then uses Browser Speech. A dropped local session also
falls back automatically. Forced Local displays a launcher hint on failure.
Allow microphone and local-network permissions when the browser requests them.
Browser Speech uses the browser vendor's recognition service and usually requires internet access.

Use `-Port 5330` / `--port 5330` for a different port and update the page's WS URL.
Use `-Provider cuda` / `--provider cuda` to request CUDA, with CPU fallback when unavailable.
The server also accepts `--host`, `--port`, and `--model-dir`. It defaults to loopback and CPU.

## Protocol

The server sends `ready` with a 16000 Hz sample rate and sequence 0.
Send JSON `config` with `lang` and `hotwords`, then binary little-endian mono Int16 PCM at 16 kHz.
The server emits changed `partial` text and endpoint `final` text, tagged with the current `seq`.
`flush` finishes buffered speech and starts a new stream. `reset` with a new `seq` discards buffered
speech and returns `reset_ack`. Clients discard older sequences and wait for that acknowledgement.

## Tests

From the repository root run `node --test tests/*.test.mjs` with Node 24, installed Edge or Chrome,
the local Python environment and both model `test_wavs/0.wav` and `test_wavs/1.wav` present.
Tests allocate their own ephemeral ports and browser profiles and clean up their child processes.
