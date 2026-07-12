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
        emit("progress", {"stage": "wbi_keys", "message": "Checking WBI key cache..."})
        try:
            self.img_key, self.sub_key = get_cached_wbi_keys(self.client)
        except Exception as _e:
            emit("progress", {"stage": "wbi_keys", "message": f"Cache read failed: {_e}"})
            self.img_key = ""; self.sub_key = ""
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
        if output_path.exists():
            size_mb = output_path.stat().st_size / 1024 / 1024
            emit("progress", {"stage": "download", "message": f"Audio already exists ({size_mb:.1f}MB), skipping download"})
            return output_path
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
        emit("progress", {"stage": "start", "message": "Worker starting..."})
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
        # Download with retry: re-fetch play URL on each attempt for fresh CDN URL
        last_err = None
        for dl_attempt in range(3):
            if dl_attempt > 0:
                delay = pow(2, dl_attempt)
                emit("progress", {"stage": "download", "message": f"Retrying with fresh URL ({dl_attempt+1}/3) in {delay}s..."})
                time.sleep(delay)
            try:
                play_url = self.get_play_url(page_bvid, active_cid)
                audio_path = self.download_audio(play_url["audio_url"], audio_tag)
                result = {"video_info": video_info, "audio_path": str(audio_path.absolute())}
                emit("result", result)
                return result
            except Exception as e:
                last_err = e
                emit("progress", {"stage": "download", "message": f"Download attempt {dl_attempt+1} failed: {e}"})
        raise last_err

    def run_batch(self, preview_only=False, page_cids=None):
        bvid = self.parse_bvid()
        self.fetch_wbi_keys()
        video_info = self.get_video_info(bvid)
        if preview_only:
            emit("result", {"video_info": video_info})
            return {"video_info": video_info}
        results = []
        for page_cid in page_cids:
            active_cid = page_cid
            audio_tag = f"{bvid}_p{active_cid}"
            page_bvid = bvid
            if video_info.get("pages"):
                for p in video_info["pages"]:
                    if p["cid"] == page_cid and p.get("bvid"):
                        page_bvid = p["bvid"]
                        break
            emit("progress", {"stage": "batch", "message": f"Page {len(results)+1}/{len(page_cids)} cid={page_cid} bvid={page_bvid}"})
            last_err = None
            for dl_attempt in range(3):
                if dl_attempt > 0:
                    delay = pow(2, dl_attempt)
                    emit("progress", {"stage": "download", "message": f"Retrying ({dl_attempt+1}/3) in {delay}s..."})
                    time.sleep(delay)
                try:
                    play_url = self.get_play_url(page_bvid, active_cid)
                    audio_path = self.download_audio(play_url["audio_url"], audio_tag)
                    results.append({"cid": page_cid, "bvid": page_bvid, "audio_path": str(audio_path.absolute())})
                    break
                except Exception as e:
                    last_err = e
                    emit("progress", {"stage": "download", "message": f"Attempt {dl_attempt+1} failed: {e}"})
            else:
                emit("progress", {"stage": "batch", "message": f"FAILED cid={page_cid} after 3 attempts: {last_err}"})
        result = {"video_info": video_info, "results": results}
        emit("result", result)
        return result

def _mode_sms_captcha(client):
    url = "https://passport.bilibili.com/x/passport-login/captcha?source=main-fe-header"
    resp = client.get(url)
    data = resp.json()
    if data.get("code") != 0:
        import time as _t2
        ts = int(_t2.time() * 1000)
        url2 = f"https://passport.bilibili.com/x/passport-login/web/captcha/combine?platform=web&source=main-fe-header&ts={ts}"
        resp2 = client.get(url2)
        data2 = resp2.json()
        if data2.get("code") != 0:
            raise RuntimeError("Captcha failed: " + data2.get("message", "unknown"))
        data = data2
    c = data.get("data", {})
    result = {
        "token": c.get("token", ""),
        "gt": c.get("geetest", {}).get("gt", ""),
        "challenge": c.get("geetest", {}).get("challenge", ""),
        "type": c.get("type", ""),
    }
    emit("result", result)


def _mode_sms_send(client, cid, tel, captcha_token, challenge, validate, seccode):
    params = {
        "cid": cid, "tel": tel, "source": "main-fe-header",
        "token": captcha_token, "challenge": challenge,
        "validate": validate, "seccode": seccode,
    }
    url = "https://passport.bilibili.com/x/passport-login/web/sms/send"
    resp = client.post(url, data=params)
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError("SMS send failed: " + data.get("message", "unknown"))
    emit("result", {"captcha_key": data["data"]["captcha_key"], "sent": True})


