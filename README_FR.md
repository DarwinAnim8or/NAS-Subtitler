# NAS-Subtitler


<div align="center">

# 🚀 Un outil de sous-titres dédié pour votre médiathèque NAS.

**Languages:** [English](README.md) | [中文](README_CN.md) | [繁體中文](README_TW.md) | [Deutsch](README_DE.md) | [Español](README_ES.md) | [Français](README_FR.md) | [日本語](README_JA.md) | [한국어](README_KO.md) | [Русский](README_RU.md)

</div>

**Rendez le sous-titrage à votre NAS｜Make your NAS talk.**

Un soir de week-end, vous voulez simplement appuyer sur lecture. NAS-Subtitler surveille votre dossier **`/data`** mappé : détecte les nouvelles vidéos → segmente l’audio localement et proprement → transcription automatique avec **traduction contextuelle** → écrit des sous-titres propres dans le répertoire d’origine. Pas besoin de surveiller une barre de progression, rien ne quitte votre serveur.  
Cette expérience « bien sûr, ça doit fonctionner ainsi » vient de l’esprit de l’auto-hébergement — **contrôle local, confidentialité d’abord. Your media, your server, your way.**

## ✅ Pour qui (scénarios typiques)

**NAS (Jellyfin / Plex / Emby)**  

- Priorités : automatisation à l’échelle de la bibliothèque, nommage cohérent, plug-and-play  
- Attentes : mapper un répertoire → file d’attente → écrire un SRT au même nom, sans perturber l’ordre existant

**Organisations soucieuses de la confidentialité et de la conformité (juridique/formation médicale, etc.)**  

- Priorités : calcul local, auditabilité  
- Attentes : n’envoyer que les **segments audio minimisés** vers l’endpoint compatible choisi, lorsque nécessaire

**Utilisateurs open source et extensions**  

- Priorités : remplaçable, extensible  
- Attentes : Docker-first, API compatibles OpenAI, roadmap claire, PR facilitées

---

## ✨ Pourquoi NAS-Subtitler (en clair)

- **Local-first & respectueux de la vie privée**  
Avec **Silero-VAD (ONNX)** sur votre NAS, nous détectons « où la parole a lieu », découpons l’audio proprement et légèrement, puis transcrivons et traduisons — la **vidéo complète ne quitte jamais** votre serveur.
- **Expérience de traduction contextuelle**  [Prévu]
Pas une traduction « phrase par phrase » hachée. Nous **fusionnons par fenêtres sémantiques → traduisons → réinjectons**, pour des sous-titres qui se lisent comme écrits par un humain — pertinent pour les films et les cours en ligne.
- **Automatisation à l’échelle de la bibliothèque, fiable comme un appareil**  
Surveillance des répertoires → pilotage des files → réessais en cas d’échec → **écriture d’un SRT au même nom**, naturellement compatible avec les règles de Jellyfin/Plex/Emby.
- **Multilingue & sortie bilingue**  [Prévu]
Génération multi-langues en une fois ; option **chinois–anglais côte à côte** (même fichier ou séparés), utile pour l’apprentissage et le visionnage.
- **Open-source & Docker-first**  
Transparent et auditables ; démarrage en une commande ; dépendances et cadence de mises à jour claires. FFmpeg gère l’extraction et le traitement A/V — écosystème mature, stable multi-plateforme.

---

## 🧩 Fonctionnement

```
/data (videos)
   └─ Watch  →  FFmpeg extrait l’audio  →  Silero-VAD (ONNX) local pour le découpage
                   └→ Reconnaissance par segments (ASR) → transcription whisper-v3 → corrections de ponctuation/chronologie [Prévu]
                   └→ Écriture des sous-titres (SRT / VTT / ASS, selon besoin)
Web UI : démarrer des tâches / suivre la progression / annuler en un clic         DB : persistance des tâches et de la configuration
```

