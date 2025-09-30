# NAS-Subtitler


<div align="center">

**🚀 Ein dediziertes Untertitel-Tool für deine NAS-Mediathek.**

**Languages:** [English](README.md) | [中文](README_CN.md) | [繁體中文](README_TW.md) | [Deutsch](README_DE.md) | [Español](README_ES.md) | [Français](README_FR.md) | [日本語](README_JA.md) | [한국어](README_KO.md) | [Русский](README_RU.md)

</div>

**Bring die Untertitel-Arbeit zurück auf dein NAS｜Make your NAS talk.**

An einem ruhigen Wochenendabend willst du einfach Play drücken. NAS-Subtitler überwacht deinen gemappten **`/data`**-Ordner: neue Videos erkennen → Audio lokal sauber segmentieren → automatische Transkription mit **kontextbewusster Übersetzung** → saubere Untertitel im ursprünglichen Verzeichnis zurückschreiben. Kein Fortschrittsbalken babysitten, keine Medien verlassen deinen Server.  
Dieses „so sollte es selbstverständlich funktionieren“-Erlebnis entspringt der Self-Hosting-Ethik — **lokale Kontrolle, Privatsphäre zuerst. Your media, your server, your way.**

## ✅ Für wen (typische Szenarien)

**NAS (Jellyfin / Plex / Emby)**  

- Fokus: Automatisierung auf Bibliotheksebene, saubere Benennung, Plug-and-Play  
- Erwartung: Ordner zuordnen → in die Warteschlange stellen → SRT mit gleichem Namen zurückschreiben, ohne die vorhandene Medienordnung zu stören

**Organisationen mit Fokus auf Privatsphäre & Compliance (Recht/medizinische Schulung usw.)**  

- Fokus: lokale Verarbeitung, Auditierbarkeit  
- Erwartung: nur bei Bedarf **minimalisierte Audiosegmente** an deinen kompatiblen Endpunkt senden

**Open-Source-Nutzer und -Erweiterer**  

- Fokus: austauschbar, erweiterbar  
- Erwartung: Docker-first, OpenAI-kompatible Schnittstellen, klare Roadmap, PR-freundlich

---

## ✨ Warum NAS-Subtitler (auf den Punkt gebracht)

- **Local-first & datenschutzfreundlich**  
Mit **Silero-VAD (ONNX)** auf dem NAS erkennen wir, „wo gesprochen wird“, schneiden Audio sauber und leicht, dann transkribieren und übersetzen — das **gesamte Video verlässt deinen Server nie**.
- **Kontextbewusste Übersetzungserfahrung**  [Geplant]
Keine abgehackte „Satz-für-Satz“-Maschinenübersetzung. Wir **fusionieren semantische Fenster → übersetzen → füllen zurück**, sodass die Untertitel wie von Menschen geschrieben klingen — passend für Filme und Online-Kurse.
- **Automatisierung auf Bibliotheksebene, zuverlässig wie ein Gerät**  
Ordner überwachen → Warteschlangen steuern → bei Fehlern erneut versuchen → **SRT mit gleichem Namen zurückschreiben**, natürlich kompatibel mit den Erkennungsregeln von Jellyfin/Plex/Emby.
- **Mehrsprachig & zweisprachige Ausgabe**  [Geplant]
Mehrere Sprachen auf einmal generieren; optional **Chinesisch–Englisch nebeneinander** (gleiche Datei oder getrennte Dateien), geeignet für Lernen und Unterhaltung.
- **Open-Source & Docker-first**  
Transparent und auditierbar; mit einem Befehl starten; klare Abhängigkeiten und Update-Rhythmus. FFmpeg übernimmt A/V-Extraktion und -Verarbeitung — reifes Ökosystem, plattformübergreifend stabil.

---

## 🧩 Funktionsweise

```
/data (videos)
   └─ Watch  →  FFmpeg Audio extrahieren  →  Lokales Silero-VAD (ONNX) Slicing
                   └→ Segmenterkennung (ASR) → whisper-v3 Transkription → Satzzeichen/Timeline-Korrekturen [Geplant]
                   └→ Untertitel schreiben (SRT / VTT / ASS, je nach Bedarf)
Web UI: Aufgaben starten / Fortschritt verfolgen / mit einem Klick abbrechen         DB: Aufgaben & Konfiguration persistent speichern
```

