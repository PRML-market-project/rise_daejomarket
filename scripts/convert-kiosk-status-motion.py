"""Build browser-ready, transparent kiosk animations from the supplied MOVs.

Run from any directory with FFmpeg/FFprobe on PATH:
    python scripts/convert-kiosk-status-motion.py
    python scripts/convert-kiosk-status-motion.py --check

The originals remain untouched. VP9 WebM preserves alpha in Chrome; the PNGs
provide a still for reduced motion, playback failures and initial loading.
"""

import argparse
import json
from pathlib import Path
import subprocess


ASSETS = Path(__file__).resolve().parents[1] / "frontend/public/design-assets"
# Source number, output name, encoded width (twice the rendered canvas width).
MOTIONS = (
    ("01", "search-processing", 400),     # Figma 757:58131
    ("02", "handwriting-loading", 320),   # Figma 1140:126441
    ("03", "connection-error", 400),      # Figma 757:58150
    ("04", "voice-error", 400),           # Figma 757:58140
    ("05", "no-results", 400),            # Figma 757:58116
)


def run(*args: str) -> bytes:
    return subprocess.run(args, check=True, stdout=subprocess.PIPE).stdout


def probe(path: Path) -> dict:
    return json.loads(run(
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,width,height,pix_fmt:stream_tags=alpha_mode:format=duration",
        "-of", "json", str(path),
    ))


def check(source: Path, name: str, width: int) -> None:
    video = ASSETS / f"{name}.webm"
    original = probe(source)
    encoded = probe(video)
    stream = encoded["streams"][0]
    assert stream["codec_name"] == "vp9", f"{name}: expected VP9"
    assert stream["width"] == width, f"{name}: wrong output width"
    assert stream.get("tags", {}).get("alpha_mode") == "1", f"{name}: missing alpha metadata"
    assert abs(float(original["format"]["duration"]) - float(encoded["format"]["duration"])) < 0.05, f"{name}: changed timing"

    # FFmpeg's native VP9 decoder omits alpha. Decode with libvpx to verify the
    # actual transparent pixels, rather than relying only on container metadata.
    for path in (video, ASSETS / f"{name}.png"):
        decoder = ("-c:v", "libvpx-vp9") if path.suffix == ".webm" else ()
        pixels = run(
            "ffmpeg", "-v", "error", *decoder, "-i", str(path),
            "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-threads", "1", "pipe:1",
        )
        alpha = pixels[3::4]
        assert alpha and min(alpha) == 0 and max(alpha) > 100, f"{path.name}: missing transparent/visible pixels"
    print(f"OK {name}: {stream['width']}x{stream['height']}, {encoded['format']['duration']}s, alpha preserved, {video.stat().st_size:,} bytes")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate existing outputs without re-encoding")
    args = parser.parse_args()
    for number, name, width in MOTIONS:
        sources = list(ASSETS.glob(f"{number}_*.mov"))
        if len(sources) != 1:
            raise ValueError(f"Expected one {number}_*.mov in {ASSETS}, found {len(sources)}")
        source = sources[0]
        if not args.check:
            assert "a" in probe(source)["streams"][0]["pix_fmt"], f"{number}: source has no alpha"
            run(
                "ffmpeg", "-v", "error", "-y", "-i", str(source),
                "-an", "-map_metadata", "-1", "-vf", f"scale={width}:-2:flags=lanczos,format=yuva420p",
                "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "24",
                "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-threads", "4", "-auto-alt-ref", "0",
                str(ASSETS / f"{name}.webm"),
            )
            run(
                "ffmpeg", "-v", "error", "-y", "-i", str(source), "-frames:v", "1",
                "-vf", f"scale={width}:-2:flags=lanczos", "-pix_fmt", "rgba", "-threads", "1",
                str(ASSETS / f"{name}.png"),
            )
        check(source, name, width)


if __name__ == "__main__":
    main()
