"""Optional loopback streaming recognizer. Audio stays on this machine."""

import argparse
import asyncio
import json
import math
from pathlib import Path
import re

import numpy as np
import sherpa_onnx
from websockets.asyncio.server import serve
from websockets.datastructures import Headers
from websockets.exceptions import ConnectionClosed
from websockets.http11 import Response


MODEL = "sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20"
HEALTH = {"ok": True, "engine": "sherpa-onnx",
          "model": "streaming-zipformer-bilingual-zh-en", "sampleRate": 16000}


def process_request(connection, request):
    if request.path != "/health":
        return None
    body = json.dumps(HEALTH).encode()
    headers = Headers([
        ("Content-Type", "application/json"),
        ("Content-Length", str(len(body))),
        ("Access-Control-Allow-Origin", "*"),
        ("Access-Control-Allow-Methods", "GET, OPTIONS"),
        ("Access-Control-Allow-Headers", "Content-Type"),
        ("Access-Control-Allow-Private-Network", "true"),
        ("Connection", "close"),
    ])
    return Response(200, "OK", headers, body)


def select_provider(requested):
    if requested == "cpu":
        return "cpu"
    try:
        from sherpa_onnx.lib import _sherpa_onnx
        available = _sherpa_onnx.get_available_providers()
    except (ImportError, AttributeError):
        try:
            import onnxruntime
            available = onnxruntime.get_available_providers()
        except ImportError:
            # Some sherpa wheels bundle the runtime without its Python package.
            package = Path(sherpa_onnx.__file__).parent
            available = ["cuda"] if list(package.glob("**/*providers_cuda*")) else []
    return "cuda" if any("cuda" in str(p).lower() for p in available) else "cpu"


def make_recognizer(model_dir, provider):
    def model_file(stem):
        for name in (stem + ".int8.onnx", stem + ".onnx"):
            path = model_dir / name
            if path.is_file():
                return str(path)
        raise FileNotFoundError(f"Missing {stem} in {model_dir}. Run start.ps1 or start.sh.")

    options = dict(
        tokens=str(model_dir / "tokens.txt"),
        encoder=model_file("encoder-epoch-99-avg-1"),
        decoder=model_file("decoder-epoch-99-avg-1"),
        joiner=model_file("joiner-epoch-99-avg-1"),
        enable_endpoint_detection=True,
        rule1_min_trailing_silence=2.0,
        rule2_min_trailing_silence=0.8,
        rule3_min_utterance_length=16.0,
        decoding_method="modified_beam_search",
        modeling_unit="cjkchar+bpe",
        bpe_vocab=str(model_dir / "bpe.vocab"),
        hotwords_score=1.8,
        provider=provider,
    )
    try:
        return sherpa_onnx.OnlineRecognizer.from_transducer(**options)
    except RuntimeError:
        if provider == "cpu":
            raise
        print("CUDA initialization failed. Using CPU.", flush=True)
        options["provider"] = "cpu"
        return sherpa_onnx.OnlineRecognizer.from_transducer(**options)


def sanitize_hotwords(value):
    if not isinstance(value, list):
        return ""
    words = []
    for item in value[:128]:
        if not isinstance(item, str):
            continue
        word = re.sub(r"[^A-Z0-9\u4e00-\u9fff ]", " ", item.upper())
        word = " ".join(word.split())[:80]
        if word and word not in words:
            words.append(word)
    return "/".join(words)


async def handle(websocket, recognizer):
    hotwords = ""
    utter_seq = 0
    previous = ""

    def new_stream():
        try:
            return recognizer.create_stream(hotwords=hotwords) if hotwords else recognizer.create_stream()
        except Exception:
            return recognizer.create_stream()

    stream = new_stream()

    async def send(kind, **fields):
        await websocket.send(json.dumps({"type": kind, "seq": utter_seq, **fields}, ensure_ascii=False))

    def decode(samples, finished=False):
        stream.accept_waveform(16000, samples)
        if finished:
            stream.input_finished()
        while recognizer.is_ready(stream):
            recognizer.decode_stream(stream)
        return recognizer.get_result(stream).strip()

    await send("ready", engine="sherpa-onnx", sampleRate=16000)
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                if len(message) % 2:
                    await send("error", message="PCM frames must contain complete Int16 samples")
                    continue
                samples = np.frombuffer(message, dtype="<i2").astype(np.float32) / 32768.0
                text = await asyncio.to_thread(decode, samples)
                if text != previous:
                    previous = text
                    await send("partial", text=text)
                if recognizer.is_endpoint(stream):
                    if text:
                        await send("final", text=text)
                    recognizer.reset(stream)
                    previous = ""
                continue
            try:
                data = json.loads(message)
                if not isinstance(data, dict):
                    raise ValueError("Expected a JSON object")
            except (ValueError, TypeError):
                await send("error", message="Expected a JSON object")
                continue
            kind = data.get("type")
            if kind == "config":
                hotwords = sanitize_hotwords(data.get("hotwords", []))
                stream = new_stream()
                previous = ""
            elif kind == "reset":
                seq = data.get("seq")
                utter_seq = int(seq) if isinstance(seq, (int, float)) and not isinstance(seq, bool) and math.isfinite(seq) else utter_seq + 1
                stream = new_stream()
                previous = ""
                await send("reset_ack")
            elif kind == "flush":
                text = await asyncio.to_thread(decode, np.zeros(8000, dtype=np.float32), True)
                if text:
                    await send("final", text=text)
                stream = new_stream()
                previous = ""
    except ConnectionClosed:
        pass


async def main(args):
    recognizer = make_recognizer(args.model_dir, select_provider(args.provider))
    async with serve(lambda ws: handle(ws, recognizer), args.host, args.port,
                     process_request=process_request, max_size=1024 * 1024) as server:
        port = server.sockets[0].getsockname()[1]
        print(f"Listening ws://{args.host}:{port}", flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5329)
    parser.add_argument("--model-dir", type=Path, default=Path(__file__).resolve().parent / "models" / MODEL)
    parser.add_argument("--provider", choices=["cpu", "cuda", "auto"], default="cpu")
    try:
        asyncio.run(main(parser.parse_args()))
    except KeyboardInterrupt:
        pass
