#!/usr/bin/env python3
import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
if sys.stdout is not None: sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr is not None: sys.stderr.reconfigure(encoding="utf-8")

import json, re, time, argparse, hashlib, urllib.parse, logging, tempfile, pathlib
from functools import reduce
from pathlib import Path
import httpx

logging.getLogger("httpx").setLevel("WARNING")


# Global WBI key cache (matches Bili23''s config.get approach)
_wbi_img_key = None
_wbi_sub_key = None

# File-based WBI key cache: persists across sidecar process invocations
_WBI_CACHE_FILE = pathlib.Path(tempfile.gettempdir()) / "bili2insight_wbi_keys.txt"
_WBI_CACHE_TTL = 600  # 10 minutes

def get_cached_wbi_keys(client):
    global _wbi_img_key, _wbi_sub_key
    # Check in-process global cache first
    if _wbi_img_key and _wbi_sub_key:
        return _wbi_img_key, _wbi_sub_key
    # Check file-based cache (persists across sidecar process invocations)
    if _WBI_CACHE_FILE.exists():
        try:
            mtime = _WBI_CACHE_FILE.stat().st_mtime
            if time.time() - mtime < _WBI_CACHE_TTL:
                with open(_WBI_CACHE_FILE) as f:
                    _wbi_img_key, _wbi_sub_key = f.read().strip().split(",", 1)
                return _wbi_img_key, _wbi_sub_key
        except Exception:
            pass
    # Fetch fresh keys from Bilibili
    resp = client.get("https://api.bilibili.com/x/web-interface/nav")
    data = resp.json()["data"]
    _wbi_img_key = data["wbi_img"]["img_url"].split("/")[-1].split(".")[0]
    _wbi_sub_key = data["wbi_img"]["sub_url"].split("/")[-1].split(".")[0]
    # Persist to file cache
    try:
        with open(_WBI_CACHE_FILE, "w") as f:
            f.write(f"{_wbi_img_key},{_wbi_sub_key}")
    except Exception:
        pass
    return _wbi_img_key, _wbi_sub_key
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
        # Set B? cookies (matches Bili23 guest session)
        self.client.cookies.update({
            "_uuid": "9aa29b56d9ab460aa302190a9c6bd3bc",
            "buvid3": "69ca2dea4883434eb00a85b2a09418ba",
            "buvid4": "9c5608fae91c48bfb65eaa1807fb78e7",
            "CURRENT_FNVAL": "4048",
            "CURRENT_QUALITY": "0",
        })
        self.img_key = ""; self.sub_key = ""

    def _retry(self, fn, name: str, max_retries: int = 3):
        import time as _time
        last_err = None
        for attempt in range(max_retries):
            if attempt > 0:
                delay = 2 ** attempt  # exponential backoff: 2, 4, 8 seconds
                emit("progress", {"stage": name, "message": f"Retrying {name} ({attempt+1}/{max_retries}) in {delay}s..."})
                _time.sleep(delay)
            try:
                return fn()
            except Exception as e:
                last_err = e
                emit("progress", {"stage": name, "message": f"{name} attempt {attempt+1} failed: {e}"})
        raise last_err

    def _do_fetch_wbi_keys(self):
        self.img_key, self.sub_key = get_cached_wbi_keys(self.client)

    def fetch_wbi_keys(self):
        global _wbi_img_key
        if _wbi_img_key and _wbi_sub_key:
            self.img_key = _wbi_img_key
            self.sub_key = _wbi_sub_key
            emit("progress", {"stage": "wbi_keys", "message": "Using cached WBI keys"})
            return
        self.img_key, self.sub_key = get_cached_wbi_keys(self.client)
        if self.img_key and self.sub_key:
            emit("progress", {"stage": "wbi_keys", "message": "WBI keys loaded from cache"})
            return
        emit("progress", {"stage": "wbi_keys", "message": "Fetching WBI keys..."})
        try:
            self._retry(self._do_fetch_wbi_keys, "wbi_keys", max_retries=2)
        except Exception as e:
            emit("progress", {"stage": "wbi_keys", "message": f"WBI keys unavailable: {e}. Using non-WBI fallback."})
            self.img_key = ""; self.sub_key = ""
            self._wbi_unavailable = True

    def sign_wbi(self, params: dict) -> str:
        def get_mixin_key(orig: str):
            return reduce(lambda s, i: s + orig[i], mixinKeyEncTab, "")[:32]
        mixin_key = get_mixin_key(self.img_key + self.sub_key)
        params["wts"] = round(time.time())
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
        # Fetch from BOTH endpoints to compare cids
        url_nw = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
        resp_nw = self.client.get(url_nw); data_nw = resp_nw.json()
        url_wb = f"https://api.bilibili.com/x/web-interface/wbi/view?{self.sign_wbi(params)}"
        resp_wb = self.client.get(url_wb); data_wb = resp_wb.json()
        cids_nw = [p.get("cid") for p in (data_nw.get("data", {}).get("pages", []) if data_nw.get("code") == 0 else [])]
        cids_wb = [p.get("cid") for p in (data_wb.get("data", {}).get("pages", []) if data_wb.get("code") == 0 else [])]
        emit("progress", {"stage": "video_info", "message": f"Non-WBI cids: {cids_nw}"})
        emit("progress", {"stage": "video_info", "message": f"WBI cids: {cids_wb}"})
        # Prefer WBI data (matches upstream Bili23). Non-WBI may return stale/wrong cids.
        if data_wb.get("code") == 0:
            data = data_wb
            cids_used = [p.get("cid") for p in data.get("data", {}).get("pages", [])]
            emit("progress", {"stage": "video_info", "message": f"Using WBI data, cids: {cids_used}"})
        elif data_nw.get("code") == 0:
            data = data_nw
            cids_used = [p.get("cid") for p in data.get("data", {}).get("pages", [])]
            emit("progress", {"stage": "video_info", "message": f"WBI failed, using non-WBI data, cids: {cids_used}"})
        else:
            raise RuntimeError("Video info error: both WBI and non-WBI endpoints failed")
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
                        "bvid": ep.get("bvid", vdata["bvid"]),
                        "duration": ep.get("arc", {}).get("duration", 0)
                    })
        else:
            pages = [{"page": p["page"], "part": p["part"], "cid": p["cid"], "duration": p["duration"], "bvid": vdata["bvid"]} for p in vdata.get("pages", [])]
        info = {"bvid": vdata["bvid"], "aid": vdata["aid"], "cid": vdata["cid"], "title": vdata["title"], "description": vdata["desc"], "duration": vdata["duration"], "cover": vdata["pic"].replace("http://", "https://"), "uploader": vdata["owner"]["name"], "uploader_uid": vdata["owner"]["mid"], "pubdate": vdata["pubdate"], "pages": pages}
        emit("progress", {"stage": "video_info", "message": f"Got: {info['title']}"})
        return info

    def _do_get_play_url(self, bvid: str, cid: int) -> dict:
        # Try multiple quality params to handle pages with limited quality options
        emit("progress", {"stage": "play_url", "message": f"Requesting play URL for bvid={bvid} cid={cid}"})
        param_sets = [
            {"bvid": bvid, "cid": cid, "qn": 0, "fnver": 0, "fnval": 4048},
            {"bvid": bvid, "cid": cid, "qn": 0, "fnver": 0, "fnval": 0},
            {"bvid": bvid, "cid": cid, "qn": 80, "fnver": 0, "fnval": 4048},
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
                emit("progress", {"stage": "play_url", "message": f"API response: code={code} msg={last_msg} full={json.dumps(data, ensure_ascii=False)[:500]}"})
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
        # Fallback: try non-WBI endpoint (legacy API)
        emit("progress", {"stage": "play_url", "message": "WBI endpoints all failed, trying legacy playurl..."})
        import urllib.parse as _up
        legacy_params = {"bvid": bvid, "cid": cid, "qn": 0, "fnval": 4048, "platform": "web"}
        legacy_url = f"https://api.bilibili.com/x/player/playurl?{_up.urlencode(legacy_params)}"
        resp = self.client.get(legacy_url); data = resp.json()
        code = data.get("code", -1)
        if code != 0:
            emit("progress", {"stage": "play_url", "message": f"Legacy API response: code={code} msg={data.get('message')}"})
        else:
            d = data.get("data", {})
            dash = d.get("dash", {})
            # Try DASH format first
            audio_streams = sorted([a for a in dash.get("audio", [])], key=lambda x: x.get("bandwidth", 0), reverse=True)
            audio_url = None; bandwidth = 0
            if audio_streams:
                audio = audio_streams[0]
                audio_url = audio.get("baseUrl") or audio.get("base_url") or audio.get("url", "")
                bandwidth = audio.get("bandwidth", 0)
            # Fallback: try durl format
            if not audio_url:
                durl_list = d.get("durl", [])
                if durl_list:
                    audio_url = durl_list[0].get("url", "")
                    bandwidth = 0
                    emit("progress", {"stage": "play_url", "message": "Legacy: using non-DASH durl format"})
            if audio_url:
                emit("progress", {"stage": "play_url", "message": f"Legacy play URL OK ({bandwidth//1000}kbps)"})
                return {"audio_url": audio_url, "bandwidth": bandwidth}
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
        # Resolve page-specific bvid (may differ from URL bvid for ugc_season/collections)
        page_bvid = bvid
        if page_cid and video_info.get("pages"):
            for p in video_info["pages"]:
                if p["cid"] == page_cid and p.get("bvid"):
                    page_bvid = p["bvid"]
                    break
        play_url = self.get_play_url(page_bvid, active_cid)
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
