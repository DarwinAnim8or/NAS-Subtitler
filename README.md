# NAS-Subtitler


<div align="center">

*🚀 A dedicated subtitle tool for your NAS media library.*

**Languages:** [English](README.md) | [中文](README_CN.md) | [繁體中文](README_TW.md) | [Deutsch](README_DE.md) | [Español](README_ES.md) | [Français](README_FR.md) | [日本語](README_JA.md) | [한국어](README_KO.md) | [Русский](README_RU.md)

</div>

**Put subtitle work back on your NAS｜Make your NAS talk.**

On a quiet weekend night, you just want to press play. NAS-Subtitler watches your mapped **`/data`** folder: detects new videos → slices clean audio locally → auto transcription with **context-aware translation** → writes back neat subtitles in the original directory. No progress-bar babysitting, no media leaving your server.
This “of course it should work like this” experience comes from the self-hosting ethos — **local control, privacy first. Your media, your server, your way.**

## ✅ Who It's For (Typical Scenarios)

**NAS (Jellyfin / Plex / Emby)**  

- Focus: library-wide automation, sane naming, plug-and-play  
- Expectation: map directory → queue → write back same-named SRT, without disturbing the media order

**Privacy- and compliance-minded organizations (legal/medical training, etc.)**  

- Focus: local computation, auditability  
- Expectation: only send the **minimal audio segments** to your chosen compatible endpoint when necessary

**Open-source users and extenders**  

- Focus: replaceable, extensible  
- Expectation: Docker-first, OpenAI-compatible APIs, clear roadmap, PR-friendly

---

## ✨ Why NAS-Subtitler (In Plain English)

- **Local-first & privacy-friendly**  
Use **Silero-VAD (ONNX)** on your NAS to detect “where speech happens,” slice audio cleanly and lightly, then transcribe and translate — the **full video never leaves** your server.
- **Context-aware translation experience**  [Planned]
Not a choppy “sentence-by-sentence” machine translation. We **merge by semantic windows → translate → fill back**, making the subtitle read as if a human wrote it — suitable for movies and online courses alike.
- **Library-level automation, reliable like an appliance**  
Watch directories → schedule queues → retry on failures → **write back same-named SRT**, naturally compatible with Jellyfin/Plex/Emby’s recognition rules.
- **Multilingual & bilingual output**  [Planned]
Generate multiple languages at once; optional **Chinese–English side-by-side** (same file or separate files), good for both learning and viewing.
- **Open-source & Docker-first**  
Transparent and auditable; spin up with one command; clear dependencies and update cadence. FFmpeg handles A/V extraction and processing — mature ecosystem, stable across platforms.

---

## 🧩 How It Works

```
/data (videos)
   └─ Watch  →  FFmpeg extract audio  →  Local Silero-VAD (ONNX) slicing
                   └→ Segment recognition (ASR) → whisper-v3 transcription → punctuation/timeline fixes [Planned]
                   └→ Write subtitles (SRT / VTT / ASS, as needed)
Web UI: start tasks / track progress / one-click cancel         DB: persist tasks and configuration
```

- **FFmpeg**: audio extraction / format processing (industry-standard)
- **Silero-VAD (ONNX)**: fast, lightweight, accurate voice activity detection — ideal for NAS
- **OpenAI-compatible protocol**: bring your own API key or endpoint; control cost and speed

---

## 🚀 Quick Start (Docker Compose)

1. **Prerequisite**: NAS supports Docker  
2. **Clone or pull image**: `git clone ...` (or pull the image directly)  
3. **Start**:

```yaml
services:
  nas-subtitler:
    image: ghcr.io/yourname/nas-subtitler:latest
    container_name: nas-subtitler
    environment:
      - TZ=Asia/Shanghai
      - MOUNT_DIR=/data
    volumes:
      - /path/to/videos:/data
      - /path/to/config:/app/data/config
    ports:
      - "3000:3000"
    restart: unless-stopped
```

5. **Access**: open `http://<NAS-IP>:3000` to enter the Web UI
6. **Setup**: go to Settings and enter your OpenAI API key

---

## 🖱️ Usage (5-Minute Onboarding)

1. **Choose directory**: point to your video folder (e.g., `/data/Movies`)  
2. **Start a task**: click “Start Processing,” choose transcription/translation target language, bilingual output, etc.  
3. **Monitor progress**: use the “Tasks” page to view queue and status; supports one-click cancel/retry  
4. **Output**: subtitles are generated in the **same folder as the video** (e.g., `movie.srt` or `movie.zh-en.srt`)  
5. **Media server recognition**: rescan your library to see subtitles take effect

---

## 🧰 Feature Overview

- **Truly open-source**: fully transparent; runs locally on NAS to ensure data privacy  
- **Self-serve (BYO-Key)**: use your own OpenAI API key for transcription and translation — **full control**  
- **Context-aware translation [Planned]**: process by semantic windows; coherent, natural translations without abruptness  
- **Bilingual support**: optional Chinese–English side-by-side (same or separate files)  
- **Batch processing**: one click to auto-generate subtitles for movies/TV series  
- **Multilingual support**: improved multi-language recognition and **punctuation fixes** for smoother reading

---

## 🧱 Dependencies (For Engineers)

- **FFmpeg**: audio/video extraction and processing  
- **Silero-VAD (ONNX)**: voice activity detection (VAD)  
- **Node.js and related packages**: e.g., Prisma (database), EJS (templates), etc.  
- **OpenAI API (self-serve)**: any endpoint conforming to the compatible protocol can be switched

---

## 🗒️ Changelog

- **v1.0.0**  
  - Added **concurrent control for batch tasks**, faster and more stable processing  
  - Fixed various UI issues and edge-case errors

> For full changes, click “View Changelog” in the Web UI.

---

## 🧭 Roadmap

- [ ] **Translation** → end-to-end transcription + LLM translation, ensure usefulness
- [ ] **Translation second pass** → use LLM to refine already translated subtitles
- [ ] **Timeline optimization** → improve subtitle timing alignment
- [ ] **Lightweight concurrent recognition** → rate-limited parallelism to speed up long videos  
- [ ] **Web preview** → quick verification via timeline/waveform  
- [ ] **More providers** → support more vendors

---

## 🤝 Contributing & Community

Contributions welcome! Please fork the repo and submit a Pull Request.  
For larger changes, consider opening an Issue first; contributions to platform templates (Synology/Unraid/TrueNAS), provider adapters, and i18n are welcome.

---

## 📝 License

This project is licensed under **MIT** (see the repository for details).

---

## 🙏 Thanks & References

- FFmpeg — the technical foundation
- Silero-VAD (ONNX)