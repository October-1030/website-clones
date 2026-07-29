#!/usr/bin/env python3
"""Probe audio duration or run Faster-Whisper and emit one bounded JSON document."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import av

MAX_DURATION_SECONDS = 600.0
PROBE_TOLERANCE_SECONDS = 5.0


def probe_duration(audio: Path) -> float:
    with av.open(str(audio)) as container:
        audio_streams = [stream for stream in container.streams if stream.type == "audio"]
        if not audio_streams:
            raise ValueError("No audio stream found.")

        stream = audio_streams[0]
        duration = 0.0
        decoded_frames = 0
        for frame in container.decode(audio=stream.index):
            sample_rate = frame.sample_rate or stream.codec_context.sample_rate
            if not sample_rate or frame.samples <= 0:
                continue
            decoded_frames += 1
            duration += float(frame.samples / sample_rate)
            if duration > MAX_DURATION_SECONDS + PROBE_TOLERANCE_SECONDS:
                break
        if decoded_frames == 0 or duration <= 0:
            raise ValueError("No decodable audio frames found.")
        return duration


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--probe-only", action="store_true")
    parser.add_argument("--model", default="small")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language")
    args = parser.parse_args()

    audio = Path(args.audio)
    if not audio.is_file():
        raise SystemExit("Audio file not found.")

    try:
        duration = probe_duration(audio)
    except (av.error.FFmpegError, ValueError, OSError) as error:
        raise SystemExit("Unable to read the audio duration.") from error

    if args.probe_only:
        print(json.dumps({"durationSeconds": round(duration, 3)}))
        return
    if duration > MAX_DURATION_SECONDS + PROBE_TOLERANCE_SECONDS:
        raise SystemExit("Recording exceeds the maximum duration.")

    from faster_whisper import WhisperModel

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