- **FFmpeg**: Audioextraktion / Formatverarbeitung (Industriestandard)
- **Silero-VAD (ONNX)**: schnelle, leichte, präzise Spracherkennung (VAD) — ideal für NAS
- **OpenAI-kompatibles Protokoll**: bring deinen eigenen API-Schlüssel oder Endpunkt mit; Kosten und Geschwindigkeit im Griff

---

## 🚀 Schnellstart (Docker Compose)

1. **Voraussetzung**: NAS unterstützt Docker  
2. **Klonen oder Image ziehen**: `git clone ...` (oder Image direkt ziehen)  
3. **Starten**:

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

5. **Zugriff**: öffne `http://<NAS-IP>:3000`, um die Weboberfläche zu verwenden  
6. **Einrichtung**: trage deinen OpenAI API-Schlüssel in den Einstellungen ein

---

## 🖱️ Nutzung (in 5 Minuten startklar)

1. **Verzeichnis wählen**: zeige auf deinen Videofolder (z. B. `/data/Movies`)  
2. **Aufgabe starten**: klicke „Start Processing“, wähle Zielsprachen für Erkennung/Übersetzung, zweisprachige Ausgabe usw.  
3. **Fortschritt überwachen**: im „Tasks“-Bereich Warteschlangen & Status verfolgen; Ein-Klick-Abbruch/Wiederholen möglich  
4. **Ausgabe**: Untertitel werden im **gleichen Verzeichnis wie das Video** erzeugt (z. B. `movie.srt` oder `movie.zh-en.srt`)  
5. **Medienserver-Erkennung**: Bibliothek erneut scannen, um Untertitel wirksam zu machen

---

## 🧰 Funktionsübersicht

- **Echt Open-Source**: vollständig transparent; läuft lokal auf NAS und schützt deine Daten  
- **Self-Serve (BYO-Key)**: nutze deinen eigenen OpenAI API-Schlüssel für Transkription & Übersetzung — **volle Kontrolle**  
- **Kontextbewusste Übersetzung [Geplant]**: Verarbeitung anhand semantischer Fenster; kohärente, natürliche Übersetzungen ohne Brüche  
- **Zweisprachige Unterstützung**: optional Chinesisch–Englisch nebeneinander (gleiche oder separate Dateien)  
- **Batch-Verarbeitung**: ein Klick, um Untertitel für Filme/Serien automatisch zu erzeugen  
- **Mehrsprachige Unterstützung**: verbesserte Mehrspracherkennung und **Satzzeichen-Korrekturen** für flüssigeres Lesen

---

## 🧱 Abhängigkeiten (für Ingenieure)

- **FFmpeg**: Audio/Video-Extraktion und -Verarbeitung  
- **Silero-VAD (ONNX)**: Voice Activity Detection (VAD)  
- **Node.js und zugehörige Pakete**: z. B. Prisma (Datenbank), EJS (Templates) usw.  
- **OpenAI API (Self-Serve)**: jeder Endpunkt, der dem kompatiblen Protokoll folgt, ist umschaltbar

---

## 🗒️ Changelog

- **v1.0.0**  
  - **Gleichzeitige Steuerung für Batch-Aufgaben** hinzugefügt, schnellere und stabilere Verarbeitung  
  - Diverse UI-Probleme und Randfallfehler behoben

> Für vollständige Änderungen: „View Changelog“ in der Weboberfläche.

---

## 🧭 Roadmap

- [ ] **Übersetzung** → Ende-zu-Ende-Transkription + LLM-Übersetzung, praxisnah sicherstellen
- [ ] **Zweite Übersetzungsüberarbeitung** → LLM zur Verfeinerung bereits übersetzter Untertitel
- [ ] **Timeline-Optimierung** → bessere Ausrichtung der Untertitel-Zeitcodes
- [ ] **Leichtgewichtige gleichzeitige Erkennung** → gedrosselte Parallelität zur Beschleunigung langer Videos  
- [ ] **Web-Vorschau** → schnelle Prüfung per Timeline/Wellenform  
- [ ] **Weitere Anbieter** → Unterstützung für mehr Provider

---

## 🤝 Beitragen & Community

Beiträge willkommen! Bitte das Repo forken und einen Pull Request einreichen.  
Für größere Änderungen bitte zunächst ein Issue eröffnen; Vorlagen für Plattformen (Synology/Unraid/TrueNAS), Provider-Adapter und i18n sind willkommen.

---

## 📝 Lizenz

Dieses Projekt steht unter **MIT**-Lizenz (siehe Repository).

---

## 🙏 Danke & Referenzen

- FFmpeg — technische Grundlage
- Silero-VAD (ONNX)