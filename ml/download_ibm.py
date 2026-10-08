"""Downloader for IBM AML Dataset (HI-Small_Trans.csv and HI-Small_Patterns.txt)."""
from pathlib import Path
import sys
import time
import urllib.request

RAW_DIR = Path(__file__).resolve().parent / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

FILES = [
    (
        "HI-Small_Patterns.txt",
        "https://huggingface.co/datasets/Sachin071002/IBM-AML-HI-Small/resolve/main/HI-Small_Patterns.txt",
    ),
    (
        "HI-Small_Trans.csv",
        "https://huggingface.co/datasets/Sachin071002/IBM-AML-HI-Small/resolve/main/HI-Small_Trans.csv",
    ),
]


def download_file(filename: str, url: str):
    dest = RAW_DIR / filename
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"[SKIP] {filename} already exists ({dest.stat().st_size / (1024*1024):.2f} MB)")
        return

    print(f"[START] Downloading {filename} from {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    with urllib.request.urlopen(req) as resp:
        total_size = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024  # 1 MB chunks
        t0 = time.time()
        last_log = t0

        with open(dest, "wb") as f:
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                now = time.time()
                if now - last_log >= 2.0 or downloaded == total_size:
                    elapsed = now - t0
                    speed_mb = (downloaded / (1024 * 1024)) / max(elapsed, 0.001)
                    pct = (downloaded / total_size * 100) if total_size else 0
                    print(
                        f"  -> {filename}: {downloaded / (1024*1024):.1f}/{total_size / (1024*1024):.1f} MB "
                        f"({pct:.1f}%) @ {speed_mb:.2f} MB/s",
                        flush=True,
                    )
                    last_log = now

    print(f"[DONE] {filename} downloaded successfully ({dest.stat().st_size / (1024*1024):.2f} MB)\n")


if __name__ == "__main__":
    for fname, url in FILES:
        download_file(fname, url)
    print("All IBM AML files ready in:", RAW_DIR)
