#!/usr/bin/env python3
import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
if sys.stdout is not None: sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr is not None: sys.stderr.reconfigure(encoding="utf-8")

import json, re, time, argparse, hashlib, urllib.parse, logging
from functools import reduce
from pathlib import Path
import httpx

logging.getLogger("httpx").setLevel("WARNING")

mixinKeyEncTab = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52]

def emit(kind: str, data: dict):
    print(json.dumps({"type": kind, **data}, ensure_ascii=False), flush=True)

class BiliWorker:
    def __init__(self, url: str, output_dir: str, proxy: str = None):
        self.url = url; self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        limits = httpx.Limits(max_connections=10, max_keepalive_connections=10)
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Referer": "https://www.bilibili.com/"}
        mounts = {}
        if proxy:
            transport = httpx.HTTPTransport(proxy=proxy, retries=5)
            mounts = {"http://": transport, "https://": transport}
        self.client = httpx.Client(limits=limits, timeout=30, headers=headers, mounts=mounts, follow_redirects=True)
        self.img_key = ""; self.sub_key = ""

    def _retry(self, fn, name: str, max_retries: int = 3):
        import time as _time
        last_err = None
        for attempt in range(max_retries):
            if attempt > 0:
                emit("progress", {"stage": name, "message": f"Retrying {name} ({attempt+1}/{max_retries})..."})
                _time.sleep(1 + attempt)
            try:
                return fn()
            except Exception as e:
                last_err = e
                emit("progress", {"stage": name, "message": f"{name} attempt {attempt+1} failed: {e}"})
        raise last_err

    def _do_fetch_wbi_keys(self):
        resp = self.client.get("https://api.bilibili.com/x/web-interface/nav")
        data = resp.json()["data"]
        self.img_key = data["wbi_img"]["img_url"].split("/")[-1].split(".")[0]
        self.sub_key = data["wbi_img"]["sub_url"].split("/")[-1].split(".")[0]

    def fetch_wbi_keys(self):
        emit("progress", {"stage": "wbi_keys", "message": "Fetching WBI keys..."})
        self._retry(self._do_fetch_wbi_keys, "wbi_keys")

    def sign_wbi(self, params: dict) -> str:
        def get_mixin_key(orig: str):
            return reduce(lambda s, i: s + orig[i], mixinKeyEncTab, "")[:32]
        mixin_key = get_mixin_key(self.img_key + self.sub_key)
        params["wts"] = int(time.time())
        params = dict(sorted(params.items()))
        params = {k: "".join(filter(lambda ch: ch not in "!'()*", str(v))) for k, v in params.items()}
        query = urllib.parse.urlencode(params)
        wbi_sign = hashlib.md5((query + mixin_key).encode()).hexdigest()
        params["w_rid"] = wbi_sign
        return urllib.parse.urlencode(params)

    def parse_bvid(self) -> str:
        m = re.search(r"(?:BV|bv)(\w+)", self.url)
        if m: return f"BV{m.group(1)}"
        m = re.search(r"/(?:av|AV)(\d+)", self.url)
        if m: return self.aid_to_bvid(int(m.group(1)))
        raise ValueError(f"Cannot parse video ID from: {self.url}")

    @staticmethod
    def aid_to_bvid(aid: int) -> str:
        XOR_CODE = 23442827791579; MAX_AID = 1 << 51
        ALPHABET = "FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf"
        ENCODE_MAP = [8, 7, 0, 5, 1, 3, 2, 4, 6]
        bvid = [""] * 9; tmp = (MAX_AID | aid) ^ XOR_CODE
        for i in range(len(ENCODE_MAP)):
            bvid[ENCODE_MAP[i]] = ALPHABET[tmp % len(ALPHABET)]; tmp //= len(ALPHABET)
        return "BV1" + "".join(bvid)

    def get_video_info(self, bvid: str) -> dict:
        emit("progress", {"stage": "video_info", "message": "Fetching video info..."})
        params = {"bvid": bvid}
        url = f"https://api.bilibili.com/x/web-interface/wbi/view?{self.sign_wbi(params)}"
        resp = self.client.get(url); data = resp.json()
        if data.get("code") != 0: raise RuntimeError(f"Video info error: {data.get('message')}")
        vdata = data["data"]
        # Build pages: use season episodes if ugc_season exists, otherwise traditional pages
        season = vdata.get("ugc_season")
        if season:
            pages = []
            for section in season.get("sections", []):
                for ep in section.get("episodes", []):
                    pages.append({
                        "page": len(pages) + 1,
                        "part": ep["title"],
                        "cid": ep["cid"],
                        "duration": ep.get("arc", {}).get("duration", 0)
                    })
        else:
            pages = [{"page": p["page"], "part": p["part"], "cid": p["cid"], "duration": p["duration"]} for p in vdata.get("pages", [])]
        info = {"bvid": vdata["bvid"], "aid": vdata["aid"], "cid": vdata["cid"], "title": vdata["title"], "description": vdata["desc"], "duration": vdata["duration"], "cover": vdata["pic"].replace("http://", "https://"), "uploader": vdata["owner"]["name"], "uploader_uid": vdata["owner"]["mid"], "pubdate": vdata["pubdate"], "pages": pages}
        emit("progress", {"stage": "video_info", "message": f"Got: {info['title']}"})
        return info

    def _do_get_play_url(self, bvid: str, cid: int) -> dict:
        # Try multiple quality params to handle pages with limited quality options
        param_sets = [
            {"bvid": bvid, "cid": cid, "qn": 0, "fnver": 0, "fnval": 4048, "fourk": 1},
            {"bvid": bvid, "cid": cid, "qn": 0, "fnver": 0, "fnval": 4048},
        ]
        last_msg = None
        for attempt, params in enumerate(param_sets):
            if attempt > 0:
                emit("progress", {"stage": "play_url", "message": f"Trying alternate play params ({attempt+1}/{len(param_sets)})..."})
            url = f"https://api.bilibili.com/x/player/wbi/playurl?{self.sign_wbi(params)}"
            resp = self.client.get(url); data = resp.json()
            code = data.get("code", -1)
            if code != 0:
                last_msg = data.get("message", "Unknown")
                continue
            dash = data.get("data", {}).get("dash", {})
            audio_streams = sorted([a for a in dash.get("audio", [])], key=lambda x: x.get("bandwidth", 0), reverse=True)
            if not audio_streams:
                last_msg = "No audio stream"
                continue
            audio = audio_streams[0]
            audio_url = audio.get("baseUrl") or audio.get("base_url") or audio.get("url", "")
            if not audio_url:
                last_msg = "Audio URL empty"
                continue
            emit("progress", {"stage": "play_url", "message": f"Play URL OK ({audio.get('bandwidth', 0)//1000}kbps)"})
            return {"audio_url": audio_url, "bandwidth": audio.get("bandwidth", 0)}
        raise RuntimeError(f"Play URL error: {last_msg}")

    def get_play_url(self, bvid: str, cid: int) -> dict:
        emit("progress", {"stage": "play_url", "message": "Fetching play URL..."})
        return self._retry(lambda: self._do_get_play_url(bvid, cid), "play_url")

    def download_audio(self, audio_url: str, filename: str) -> Path:
        output_path = self.output_dir / f"{filename}.m4a"
        emit("progress", {"stage": "download", "message": "Downloading audio..."})
        headers = {"Referer": "https://www.bilibili.com/"}
        with self.client.stream("GET", audio_url, headers=headers) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("Content-Length", 0)); downloaded = 0
            with open(output_path, "wb") as f:
                for chunk in resp.iter_bytes(chunk_size=8192):
                    f.write(chunk); downloaded += len(chunk)
                    if total > 0 and downloaded % (512 * 1024) < 8192:
                        pct = int(downloaded / total * 100)
                        emit("progress", {"stage": "download", "message": f"Downloading... {pct}%"})
        size_mb = output_path.stat().st_size / 1024 / 1024
        emit("progress", {"stage": "download", "message": f"Download done ({size_mb:.1f}MB)"})
        return output_path

    def run(self, preview_only: bool = False, page_cid: int = None) -> dict:
        bvid = self.parse_bvid()
        self.fetch_wbi_keys()
        video_info = self.get_video_info(bvid)
        if preview_only:
            emit("result", {"video_info": video_info})
            return {"video_info": video_info}
        active_cid = page_cid if page_cid else video_info["cid"]
        audio_tag = bvid if not page_cid else f"{bvid}_p{active_cid}"
        play_url = self.get_play_url(bvid, active_cid)
        audio_path = self.download_audio(play_url["audio_url"], audio_tag)
        result = {"video_info": video_info, "audio_path": str(audio_path.absolute())}
        emit("result", result)
        return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--output-dir", default="./downloads")
    parser.add_argument("--preview-only", action="store_true")
    parser.add_argument("--cid", type=int, default=None)
    parser.add_argument("--proxy", default=None)
    args = parser.parse_args()
    try:
        worker = BiliWorker(args.url, args.output_dir, proxy=args.proxy)
        worker.run(preview_only=args.preview_only, page_cid=args.cid)
        sys.exit(0)
    except Exception as e:
        emit("error", {"message": str(e)})
        sys.exit(1)

if __name__ == "__main__":
    main()
