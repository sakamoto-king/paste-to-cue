#!/usr/bin/env bash
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
port=5329
provider=cpu
while (($#)); do
  case "$1" in
    --port) port="${2:?Missing port}"; shift 2 ;;
    --provider) provider="${2:?Missing provider}"; shift 2 ;;
    *) printf 'Unknown option %s\n' "$1" >&2; exit 2 ;;
  esac
done
if [[ ! -x "$root/.venv/bin/python" ]]; then
  if command -v uv >/dev/null 2>&1; then uv venv "$root/.venv"
  else "${PYTHON:-python3}" -m venv "$root/.venv"; fi
fi
python="$root/.venv/bin/python"
if command -v uv >/dev/null 2>&1; then uv pip install --python "$python" -r "$root/requirements.txt"
else "$python" -m pip install -r "$root/requirements.txt"; fi
model=sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20
model_dir="$root/models/$model"
mkdir -p "$model_dir"
for file in tokens.txt bpe.vocab bpe.model encoder-epoch-99-avg-1.int8.onnx decoder-epoch-99-avg-1.onnx joiner-epoch-99-avg-1.int8.onnx; do
  target="$model_dir/$file"
  [[ -s "$target" ]] && continue
  downloaded=false
  for domain in huggingface.co hf-mirror.com; do
    if curl --fail --location --retry 2 "https://$domain/csukuangfj/$model/resolve/main/$file" -o "$target.download" && [[ -s "$target.download" ]]; then
      mv -- "$target.download" "$target"
      downloaded=true
      break
    fi
  done
  if [[ "$downloaded" != true ]]; then printf 'Could not download %s. Re-run to retry.\n' "$file" >&2; exit 1; fi
done
exec "$python" "$root/server.py" --host 127.0.0.1 --port "$port" --model-dir "$model_dir" --provider "$provider"
