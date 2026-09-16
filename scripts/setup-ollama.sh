#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODELFILE="$ROOT/ollama/Modelfile"
NAME="id-assist-tutor"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed. Install from https://ollama.com then re-run."
  exit 1
fi

if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Ollama is not running. Start the Ollama app, then re-run."
  exit 1
fi

if ! ollama list | awk 'NR>1 {print $1}' | grep -qx 'gpt-oss:20b'; then
  echo "Base model gpt-oss:20b not found."
  echo "Pull it first: ollama pull gpt-oss:20b"
  exit 1
fi

echo "Creating $NAME from $MODELFILE ..."
ollama create "$NAME" -f "$MODELFILE"
echo "Done. Test: ollama run $NAME \"What are your standing rules?\""