def _mode_sms_login(client, cid, tel, code, captcha_key, cookies_file):
    params = {
        "cid": cid, "tel": tel, "code": code, "source": "main-fe-header",
        "captcha_key": captcha_key, "go_url": "https://www.bilibili.com/",
    }
    url = "https://passport.bilibili.com/x/passport-login/web/login/sms"
    resp = client.post(url, data=params)
    data = resp.json()
    if data.get("code") != 0:
        msg = str(data.get("message", "unknown"))
        raise RuntimeError("SMS login failed: " + msg)

    COOKIE_KEYS = ["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid"]
    cookies = {}
    for key in COOKIE_KEYS:
        val = client.cookies.get(key, domain=".bilibili.com")
        if val:
            cookies[key] = val

    if not cookies.get("SESSDATA"):
        raw = resp.headers.get("set-cookie", "")
        parts = raw.split(",")
        for p in parts:
            seg = p.strip().split(";")[0]
            if "=" in seg:
                k, v = seg.split("=", 1)
                k = k.strip()
                if k in COOKIE_KEYS:
                    cookies[k] = v

    if cookies_file and cookies:
        with open(cookies_file, "w") as f:
            json.dump(cookies, f)

    emit("result", {"cookies": cookies, "logged_in": True})

def _mode_qr_generate(client):
    """Generate a QR code for Bilibili login."""
    url = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate?source=main-fe-header&go_url=https://www.bilibili.com/&web_location=333.1007"
    resp = client.get(url)
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"QR generate failed: {data.get('message', 'unknown')}")
    result = {"qr_url": data["data"]["url"], "qrcode_key": data["data"]["qrcode_key"]}
    emit("result", result)
    return result


def _mode_qr_poll(client, qrcode_key, cookies_file):
    """Poll QR code scan status. On success, save cookies from response."""
    url = f"https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key={qrcode_key}"
    resp = client.get(url)
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError('QR poll request failed: ' + str(data.get('message', 'unknown')))

    inner = data["data"]
    status_code = inner.get("code", -1)
    message = inner.get("message", "")
    cookies = {}

    if status_code == 0:
        # Success: extract cookies matching upstream Bili23's update_cookies() approach.
        # Upstream reads from requests.Session cookie jar. With httpx, the client stores
        # Set-Cookie response headers in its cookie jar automatically.
        COOKIE_KEYS = ["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid"]

        # Approach 1: read from httpx client cookie jar WITHOUT domain filter
        for key in COOKIE_KEYS:
            val = client.cookies.get(key)
            if val:
                cookies[key] = val

        # Approach 2: also try response-specific cookies
        for key in COOKIE_KEYS:
            if not cookies.get(key):
                val = resp.cookies.get(key)
                if val:
                    cookies[key] = val

        # Approach 3: iterate all cookies in the jar (catch any domain-filtered ones)
        if not cookies.get("SESSDATA"):
            for ck in client.cookies.jar:
                if ck.name in COOKIE_KEYS:
                    cookies[ck.name] = ck.value

        # Approach 4: parse Set-Cookie response headers
        if not cookies.get("SESSDATA"):
            raw = resp.headers.get("set-cookie", "")
            for line in raw.split(","):
                if not line.strip():
                    continue
                seg = line.strip().split(";")[0]
                if "=" in seg:
                    k, v = seg.split("=", 1)
                    k = k.strip()
                    if k in COOKIE_KEYS:
                        cookies[k] = v

        # Approach 5: Extract from redirect URL query params
        if not cookies.get("SESSDATA"):
            redirect_url = inner.get("url", "")
            if redirect_url and "?" in redirect_url:
                from urllib.parse import urlparse as _urlparse, parse_qs as _parse_qs
                try:
                    parsed = _urlparse(redirect_url)
                    qs = _parse_qs(parsed.query)
                    for key in COOKIE_KEYS:
                        if key in qs:
                            cookies[key] = qs[key][0]
                except Exception:
                    pass

        if not cookies.get("SESSDATA"):
            debug_info = {
                "raw_set_cookie": resp.headers.get("set-cookie", "")[:500],
                "jar_cookies": [f"{c.name}={c.value[:20]}" for c in client.cookies.jar],
                "response_url": inner.get("url", "")[:200],
            }
            emit("progress", {"stage": "qr_poll", "message": "Warning: no SESSDATA found. Debug: " + json.dumps(debug_info, ensure_ascii=False)})

        # Save cookies to file
        if cookies_file and cookies:
            try:
                with open(cookies_file, "w") as f:
                    json.dump(cookies, f)
                emit("progress", {"stage": "qr_poll", "message": "Cookies saved"})
            except Exception as e:
                emit("progress", {"stage": "qr_poll", "message": f"Failed to save cookies: {e}"})

        # Always include debug info in the success result so frontend can see what happened
        debug = {
            "resp_has_set_cookie": "set-cookie" in resp.headers,
            "client_cookies_count": len(list(client.cookies.jar)),
            "sessdata_found": bool(cookies.get("SESSDATA")),
        }
        result = {"status_code": status_code, "message": message, "cookies": cookies, "logged_in": True}
        result["_debug"] = debug
    elif status_code == 86038:
        result = {"status_code": status_code, "message": "QR code expired, please refresh", "logged_in": False}
    elif status_code == 86101:
        result = {"status_code": status_code, "message": "Waiting for scan...", "logged_in": False}
    elif status_code == 86090:
        result = {"status_code": status_code, "message": "Scanned! Please confirm on your phone", "logged_in": False}
    else:
        result = {"status_code": status_code, "message": message, "logged_in": False}

    emit("result", result)
    return result