- **FFmpeg** : extraction audio / traitement des formats (standard de facto)  
- **Silero-VAD (ONNX)** : détection d’activité vocale rapide, légère et précise — idéale pour un NAS  
- **Protocole compatible OpenAI** : apportez votre propre clé API ou endpoint ; maîtrisez coût et vitesse

---

## 🚀 Démarrage rapide (Docker Compose)

1. **Prérequis** : le NAS supporte Docker  
2. **Cloner ou tirer l’image** : `git clone ...` (ou tirer l’image directement)  
3. **Démarrer** :

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

5. **Accès** : ouvrez `http://<NAS-IP>:3000` pour accéder à l’interface web  
6. **Paramétrage** : entrez votre clé OpenAI dans la page Paramètres

---

## 🖱️ Utilisation (prise en main en 5 minutes)

1. **Choisir le répertoire** : pointez vers votre dossier vidéos (ex. `/data/Movies`)  
2. **Lancer une tâche** : cliquez sur « Start Processing », choisissez la langue cible de transcription/traduction, la sortie bilingue, etc.  
3. **Suivre la progression** : dans la page « Tasks », visualisez la file et l’état ; annulation/réessai en un clic  
4. **Sortie** : les sous-titres sont générés dans le **même dossier que la vidéo** (ex. `movie.srt` ou `movie.zh-en.srt`)  
5. **Reconnaissance par le serveur multimédia** : rescanez la bibliothèque pour appliquer les sous-titres

---

## 🧰 Vue d’ensemble des fonctionnalités

- **Véritable open-source** : totalement transparent ; s’exécute localement sur NAS pour garantir la confidentialité des données  
- **Self-serve (BYO-Key)** : utilisez votre propre clé OpenAI pour transcrire et traduire — **contrôle total**  
- **Traduction contextuelle [Prévu]** : traitement par fenêtres sémantiques ; traductions cohérentes et naturelles, sans ruptures  
- **Support bilingue** : option chinois–anglais côte à côte (même fichier ou séparés)  
- **Traitement par lots** : un clic pour générer automatiquement des sous-titres pour films/séries  
- **Support multilingue** : meilleure reconnaissance multi-langues et **correction de ponctuation** pour une lecture fluide

---

## 🧱 Dépendances (pour les ingénieurs)

- **FFmpeg** : extraction et traitement A/V  
- **Silero-VAD (ONNX)** : détection d’activité vocale (VAD)  
- **Node.js et packages associés** : p. ex., Prisma (base de données), EJS (templates), etc.  
- **OpenAI API (self-serve)** : tout endpoint conforme au protocole compatible est interchangeable

---

## 🗒️ Changelog

- **v1.0.0**  
  - Ajout du **contrôle de concurrence pour les tâches par lots**, traitement plus rapide et plus stable  
  - Correction de divers problèmes d’UI et d’erreurs en cas limites

> Pour la liste complète des changements, cliquez sur « View Changelog » dans l’interface web.

---

## 🧭 Roadmap

- [ ] **Traduction** → transcription de bout en bout + traduction via LLM, garantir l’utilité
- [ ] **Deuxième passe de traduction** → utiliser un LLM pour affiner les sous-titres déjà traduits
- [ ] **Optimisation de la chronologie** → améliorer l’alignement temporel des sous-titres
- [ ] **Reconnaissance concurrente légère** → parallélisme limité pour accélérer les longues vidéos  
- [ ] **Aperçu web** → vérification rapide via chronologie/forme d’onde  
- [ ] **Plus de fournisseurs** → prise en charge de davantage de providers

---

## 🤝 Contribution & Communauté

Contributions bienvenues ! Forkez le dépôt et soumettez un Pull Request.  
Pour les changements majeurs, ouvrez d’abord un Issue ; gabarits de plateforme (Synology/Unraid/TrueNAS), adaptateurs de providers et i18n bienvenus.

---

## 📝 Licence

Ce projet est sous licence **MIT** (voir le dépôt pour les détails).

---

## 🙏 Remerciements & Références

- FFmpeg — fondation technique
- Silero-VAD (ONNX)