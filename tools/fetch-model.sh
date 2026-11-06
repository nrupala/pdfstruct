#!/bin/sh
# Fetch the bundled talk model's weights into the extension tree.
# The weights (483 MB) exceed GitHub's per-file limit, so they are
# not stored in git; the store packages are built from a tree that
# ran this script. SHA-256 is pinned — a mismatch aborts.
# Source: onnx-community/Qwen2.5-0.5B-Instruct (Apache-2.0).
set -eu
DEST="$(dirname "$0")/../extension/vendor/models/qwen2.5-0.5b-instruct/onnx"
SHA="b11c1dd99efd57e6c6e5bc4443a019931a5fbd5dd500d48644d8225f5ce0b2cb"
URL="https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct/resolve/main/onnx/model_q4f16.onnx"
mkdir -p "$DEST"
curl -L "$URL" -o "$DEST/model_q4f16.onnx"
echo "$SHA  $DEST/model_q4f16.onnx" | sha256sum -c -
echo "model weights in place"
