#!/usr/bin/env python3
"""Run Faster-Whisper locally and emit one bounded JSON document."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from faster_whisper import WhisperModel


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--model", default="small")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language")
    args = parser.parse_args()

    audio = Path(args.audio)
    if not audio.is_file():
        raise SystemExit("Audio file not found.")

    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    segments, info = model.transcribe(
        str(audio),
        language=args.language or None,
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=True,
    )
    output_segments = []
    text_parts = []
    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        text_parts.append(text)
        output_segments.append(
            {
                "startSeconds": round(float(segment.start), 3),
                "endSeconds": round(float(segment.end), 3),
                "text": text,
            }
        )

    print(
        json.dumps(
            {
                "text": " ".join(text_parts),
                "language": info.language or None,
                "languageProbability": (
                    float(info.language_probability)
                    if info.language_probability is not None
                    else None
                ),
                "durationSeconds": round(float(info.duration), 3),
                "segments": output_segments,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
