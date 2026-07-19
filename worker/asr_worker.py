#!/usr/bin/env python3
"""ASR worker: VAD segmentation + pluggable ASR backends.
Called by the Tauri frontend via shell spawn.

Backends:
  sherpa-onnx  (default) - local Paraformer via sherpa-onnx
  api          - remote ASR API (MiMo-V2.5 via Chat Completions)

Outputs JSON lines to stdout (same protocol regardless of backend):
  {"type":"progress","chunk":1,"total":20,"text":"..."}
  {"type":"result","text":"...","segments":[{"start":0,"end":2.5,"text":"..."}]}
  {"type":"error","message":"..."}
"""

import sys, os
os.environ["PYTHONIOENCODING"] = "utf-8"
if sys.stdout is not None:
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr is not None:
    sys.stderr.reconfigure(encoding="utf-8")

import json, wave, time, argparse, base64
import io
import numpy as np
import httpx


def detect_speech_segments(samples, sample_rate=16000, threshold=0.02,
                           min_dur=1.0, max_dur=60.0, min_silence=0.5):
    sr = sample_rate
    frame_size = int(sr * 0.025)
    total_frames = len(samples) // frame_size
    if total_frames == 0:
        return []
    energies = []
    for i in range(total_frames):
        start = i * frame_size
        end = start + frame_size
        chunk = samples[start:end]
        e = np.mean(chunk.astype(np.float64) ** 2)
        energies.append(e)
    max_e = max(energies) if energies else 1.0
    if max_e == 0:
        return []
    segments = []
    in_speech = False
    speech_start = 0
    silence_frames = 0
    for i, e in enumerate(energies):
        is_speech = (e / max_e) > threshold
        if is_speech and not in_speech:
            in_speech = True
            speech_start = i
            silence_frames = 0
        elif not is_speech and in_speech:
            silence_frames += 1
            if silence_frames * frame_size >= min_silence * sr:
                seg_start = speech_start * frame_size / sr
                seg_end = (i - silence_frames) * frame_size / sr
                dur = seg_end - seg_start
                if dur >= min_dur:
                    if dur > max_dur:
                        pos = seg_start
                        while pos < seg_end:
                            end = min(pos + max_dur, seg_end)
                            segments.append((pos, end))
                            pos = end
                    else:
                        segments.append((seg_start, seg_end))
                in_speech = False
        elif is_speech and in_speech:
            silence_frames = 0
    if in_speech:
        seg_start = speech_start * frame_size / sr
        seg_end = total_frames * frame_size / sr
        dur = seg_end - seg_start
        if dur >= min_dur:
            segments.append((seg_start, seg_end))
    return segments


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", default="sherpa-onnx",
                        choices=["sherpa-onnx", "api"],
                        help="ASR backend: sherpa-onnx (local) or api (remote)")
    parser.add_argument("--wav", default=None, help="16kHz mono WAV file")
    parser.add_argument("--daemon", action="store_true", help="Run as long-lived daemon, reading requests from stdin")
    parser.add_argument("--model", default="paraformer", choices=["paraformer", "sensevoice"])
    parser.add_argument("--models-dir", default=None, help="Models root directory")
    parser.add_argument("--api-url", default=None, help="ASR API endpoint (Chat Completions)")
    parser.add_argument("--api-key", default=None, help="ASR API key (api-key header)")
    parser.add_argument("--threshold", type=float, default=0.02, help="VAD energy threshold")
    parser.add_argument("--no-vad", action="store_true", help="Disable VAD, use whole audio")
    args = parser.parse_args()

    if args.daemon:
        if args.backend == "api":
            emit_error("Daemon mode not supported with API backend")
            return
        run_sherpa_daemon(args)
        return

    if not args.wav:
        emit_error("--wav is required in non-daemon mode")
        return

    if args.backend == "api":
        run_api_backend(args)
    else:
        run_sherpa_backend(args)


# ---------------------------------------------------------------------------
# API backend -- MiMo Chat Completions with input_audio
# ---------------------------------------------------------------------------

def run_api_backend(args):
    api_url = args.api_url
    api_key = args.api_key
    if not api_url:
        emit_error("--api-url is required for API backend")
        return

    samples = load_wav(args.wav)
    if samples is None:
        return

    total_dur = len(samples) / 16000
    chunk_dur = 300  # 5 minutes per chunk
    segments = [(i, min(i + chunk_dur, total_dur)) for i in range(0, int(total_dur) + 1, chunk_dur)]

    total_chunks = len(segments)
    all_segments = []
    full_text_parts = []

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["api-key"] = api_key
    client = httpx.Client(timeout=httpx.Timeout(120.0))

    for i, (start_s, end_s) in enumerate(segments):
        start_idx = int(start_s * 16000)
        end_idx = int(end_s * 16000)
        chunk = samples[start_idx:end_idx]
        if len(chunk) < 1600:
            continue
        text = call_asr_api(client, api_url, headers, chunk, 16000)
        if text:
            if full_text_parts and text == full_text_parts[-1]:
                continue
            full_text_parts.append(text)
            all_segments.append({
                "start": round(start_s, 2),
                "end": round(end_s, 2),
                "text": text,
            })
        emit_progress(i + 1, total_chunks, text)
        # Small delay to avoid rate limiting
        time.sleep(0.5)

    client.close()
    emit_result("\n".join(full_text_parts), all_segments)


