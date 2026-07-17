# -*- coding: utf-8 -*-
"""
One-command development environment setup for Bili2Insight.
Usage:  python scripts/setup_dev.py

After a fresh clone, this script handles:
  1. Check prerequisites (Python, Node, Rust)
  2. Install Python deps (httpx, sherpa-onnx, pyinstaller)
  3. Download FFmpeg sidecar (~101MB)
  4. Build bili_worker & asr_worker with PyInstaller
  5. Download ASR models (~483MB)
  6. Run npm install
"""
import os, sys, subprocess, shutil, zipfile, pathlib, tempfile, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
BINARIES = ROOT / "src-tauri" / "binaries"
RESOURCES = ROOT / "src-tauri" / "resources" / "models"
WORKER = ROOT / "worker"

TARGET_TRIPLE = "x86_64-pc-windows-msvc"

SIDECAR_NAMES = {
    "bili_worker": f"bili_worker-{TARGET_TRIPLE}.exe",
    "asr_worker": f"asr_worker-{TARGET_TRIPLE}.exe",
    "ffmpeg":     f"ffmpeg-{TARGET_TRIPLE}.exe",
}

SHERPA_ONNX_RELEASE = "v1.12.5"
SHERPA_BASE = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/{SHERPA_ONNX_RELEASE}"
FFMPEG_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"


def step(msg: str):
    print(f"\n{'='*60}\n  {msg}\n{'='*60}")


def check_cmd(name: str, *args, help_msg: str = ""):
    try:
        subprocess.run([name, *args], capture_output=True, check=True, timeout=10)
        print(f"  [OK] {name}")
        return True
    except Exception:
        print(f"  [MISSING] {name}" + (f" -- {help_msg}" if help_msg else ""))
        return False


def run(cmd: list, cwd=None):
    print(f"  -> {' '.join(cmd)}")
    r = subprocess.run(cmd, cwd=cwd)
    if r.returncode != 0:
        print(f"  ERROR: failed (code {r.returncode})")
        sys.exit(1)


def main():
    os.chdir(ROOT)
    print("=" * 60)
    print("  Bili2Insight -- Dev Env Setup")
    print("=" * 60)

    step("Checking prerequisites")
    ok = True
    ok &= check_cmd("python", "--version")
    ok &= check_cmd("node", "--version", help_msg="Install Node.js 18+ from https://nodejs.org")
    ok &= check_cmd("npm", "--version")
    ok &= check_cmd("cargo", "--version", help_msg="Install Rust from https://rustup.rs")
    if not ok:
        print("\n  Missing prerequisites. Install them and re-run.")
        sys.exit(1)

    step("Installing Python dependencies")
    print("  pip install -r worker/requirements.txt + sherpa-onnx + pyinstaller")
    req = WORKER / "requirements.txt"
    if req.exists():
        run([sys.executable, "-m", "pip", "install", "-r", str(req)])
    run([sys.executable, "-m", "pip", "install", "sherpa-onnx", "pyinstaller"])

    step("Downloading FFmpeg")
    exe = BINARIES / SIDECAR_NAMES["ffmpeg"]
    if exe.exists():
        print(f"  [SKIP] {SIDECAR_NAMES['ffmpeg']} exists")
    else:
        BINARIES.mkdir(parents=True, exist_ok=True)
        tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
        tmp.close()
        print("  Downloading ffmpeg (~101MB)...")
        urllib.request.urlretrieve(FFMPEG_URL, tmp.name)
        with zipfile.ZipFile(tmp.name, "r") as zf:
            for name in zf.namelist():
                if name.endswith("ffmpeg.exe"):
                    rel = name.replace("\\", "/").split("/")[-1]
                    dest = BINARIES / rel
                    with zf.open(name) as src, open(dest, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    size = dest.stat().st_size / 1024 / 1024
                    print(f"  [OK] ffmpeg.exe ({size:.1f}MB)")
                    break
        pathlib.Path(tmp.name).unlink(missing_ok=True)
        ff = BINARIES / "ffmpeg.exe"
        if ff.exists() and not exe.exists():
            shutil.move(str(ff), str(exe))

    step("Building sidecar binaries")
    for name, py_file in [("bili_worker", "bili_worker.py"), ("asr_worker", "asr_worker.py")]:
        exe = BINARIES / SIDECAR_NAMES[name]
        if exe.exists():
            print(f"  [SKIP] {SIDECAR_NAMES[name]} exists")
            continue
        ep = WORKER / py_file
        BINARIES.mkdir(parents=True, exist_ok=True)
        run([sys.executable, "-m", "PyInstaller", "--clean", "--noconfirm", "--onefile",
             "--distpath", str(BINARIES),
             "--name", SIDECAR_NAMES[name].replace(".exe", ""),
             str(ep)], cwd=str(WORKER))
        for d in ["build", "__pycache__"]:
            p = WORKER / d
            if p.exists():
                shutil.rmtree(p, ignore_errors=True)
        for spec in WORKER.glob("*.spec"):
            spec.unlink(missing_ok=True)

    step("Downloading ASR models")
    MODELS = {
        "paraformer-large": ["model.int8.onnx", "tokens.txt"],
        "sense-voice-small": ["model.int8.onnx", "tokens.txt"],
    }
    for model_name, files in MODELS.items():
        model_dir = RESOURCES / model_name
        all_ok = all((model_dir / f).exists() for f in files)
        if all_ok:
            print(f"  [SKIP] {model_name} (all files exist)")
            continue
        url = f"{SHERPA_BASE}/sherpa-onnx-{model_name}-{SHERPA_ONNX_RELEASE}.tar.bz2"
        print(f"  Models for {model_name} (NOT auto-downloaded):")
        print(f"    1. Download: {url}")
        print(f"    2. Extract to: {model_dir}")

    step("Installing Node.js dependencies")
    run(["npm", "install"])

    print()
    print("=" * 60)
    print("  SETUP COMPLETE!")
    print("=" * 60)
    print(f"  Sidecars: {BINARIES}")
    for n, f in SIDECAR_NAMES.items():
        p = BINARIES / f
        status = "[OK]" if p.exists() else "[TODO]"
        print(f"    {status} {f}")
    print(f"  Models:   {RESOURCES}")
    for mn, fs in MODELS.items():
        all_ok = all((RESOURCES / mn / f).exists() for f in fs)
        status = "[OK]" if all_ok else "[TODO]"
        print(f"    {status} {mn}")
    print(f"\n  To start dev:\n    npx tauri dev")


if __name__ == "__main__":
    main()
