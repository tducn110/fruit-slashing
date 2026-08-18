import subprocess
import json
import shutil
from pathlib import Path

# Paths
SOURCE_DIR = Path("public/assets")
# We only want to process audio files that are in SOURCE_DIR
OUTPUT_DIR = Path("public/assets-optimized-audio")

# Target settings
MP3_BGM_BITRATE = "128k"
MP3_SFX_BITRATE = "96k"
OGG_SFX_QUALITY = "4"
DURATION_THRESHOLD_MS = 30.0

def probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])

def encode_audio(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    
    # Determine type based on file name or usage context
    # Usually BGM files are larger, or explicitly named 'music.mp3', 'bgm.mp3', etc.
    # In this project, 'moavii-we-are.mp3' is the BGM.
    is_bgm = "moavii-we-are" in src.name.lower() or "music" in src.name.lower() or "bgm" in src.name.lower()

    if is_bgm:
        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(src),
            "-vn",
            "-c:a", "libmp3lame",
            "-b:a", MP3_BGM_BITRATE,
            str(dst),
        ]
    elif src.suffix.lower() == ".mp3":
        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(src),
            "-vn",
            "-c:a", "libmp3lame",
            "-b:a", MP3_SFX_BITRATE,
            str(dst),
        ]
    elif src.suffix.lower() == ".ogg":
        cmd = [
            "ffmpeg",
            "-y",
            "-i", str(src),
            "-vn",
            "-c:a", "libvorbis",
            "-q:a", OGG_SFX_QUALITY,
            str(dst),
        ]
    else:
        return False

    # Suppress output to keep console clean
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return True

def main():
    if not SOURCE_DIR.exists():
        print(f"Source directory {SOURCE_DIR} does not exist.")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Starting audio optimization...")
    
    for src in SOURCE_DIR.rglob("*"):
        if src.suffix.lower() not in {".mp3", ".ogg"}:
            continue

        relative = src.relative_to(SOURCE_DIR)
        dst = OUTPUT_DIR / relative

        print(f"\nProcessing: {relative}")

        before_size = src.stat().st_size
        try:
            before_duration = probe_duration(src)
        except Exception as e:
            print(f"  [ERROR] Could not probe {src}: {e}")
            continue

        # Encode
        try:
            success = encode_audio(src, dst)
            if not success:
                print("  [SKIP] Unsupported or not an audio type targeted for encode.")
                continue
        except subprocess.CalledProcessError as e:
            print(f"  [ERROR] Encoding failed for {src}: {e}")
            continue

        after_size = dst.stat().st_size
        after_duration = probe_duration(dst)

        duration_delta_ms = abs(after_duration - before_duration) * 1000
        reduction = (1 - after_size / before_size) * 100

        print(f"  Size: {before_size / 1024:.1f} KB -> {after_size / 1024:.1f} KB")
        print(f"  Saved: {reduction:.1f}%")
        print(f"  Duration delta: {duration_delta_ms:.1f} ms")

        # Checks
        reject = False
        
        if duration_delta_ms > DURATION_THRESHOLD_MS:
            print(f"  [REJECT] Duration changed by {duration_delta_ms:.1f} ms (> {DURATION_THRESHOLD_MS} ms).")
            reject = True

        if after_size >= before_size:
            print("  [REJECT] Output size is larger or equal to original.")
            reject = True

        if reject:
            print("  -> Keeping original file.")
            shutil.copy2(src, dst)
        else:
            print("  -> Optimized version kept.")

if __name__ == "__main__":
    main()