# ---------------------------------------------------------------------------
# Sherpa-onnx daemon -- long-lived process, model loaded once
# ---------------------------------------------------------------------------

def _load_sherpa_model(args):
    if args.models_dir:
        models_root = args.models_dir
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(script_dir, "models"),
            os.path.join(script_dir, "src-tauri", "models"),
            os.path.join(os.getcwd(), "models"),
            os.path.join(os.getcwd(), "src-tauri", "models"),
        ]
        models_root = next((d for d in candidates if os.path.isdir(d)), None)
        if not models_root:
            emit_error("Models directory not found")
            return None
    model_name = "paraformer-large" if args.model == "paraformer" else "sense-voice-small"
    model_dir = os.path.join(models_root, model_name)
    if not os.path.isdir(model_dir):
        emit_error(f"Model directory not found: {model_dir}")
        return None
    inner = model_dir
    for f in sorted(os.listdir(model_dir)):
        sub = os.path.join(model_dir, f)
        if os.path.isdir(sub) and os.path.exists(os.path.join(sub, "model.int8.onnx")):
            inner = sub
            break
    model_path = os.path.join(inner, "model.int8.onnx")
    tokens_path = os.path.join(inner, "tokens.txt")
    if not os.path.exists(model_path):
        emit_error(f"Model file not found: {model_path}")
        return None
    try:
        from sherpa_onnx import offline_recognizer as o
    except ImportError:
        emit_error("sherpa-onnx not installed. Run: pip install sherpa-onnx")
        return None
    try:
        if args.model == "paraformer":
            rec = o.OfflineRecognizer.from_paraformer(
                paraformer=str(model_path), tokens=str(tokens_path),
                num_threads=4, sample_rate=16000,
            )
        else:
            emit_error("SenseVoice not supported")
            return None
    except Exception as e:
        emit_error(f"Failed to load ASR model: {e}")
        return None
    return rec