def _load_cookies(cookies_arg):
    """Load cookies from a file path or JSON string."""
    if not cookies_arg:
        return {}
    if cookies_arg.strip().startswith("{"):
        try:
            return json.loads(cookies_arg)
        except (json.JSONDecodeError, TypeError):
            pass
    try:
        with open(cookies_arg) as f:
            return json.load(f)
    except Exception:
        return {}


def _mode_fav_folders(client, cookies_arg):
    """List user's favorite folders."""
    cookies = _load_cookies(cookies_arg)
    if not cookies:
        raise RuntimeError("No cookies provided. Please login first.")

    user_url = "https://api.bilibili.com/x/web-interface/nav"
    resp = client.get(user_url, cookies=cookies)
    user_data = resp.json()
    if user_data.get("code") != 0 or not user_data.get("data", {}).get("isLogin"):
        raise RuntimeError("Not logged in or cookies expired.")

    uid = user_data["data"]["mid"]
    uname = user_data["data"]["uname"]
    face = user_data["data"].get("face", "")

    # Get created folders
    fav_url = f"https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid={uid}"
    resp = client.get(fav_url, cookies=cookies)
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Failed to get favorite folders: {data.get('message', 'unknown')}")

    folders = []
    for entry in data.get("data", {}).get("list", []):
        folders.append({
            "id": entry["id"],
            "title": entry["title"],
            "count": entry.get("media_count", 0),
            "mid": entry.get("mid", uid),
        })

    # Also get collected folders
    sub_url = f"https://api.bilibili.com/x/v3/fav/folder/collected/list?pn=1&ps=50&up_mid={uid}&platform=web&web_location=333.1387"
    try:
        resp = client.get(sub_url, cookies=cookies)
        sub_data = resp.json()
        if sub_data.get("code") == 0:
            for entry in sub_data.get("data", {}).get("list", []):
                folders.append({
                    "id": entry["id"],
                    "title": "[收藏] " + entry["title"],
                    "count": entry.get("media_count", 0),
                    "mid": entry.get("mid", uid),
                    "collected": True,
                })
    except Exception:
        pass

    result = {"uid": uid, "uname": uname, "face": face, "folders": folders}
    emit("result", result)
    return result


def _mode_fav_videos(client, cookies_arg, folder_id, page):
    """List videos in a specific favorite folder."""
    cookies = _load_cookies(cookies_arg)
    if not cookies:
        raise RuntimeError("No cookies provided. Please login first.")

    ps = 20
    params = {
        "media_id": folder_id,
        "pn": page,
        "ps": ps,
        "keyword": "",
        "order": "mtime",
        "type": 0,
        "tid": 0,
        "platform": "web",
        "web_location": "333.1387",
    }
    query = urllib.parse.urlencode(params)
    url = f"https://api.bilibili.com/x/v3/fav/resource/list?{query}"
    resp = client.get(url, cookies=cookies)
    data = resp.json()
    if data.get("code") != 0:
        raise RuntimeError(f"Failed to get favorite videos: {data.get('message', 'unknown')}")

    info = data.get("data", {}).get("info", {})
    total = info.get("media_count", 0)
    medias = data.get("data", {}).get("medias", []) or []

    videos = []
    for m in medias:
        videos.append({
            "bvid": m.get("bvid", ""),
            "title": m.get("title", ""),
            "cover": m.get("cover", ""),
            "duration": m.get("duration", 0),
            "uploader": m.get("upper", {}).get("name", ""),
            "uploader_uid": m.get("upper", {}).get("mid", 0),
            "cid": m.get("page", {}).get("cid", 0),
            "pubdate": m.get("pubdate", 0),
        })

    total_pages = (total + ps - 1) // ps if total > 0 else 0
    emit("result", {
        "folder_id": folder_id,
        "page": page,
        "total": total,
        "total_pages": total_pages,
        "videos": videos,
    })


