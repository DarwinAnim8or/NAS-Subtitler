# NAS-Subtitler


<div align="center">

**🚀 Una herramienta de subtítulos dedicada para tu biblioteca multimedia NAS.**

**Languages:** [English](README.md) | [中文](README_CN.md) | [繁體中文](README_TW.md) | [Deutsch](README_DE.md) | [Español](README_ES.md) | [Français](README_FR.md) | [日本語](README_JA.md) | [한국어](README_KO.md) | [Русский](README_RU.md)

</div>

**Devuelve el trabajo de subtitulado a tu NAS｜Make your NAS talk.**

En una tranquila noche de fin de semana, solo quieres darle a reproducir. NAS-Subtitler vigila tu carpeta **`/data`** mapeada: detecta nuevos vídeos → corta el audio localmente y con limpieza → transcribe automáticamente con **traducción consciente del contexto** → escribe subtítulos limpios en el directorio original. Sin cuidar barras de progreso, sin que tu contenido salga del servidor.  
Esta experiencia “como debe ser” nace del espíritu del autoalojamiento — **control local, privacidad primero. Your media, your server, your way.**

## ✅ Para quién (escenarios típicos)

**NAS (Jellyfin / Plex / Emby)**  

- Enfoque: automatización a nivel de biblioteca, nombres coherentes, plug-and-play  
- Expectativa: mapear directorio → cola → escribir SRT con el mismo nombre, sin alterar el orden existente

**Organizaciones centradas en privacidad y cumplimiento (legal/formación médica, etc.)**  

- Enfoque: cómputo local, capacidad de auditoría  
- Expectativa: enviar solo **segmentos de audio minimizados** a tu endpoint compatible elegido cuando sea necesario

**Usuarios y desarrolladores de open source**  

- Enfoque: reemplazable, extensible  
- Expectativa: Docker-first, APIs compatibles con OpenAI, roadmap claro, fácil de hacer PR

---

## ✨ Por qué NAS-Subtitler (explicado claro)

- **Local-first y respetuoso con la privacidad**  
Con **Silero-VAD (ONNX)** en tu NAS detectamos “dónde hay voz”, cortamos el audio limpio y ligero, y luego transcribimos y traducimos — el **vídeo completo nunca sale** de tu servidor.
- **Traducción consciente del contexto**  [Planificado]
No es una traducción “frase por frase” entrecortada. **Unimos por ventanas semánticas → traducimos → rellenamos**, logrando subtítulos que se leen como escritos por una persona — ideal para películas y cursos online.
- **Automatización a nivel de biblioteca, fiable como un electrodoméstico**  
Vigilar directorios → gestionar colas → reintentar ante fallos → **escribir SRT con el mismo nombre**, naturalmente compatible con las reglas de reconocimiento de Jellyfin/Plex/Emby.
- **Multilingüe y salida bilingüe**  [Planificado]
Genera varios idiomas a la vez; opción **chino–inglés lado a lado** (en el mismo archivo o por separado), útil para aprendizaje y visualización.
- **Open source y Docker-first**  
Transparente y auditable; se levanta con un solo comando; dependencias y ritmo de actualización claros. FFmpeg maneja extracción y procesamiento A/V — ecosistema maduro, estable multiplataforma.

---

## 🧩 Cómo funciona

```
/data (videos)
   └─ Watch  →  FFmpeg extrae audio  →  Silero-VAD (ONNX) local para trocear
                   └→ Reconocimiento por segmentos (ASR) → transcripción con whisper-v3 → corrección de puntuación/timeline [Planificado]
                   └→ Escribir subtítulos (SRT / VTT / ASS, según necesidad)
Web UI: iniciar tareas / ver progreso / cancelar con un clic         DB: persistencia de tareas y configuración
```