def _daemon_emit(kind, data):
    sys.stdout.write(json.dumps({"type": kind, **data}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def run_sherpa_daemon(args):
    """Daemon mode: HTTP server on localhost, model loaded once."""
    from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
    import threading

    rec = _load_sherpa_model(args)
    if rec is None:
        print("FATAL: Failed to load model", file=sys.stderr, flush=True)
        sys.exit(1)

    daemon_port = int(args.daemon_port) if hasattr(args, "daemon_port") and args.daemon_port else 9876

    class AsrHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass  # suppress HTTP access logs

        def do_POST(self):
            if self.path == "/recognize":
                try:
                    cl = int(self.headers.get("Content-Length", 0))
                    body = json.loads(self.rfile.read(cl))
                    wav_path = body.get("wav_path", "")
                    samples = load_wav(wav_path)
                    if samples is None:
                        self._json_reply(500, {"text": "", "error": "Failed to load WAV"})
                        return
                    total_dur = len(samples) / 16000
                    chunk_dur = 300
                    chunks = [(i, min(i + chunk_dur, total_dur)) for i in range(0, int(total_dur) + 1, chunk_dur)]
                    full_text_parts = []
                    all_segments = []
                    for start_s, end_s in chunks:
                        start_idx = int(start_s * 16000)
                        end_idx = int(end_s * 16000)
                        chunk = samples[start_idx:end_idx]
                        if len(chunk) < 1600:
                            continue
                        stream = rec.create_stream()
                        stream.accept_waveform(16000, chunk)
                        rec.decode_stream(stream)
                        text = stream.result.text.strip()
                        if text:
                            if full_text_parts and text == full_text_parts[-1]:
                                continue
                            full_text_parts.append(text)
                            all_segments.append({"start": round(start_s, 2), "end": round(end_s, 2), "text": text})
                    self._json_reply(200, {"text": "\n".join(full_text_parts), "segments": all_segments})
                except Exception as e:
                    self._json_reply(500, {"text": "", "error": str(e)})
            elif self.path == "/health":
                self._json_reply(200, {"status": "ok", "model": args.model})
            elif self.path == "/shutdown":
                self._json_reply(200, {"status": "shutting_down"})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
            else:
                self._json_reply(404, {"error": "not found"})

        def _json_reply(self, code, data):
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    server = ThreadingHTTPServer(("127.0.0.1", daemon_port), AsrHandler)
    sys.stdout.write(json.dumps({"type": "ready", "port": daemon_port}) + "\n")
    sys.stdout.flush()
    server.serve_forever()



def call_asr_api(client, api_url, headers, audio_chunk, sample_rate):
    """Send audio chunk as base64 WAV via Chat Completions input_audio."""
    int_samples = (audio_chunk * 32767).clip(-32768, 32767).astype(np.int16)
    wav_buf = io.BytesIO()
    with wave.open(wav_buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(int_samples.tobytes())
    audio_b64 = base64.b64encode(wav_buf.getvalue()).decode("ascii")

    payload = {
        "model": "mimo-v2.5-asr",
        "messages": [{
            "role": "user",
            "content": [{
                "type": "input_audio",
                "input_audio": {
                    "data": f"data:audio/wav;base64,{audio_b64}"
                }
            }]
        }],
        "asr_options": {"language": "zh"},
    }
    try:
        resp = client.post(api_url, json=payload, headers=headers)
        if resp.status_code != 200:
            emit_error(f"ASR API HTTP {resp.status_code}: {resp.text[:300]}")
            return ""
        result = resp.json()
        choices = result.get("choices", [])
        if choices:
            text = choices[0].get("message", {}).get("content", "").strip()
            return text
        emit_error(f"ASR API unexpected response: {json.dumps(result, ensure_ascii=False)[:300]}")
        return ""
    except Exception as e:
        emit_error(f"ASR API error: {e}")
        return ""


# ---------------------------------------------------------------------------
# Sherpa-onnx backend -- local Paraformer
# ---------------------------------------------------------------------------

def run_sherpa_backend(args):
    if args.models_dir:
        models_root = args.models_dir
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(script_dir, "models"),
            os.path.join(script_dir, "src-tauri", "models"),
            os.path.join(os.getcwd(), "models"),
            os.path.join(os.getcwd(), "src-tauri", "models"),
        ]
        models_root = next((d for d in candidates if os.path.isdir(d)), None)
        if not models_root:
            emit_error("Models directory not found")
            return

    model_name = "paraformer-large" if args.model == "paraformer" else "sense-voice-small"
    model_dir = os.path.join(models_root, model_name)
    if not os.path.isdir(model_dir):
        emit_error(f"Model directory not found: {model_dir}")
        return

    inner = model_dir
    for f in sorted(os.listdir(model_dir)):
        sub = os.path.join(model_dir, f)
        if os.path.isdir(sub) and os.path.exists(os.path.join(sub, "model.int8.onnx")):
            inner = sub
            break

    model_path = os.path.join(inner, "model.int8.onnx")
    tokens_path = os.path.join(inner, "tokens.txt")
    if not os.path.exists(model_path):
        emit_error(f"Model file not found: {model_path}")
        return

    try:
        from sherpa_onnx import offline_recognizer as o
    except ImportError:
        emit_error("sherpa-onnx not installed. Run: pip install sherpa-onnx")
        return

    try:
        if args.model == "paraformer":
            rec = o.OfflineRecognizer.from_paraformer(
                paraformer=str(model_path), tokens=str(tokens_path),
                num_threads=4, sample_rate=16000,
            )
        else:
            emit_error("SenseVoice not supported")
            return
    except Exception as e:
        emit_error(f"Failed to load ASR model: {e}")
        return

    samples = load_wav(args.wav)
    if samples is None:
        return

    total_dur = len(samples) / 16000
    chunk_dur = 300  # 5 minutes per chunk
    segments = [(i, min(i + chunk_dur, total_dur)) for i in range(0, int(total_dur) + 1, chunk_dur)]

    total_chunks = len(segments)
    all_segments = []
    full_text_parts = []

    for i, (start_s, end_s) in enumerate(segments):
        start_idx = int(start_s * 16000)
        end_idx = int(end_s * 16000)
        chunk = samples[start_idx:end_idx]
        if len(chunk) < 1600:
            continue
        stream = rec.create_stream()
        stream.accept_waveform(16000, chunk)
        rec.decode_stream(stream)
        text = stream.result.text.strip()
        if text:
            if full_text_parts and text == full_text_parts[-1]:
                continue
            full_text_parts.append(text)
            all_segments.append({
                "start": round(start_s, 2),
                "end": round(end_s, 2),
                "text": text,
            })
        emit_progress(i + 1, total_chunks, text)

    emit_result("\n".join(full_text_parts), all_segments)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def load_wav(path):
    try:
        with wave.open(path, "r") as w:
            nchannels = w.getnchannels()
            sr = w.getframerate()
            nframes = w.getnframes()
            data = w.readframes(nframes)
        samples = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
        if nchannels > 1:
            samples = samples.reshape(-1, nchannels).mean(axis=1)
        return samples
    except Exception as e:
        emit_error(f"Failed to load WAV: {e}")
        return None


def emit_progress(chunk, total, text):
    sys.stdout.write(json.dumps({
        "type": "progress",
        "chunk": chunk,
        "total": total,
        "text": text,
    }, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_result(text, segments):
    sys.stdout.write(json.dumps({
        "type": "result",
        "text": text,
        "segments": segments,
    }, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_error(message):
    sys.stdout.write(json.dumps({
        "type": "error",
        "message": message,
    }, ensure_ascii=False) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        sys.stderr.write(json.dumps({
            "type": "error",
            "message": str(e),
            "traceback": traceback.format_exc(),
        }, ensure_ascii=False) + "\n")
        sys.stderr.flush()
        sys.exit(2)
