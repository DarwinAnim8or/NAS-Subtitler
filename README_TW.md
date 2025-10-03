# NAS-Subtitler


<div align="center">

# 🚀 為你的 NAS 媒體庫，打造專屬字幕工具。

**Languages:** [English](README.md) | [中文](README_CN.md) | [繁體中文](README_TW.md) | [Deutsch](README_DE.md) | [Español](README_ES.md) | [Français](README_FR.md) | [日本語](README_JA.md) | [한국어](README_KO.md) | [Русский](README_RU.md)

</div>

**把字幕工作，放回你的 NAS｜Make your NAS talk.**

週末夜，你只想按下開始。NAS-Subtitler 守在你映射的 **`/data`** 資料夾旁：發現新影片 → 本地切好語音片段 → 自動轉寫與**上下文翻譯** → 在原目錄**寫回乾淨的字幕**。你無需盯進度條，也不必擔心素材外流。  
這種「理所當然」的體驗，來自自託管世界的共同信念——**本地控制，隱私優先，Your media, your server, your way**。

## ✅ 我們為誰而做（典型場景）

**NAS（Jellyfin / Plex / Emby）**  

- 關心：整庫自動化、規範命名、即插即用  
- 期望：映射目錄→隊列→寫回同名 SRT，不打擾既有媒體秩序

**重視隱私與合規的組織（法務/醫療培訓等）**  

- 關心：本地計算、可稽核  
- 期望：僅在必要時傳送**最小化音訊片段**至你所選的相容端點

**開源愛好者與二次開發者**  

- 關心：可替換、可擴展  
- 期望：Docker-first、OpenAI 相容介面、清晰 roadmap、容易提 PR

---

## ✨ 為何選擇 NAS-Subtitler（人話版賣點）

- **本地優先 & 隱私友好**  
先用 **Silero-VAD（ONNX）** 在 NAS 上判斷「哪裡有人在說話」，把音訊切得乾淨、輕量，再去識別與翻譯，**整段影片永不外傳**。
- **上下文感知的翻譯體驗**  【規劃中】
不是「逐句割裂」的機翻，而是按語義視窗**合併 → 翻譯 → 回填**，讓整條字幕「像是人寫的」一樣順滑——看電影與線上課程都不出戲。
- **庫級自動化，像家電一樣可靠**  
看護目錄 → 隊列調度 → 失敗重試 → **寫回同名 SRT**，與 Jellyfin/Plex/Emby 的識別規則天然契合。
- **多語言 & 雙語輸出**  【規劃中】
一次產生多語言字幕；可選**中英對照**（同檔或分檔），學習與觀影兩相宜。
- **Open-source & Docker-first**  
透明可稽核；一條命令起服務；依賴與更新節奏清晰。FFmpeg 負責音視訊抽取與處理，生態成熟、跨平台穩定。

---

## 🧩 工作原理（How it works）

```
/data (videos)
   └─ Watch  →  FFmpeg 抽音訊  →  本地 Silero-VAD(ONNX) 切片
                   └→ 分段識別（ASR） → 調用 whisper-v3 轉寫 → 標點/時軸修正【規劃中】
                   └→ 寫回字幕（SRT / VTT / ASS，按需）
Web UI：開始任務 / 看進度 / 一鍵取消         DB：任務與設定持久化
```

- **FFmpeg**：音訊抽取 / 格式處理（業界事實標準）  
- **Silero-VAD（ONNX）**：快速、輕量、準確的語音活動檢測，適合 NAS 場景  
- **OpenAI 相容協定**：自帶 API Key 或自選端點，成本與速度皆可控

---

## 🚀 快速開始（Docker Compose）

1. **前提**：NAS 支援 Docker  
2. **克隆或拉映像**：`git clone ...`（或直接拉映像）  
3. **啟動**：

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

5. **存取**：開啟 `http://<NAS-IP>:3000` 進入 Web 介面  
6. **設定**：進入設定頁面填入 OpenAI API Key

---

## 🖱️ 使用（5 分鐘上手）

1. **選擇目錄**：指向你的影片資料夾（如 `/data/Movies`）  
2. **啟動任務**：點擊「開始處理」，選擇識別與翻譯目標語言、雙語輸出等  
3. **監控進度**：在「任務」頁查看隊列與處理狀態，支援一鍵取消/重試  
4. **輸出**：字幕會生成在**影片同目錄**（`movie.srt` 或 `movie.zh-en.srt` 等）  
5. **媒體伺服識別**：重掃媒體庫即可看到字幕生效

---

## 🧰 特點一覽

- **真正開源**：完全透明，可在 NAS 本地運行，確保資料隱私  
- **自助模式（BYO-Key）**：使用你的 OpenAI API Key 完成字幕轉寫與翻譯，**完全掌控**  
- **上下文翻譯【規劃中】**：按語義視窗處理，譯文連貫自然、不突兀不割裂  
- **雙語支援**：可選中英對照（同檔或分檔）  
- **批量處理**：一鍵為電影/劇集自動生成字幕  
- **多語言支援**：優化多語種識別與**標點修復**，讀起來更順暢

---

## 🧱 依賴（面向工程師）

- **FFmpeg**：音視訊抽取與處理  
- **Silero-VAD（ONNX）**：語音活動檢測（VAD）  
- **Node.js 及相關套件**：如 Prisma（資料庫）、EJS（模板）等  
- **OpenAI API（自助模式）**：遵循相容協定的端點均可切換

---

## 🗒️ 更新日誌（Changelog）

- **v1.0.0**  
  - 新增**批量任務並發控制**，處理更快更穩  
  - 修復若干 UI 問題與邊緣場景錯誤

> 完整變更請在 Web 介面點擊「查看更新日誌」。

---

## 🧭 版本計畫（Roadmap）

- [ ] **翻譯** → 端到端轉寫 + 大模型翻譯，確保可用
- [ ] **翻譯二次潤色** → 使用 AI 大模型對已翻譯字幕進行二次潤色
- [ ] **時間軸優化** → 字幕時間軸對齊優化
- [ ] **輕並發識別** → 分段限流並行，加速長片處理  
- [ ] **Web 預覽** → 時間軸/波形快速校驗  
- [ ] **更多供應商** → 支援更多的供應商

---

## 🤝 貢獻與交流

歡迎貢獻程式碼！請 fork 倉庫並提交 Pull Request。  
建議先開 Issue 討論較大的變更；歡迎提供平台模板（Synology/Unraid/TrueNAS）、Provider 適配與 i18n。

---

## 📝 授權

本專案採用 **MIT** 授權（以倉庫為準）。

---

## 🙏 致謝與參考

- FFmpeg — 技術基石
- Silero-VAD（ONNX）