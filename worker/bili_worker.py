#!/usr/bin/env python3
"""
B绔欒棰戜俊鎭幏鍙栦笌闊抽涓嬭浇 Worker.
渚?Tauri 鍓嶇閫氳繃 shell 璋冪敤銆傝緭鍑?JSON lines 鍒?stdout锛?  {"type":"progress","stage":"...","message":"..."}
  {"type":"result","video_info":{...},"audio_path":"..."}
  {"type":"error","message":"..."}
"""

import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
if sys.stdout is not None:
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr is not None:
    sys.stderr.reconfigure(encoding="utf-8")

import json, re, time, argparse, hashlib, urllib.parse
import logging
from functools import reduce
from pathlib import Path

import httpx

logging.getLogger("httpx").setLevel("WARNING")

mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
]

def emit(kind: str, data: dict):
    print(json.dumps({"type": kind, **data}, ensure_ascii=False), flush=True)

class BiliWorker:
    def __init__(self, url: str, output_dir: str, proxy: str = None):
        self.url = url
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.proxy = proxy

        # httpx client with B绔?headers
        limits = httpx.Limits(max_connections=10, max_keepalive_connections=10)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/",
        }
        mounts = {}
        if proxy:
            transport = httpx.HTTPTransport(proxy=proxy, retries=5)
            mounts = {"http://": transport, "https://": transport}

        self.client = httpx.Client(
            limits=limits, timeout=30, headers=headers,
            mounts=mounts, follow_redirects=True
        )
        self.img_key = ""
        self.sub_key = ""

    def fetch_wbi_keys(self):
        """Get WBI signing keys from B绔?nav API."""
        emit("progress", {"stage": "wbi_keys", "message": "鑾峰彇WBI绛惧悕瀵嗛挜..."})
        try:
            resp = self.client.get("https://api.bilibili.com/x/web-interface/nav")
            data = resp.json()["data"]
            self.img_key = data["wbi_img"]["img_url"].split("/")[-1].split(".")[0]
            self.sub_key = data["wbi_img"]["sub_url"].split("/")[-1].split(".")[0]
            emit("progress", {"stage": "wbi_keys", "message": "WBI瀵嗛挜鑾峰彇鎴愬姛"})
        except Exception as e:
            emit("error", {"message": f"鑾峰彇WBI瀵嗛挜澶辫触: {e}"})
            raise

    def sign_wbi(self, params: dict) -> str:
        """WBI sign - derived from Bili23-Downloader's enc_wbi."""
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
        """Extract BV id from URL."""
        m = re.search(r"(?:BV|bv)(\w+)", self.url)
        if m:
            return f"BV{m.group(1)}"
        m = re.search(r"/(?:av|AV)(\d+)", self.url)
        if m:
            return self.aid_to_bvid(int(m.group(1)))
        raise ValueError(f"鏃犳硶浠嶶RL瑙ｆ瀽瑙嗛ID: {self.url}")

    @staticmethod
    def aid_to_bvid(aid: int) -> str:
        XOR_CODE = 23442827791579
        MAX_AID = 1 << 51
        ALPHABET = "FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf"
        ENCODE_MAP = [8, 7, 0, 5, 1, 3, 2, 4, 6]
        bvid = [""] * 9
        tmp = (MAX_AID | aid) ^ XOR_CODE
        for i in range(len(ENCODE_MAP)):
            bvid[ENCODE_MAP[i]] = ALPHABET[tmp % len(ALPHABET)]
            tmp //= len(ALPHABET)
        return "BV1" + "".join(bvid)

    def get_video_info(self, bvid: str) -> dict:
        """Get video metadata from B绔?API."""
        emit("progress", {"stage": "video_info", "message": "鑾峰彇瑙嗛淇℃伅..."})
        params = {"bvid": bvid}
        url = f"https://api.bilibili.com/x/web-interface/wbi/view?{self.sign_wbi(params)}"
        resp = self.client.get(url)
        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(f"鑾峰彇瑙嗛淇℃伅澶辫触: {data.get('message', '鏈煡閿欒')}")
        vdata = data["data"]
        info = {
            "bvid": vdata["bvid"],
            "aid": vdata["aid"],
            "cid": vdata["cid"],
            "title": vdata["title"],
            "description": vdata["desc"],
            "duration": vdata["duration"],
            "cover": vdata["pic"],
            "uploader": vdata["owner"]["name"],
            "uploader_uid": vdata["owner"]["mid"],
            "pubdate": vdata["pubdate"],
            "pages": [{"page": p["page"], "part": p["part"], "cid": p["cid"], "duration": p["duration"]} for p in vdata.get("pages", [])],
        }
        emit("progress", {"stage": "video_info", "message": f"瑙嗛淇℃伅鑾峰彇鎴愬姛: {info['title']}"})
        return info

    def get_play_url(self, bvid: str, cid: int) -> dict:
        """Get DASH play URL with audio stream."""
        emit("progress", {"stage": "play_url", "message": "鑾峰彇鎾斁鍦板潃..."})
        params = {
            "bvid": bvid,
            "cid": cid,
            "qn": 0,
            "fnver": 0,
            "fnval": 4048,
            "fourk": 1,
        }
        url = f"https://api.bilibili.com/x/player/wbi/playurl?{self.sign_wbi(params)}"
        resp = self.client.get(url)
        data = resp.json()
        if data.get("code") != 0:
            raise RuntimeError(f"鑾峰彇鎾斁鍦板潃澶辫触: {data.get('message', '鏈煡閿欒')}")
        dash = data["data"]["dash"]

        # Find best audio stream
        audio_streams = sorted(
            [a for a in dash.get("audio", [])],
            key=lambda x: x.get("bandwidth", 0),
            reverse=True
        )
        if not audio_streams:
            raise RuntimeError("鏈壘鍒伴煶棰戞祦")
        audio = audio_streams[0]
        audio_url = audio.get("baseUrl") or audio.get("base_url") or audio.get("url", "")
        if not audio_url:
            raise RuntimeError("闊抽URL涓虹┖")
        return {"audio_url": audio_url, "bandwidth": audio.get("bandwidth", 0)}

    def download_audio(self, audio_url: str, filename: str) -> Path:
        """Download audio m4a file."""
        output_path = self.output_dir / f"{filename}.m4a"
        emit("progress", {"stage": "download", "message": f"寮€濮嬩笅杞介煶棰?.."})

        headers = {"Referer": "https://www.bilibili.com/"}
        with self.client.stream("GET", audio_url, headers=headers) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("Content-Length", 0))
            downloaded = 0
            with open(output_path, "wb") as f:
                for chunk in resp.iter_bytes(chunk_size=8192):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0 and downloaded % (512 * 1024) < 8192:
                        pct = int(downloaded / total * 100)
                        emit("progress", {"stage": "download", "message": f"涓嬭浇涓?.. {pct}%"})

        size_mb = output_path.stat().st_size / 1024 / 1024
        emit("progress", {"stage": "download", "message": f"闊抽涓嬭浇瀹屾垚 ({size_mb:.1f}MB)"})
        return output_path

    def run(self) -> dict:
        bvid = self.parse_bvid()
        self.fetch_wbi_keys()
        video_info = self.get_video_info(bvid)
        play_url = self.get_play_url(bvid, video_info["cid"])
        audio_path = self.download_audio(play_url["audio_url"], bvid)

        result = {
            "video_info": video_info,
            "audio_path": str(audio_path.absolute()),
        }
        emit("result", result)
        return result


def main():
    parser = argparse.ArgumentParser(description="B绔欒棰戜俊鎭幏鍙栦笌闊抽涓嬭浇")
    parser.add_argument("--url", required=True, help="B绔欒棰慤RL")
    parser.add_argument("--output-dir", default="./downloads", help="杈撳嚭鐩綍")
    parser.add_argument("--proxy", default=None, help="HTTP浠ｇ悊鍦板潃 (濡?http://127.0.0.1:7897)")
    args = parser.parse_args()

    try:
        worker = BiliWorker(args.url, args.output_dir, proxy=args.proxy)
        worker.run()
        sys.exit(0)
    except Exception as e:
        emit("error", {"message": str(e)})
        sys.exit(1)


if __name__ == "__main__":
    main()