- **FFmpeg**: extracción de audio / procesado de formatos (estándar de facto)
- **Silero-VAD (ONNX)**: detección de actividad de voz rápida, ligera y precisa — ideal para NAS
- **Protocolo compatible con OpenAI**: trae tu propia API key o endpoint; control de coste y velocidad

---

## 🚀 Inicio rápido (Docker Compose)

1. **Requisito**: el NAS soporta Docker  
2. **Clonar o tirar imagen**: `git clone ...` (o tirar la imagen directamente)  
3. **Arrancar**:

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

5. **Acceso**: abre `http://<NAS-IP>:3000` para usar la interfaz web  
6. **Configuración**: entra en Ajustes y pon tu OpenAI API key

---

## 🖱️ Uso (puesto en marcha en 5 minutos)

1. **Elegir directorio**: apunta a tu carpeta de vídeos (ej., `/data/Movies`)  
2. **Iniciar tarea**: haz clic en “Start Processing”, elige idioma objetivo de transcripción/traducción, salida bilingüe, etc.  
3. **Monitorizar progreso**: en la página “Tasks” ve la cola y el estado; admite cancelar/reintentar con un clic  
4. **Salida**: los subtítulos se generan en la **misma carpeta que el vídeo** (p. ej., `movie.srt` o `movie.zh-en.srt`)  
5. **Reconocimiento del servidor multimedia**: reescanea tu biblioteca para ver los subtítulos aplicados

---

## 🧰 Resumen de funciones

- **Open source real**: totalmente transparente; corre localmente en NAS y garantiza la privacidad de los datos  
- **Self-serve (BYO-Key)**: usa tu propia OpenAI API key para transcribir y traducir — **control total**  
- **Traducción consciente del contexto [Planificado]**: procesamiento por ventanas semánticas; traducciones coherentes y naturales, sin brusquedades  
- **Soporte bilingüe**: opción chino–inglés lado a lado (mismo archivo o separados)  
- **Procesamiento por lotes**: un clic para generar subtítulos automáticamente para películas/series  
- **Soporte multilingüe**: mejor reconocimiento multilingüe y **corrección de puntuación** para lectura más fluida

---

## 🧱 Dependencias (para ingenieros)

- **FFmpeg**: extracción y procesamiento de audio/vídeo  
- **Silero-VAD (ONNX)**: detección de actividad de voz (VAD)  
- **Node.js y paquetes relacionados**: p. ej., Prisma (BD), EJS (plantillas), etc.  
- **OpenAI API (self-serve)**: cualquier endpoint que cumpla el protocolo compatible es intercambiable

---

## 🗒️ Changelog

- **v1.0.0**  
  - Añadido **control de concurrencia para tareas por lotes**, procesamiento más rápido y estable  
  - Corregidos varios problemas de UI y errores de casos límite

> Para ver todos los cambios, haz clic en “View Changelog” en la interfaz web.

---

## 🧭 Roadmap

- [ ] **Traducción** → transcripción de extremo a extremo + traducción con LLM, asegurar utilidad
- [ ] **Segunda pasada de traducción** → usar LLM para refinar subtítulos ya traducidos
- [ ] **Optimización de timeline** → mejorar la alineación temporal de subtítulos
- [ ] **Reconocimiento concurrente ligero** → paralelismo con limitación de tasa para acelerar vídeos largos  
- [ ] **Vista previa web** → verificación rápida mediante timeline/forma de onda  
- [ ] **Más proveedores** → soporte para más vendors

---

## 🤝 Contribución & Comunidad

¡Bienvenidas las contribuciones! Haz fork al repo y envía un Pull Request.  
Para cambios grandes, abre primero un Issue; se agradecen plantillas de plataforma (Synology/Unraid/TrueNAS), adaptadores de proveedores e i18n.

---

## 📝 Licencia

Este proyecto está bajo licencia **MIT** (ver el repositorio para detalles).

---

## 🙏 Agradecimientos & Referencias

- FFmpeg — base técnica
- Silero-VAD (ONNX)