def _mode_check_login(client, cookies_arg):
    """Check if current cookies are valid."""
    cookies = _load_cookies(cookies_arg)
    if not cookies:
        emit("result", {"logged_in": False, "uname": "", "uid": 0, "face": ""})
        return
    url = "https://api.bilibili.com/x/web-interface/nav"
    resp = client.get(url, cookies=cookies)
    data = resp.json()
    logged_in = data.get("code") == 0 and data.get("data", {}).get("isLogin", False)
    emit("result", {
        "logged_in": logged_in,
        "uname": data.get("data", {}).get("uname", ""),
        "uid": data.get("data", {}).get("mid", 0),
        "face": data.get("data", {}).get("face", ""),
    })


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default=None, help="Sub-mode: qr_generate, qr_poll, fav_folders, fav_videos, check_login")
    parser.add_argument("--url", required=False, default="")
    parser.add_argument("--output-dir", default="./downloads")
    parser.add_argument("--qrcode-key", default=None, help="QR code key for polling")
    parser.add_argument("--cookies", default=None, help="Cookies JSON string or path to cookies file")
    parser.add_argument("--cookies-file", default=None, help="Path to save cookies after login")
    parser.add_argument("--folder-id", type=int, default=None, help="Favorite folder ID")
    parser.add_argument("--page", type=int, default=1, help="Page number for listing")
    parser.add_argument("--cids", default=None, help="Comma-separated cids for batch download")
    parser.add_argument("--preview-only", action="store_true")
    parser.add_argument("--cid", type=int, default=None)
    parser.add_argument("--proxy", default=None)
    args = parser.parse_args()

    # Build client for mode operations
    limits = httpx.Limits(max_connections=10, max_keepalive_connections=10)
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Referer": "https://www.bilibili.com/"}
    mounts = {}
    if args.proxy:
        transport = httpx.HTTPTransport(proxy=args.proxy, retries=5)
        mounts = {"http://": transport, "https://": transport}
    mode_client = httpx.Client(limits=limits, timeout=30, headers=headers, mounts=mounts, follow_redirects=True)

    if args.mode:
        if args.mode == "qr_generate":
            _mode_qr_generate(mode_client)
        elif args.mode == "qr_poll":
            if not args.qrcode_key:
                emit("error", {"message": "--qrcode-key is required for qr_poll mode"})
                sys.exit(1)
            _mode_qr_poll(mode_client, args.qrcode_key, args.cookies_file)
        elif args.mode == "fav_folders":
            _mode_fav_folders(mode_client, args.cookies)
        elif args.mode == "fav_videos":
            if not args.folder_id:
                emit("error", {"message": "--folder-id is required for fav_videos mode"})
                sys.exit(1)
            _mode_fav_videos(mode_client, args.cookies, args.folder_id, args.page)
        elif args.mode == "sms_captcha":
            _mode_sms_captcha(mode_client)
        elif args.mode == "sms_send":
            if not args.qrcode_key:
                emit("error", {"message": "Need --qrcode-key=cid,tel,token,challenge,validate,seccode"})
                sys.exit(1)
            p = args.qrcode_key.split(",")
            if len(p) < 6:
                emit("error", {"message": "Need 6 comma-separated values"})
                sys.exit(1)
            _mode_sms_send(mode_client, p[0], p[1], p[2], p[3], p[4], p[5])
        elif args.mode == "sms_login":
            if not args.qrcode_key:
                emit("error", {"message": "Need --qrcode-key=cid,tel,code,captcha_key"})
                sys.exit(1)
            p = args.qrcode_key.split(",")
            if len(p) < 4:
                emit("error", {"message": "Need 4 comma-separated values"})
                sys.exit(1)
            _mode_sms_login(mode_client, p[0], p[1], p[2], p[3], args.cookies_file)

        elif args.mode == "check_login":
            _mode_check_login(mode_client, args.cookies)
        else:
            emit("error", {"message": f"Unknown mode: {args.mode}"})
            sys.exit(1)
        sys.exit(0)

    # Legacy mode: download
    try:
        worker = BiliWorker(args.url, args.output_dir, proxy=args.proxy)
        worker.run(preview_only=args.preview_only, page_cid=args.cid)
        sys.exit(0)
    except Exception as e:
        emit("error", {"message": str(e)})
        sys.exit(1)

if __name__ == "__main__":
    main()
