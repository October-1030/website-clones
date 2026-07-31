#!/usr/bin/env python3
"""Small JSON adapter around faster-whisper for Storybound."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--model", default="small")
    parser.add_argument("--language", default="zh")
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--compute-type", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.input.is_file():
        raise FileNotFoundError(f"Media file does not exist: {args.input}")

    compute_type = args.compute_type or ("float16" if args.device == "cuda" else "int8")
    model = WhisperModel(args.model, device=args.device, compute_type=compute_type)
    segments, info = model.transcribe(
        str(args.input),
        language=args.language or None,
        beam_size=5,
        vad_filter=True,
    )
    text = "".join(segment.text for segment in segments).strip()
    print(
        json.dumps(
            {
                "text": text,
                "language": info.language,
                "duration": info.duration,
                "model": args.model,
                "device": args.device,
            },
            ensure_ascii=False,
        ),
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # The Node adapter returns this message to the UI.
        print(f"ASR failed: {error}", file=sys.stderr)
        raise SystemExit(1)
