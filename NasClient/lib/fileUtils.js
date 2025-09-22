const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MOUNT_DIR } = require('./config');

function md5File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function getOutputAudioPathFromVideo(videoFullPath) {
  const md5 = await md5File(videoFullPath);
  const audioDir = path.join(MOUNT_DIR, 'data', 'temp');
  return path.join(audioDir, `${md5}.mp3`);
}

function getSubtitlePathFromAudio(audioPath) {
  const dir = path.dirname(audioPath);
  const base = path.basename(audioPath, path.extname(audioPath));
  return path.join(dir, `${base}.srt`);
}

function resolveDirSafe(rel) {
  const relNorm = path.normalize(rel || '').replace(/^\.+[\\\/]/, '');
  const full = path.join(MOUNT_DIR, relNorm);
  const fullNorm = path.normalize(full);
  const baseNorm = path.normalize(MOUNT_DIR + path.sep);
  if (!fullNorm.startsWith(baseNorm) && fullNorm !== path.normalize(MOUNT_DIR)) return null;
  return fullNorm;
}

function detectSubtitles(dir, videoFilename, allowed) {
  try {
    const allowedSet = new Set(Array.from(allowed || [] ).map(s => String(s).trim().toLowerCase()));
    const ext = path.extname(videoFilename);
    const base = path.basename(videoFilename, ext);
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const allSuffixes = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const name = e.name;
      if (name === videoFilename) continue;
      if (!name.startsWith(base + '.')) continue;
      const suffix = name.slice(base.length + 1);
      if (suffix) allSuffixes.push(suffix);
    }
    const normSuffixes = allSuffixes.map(s => String(s || '').trim().toLowerCase());
    const suffixes = normSuffixes.filter(s => {
      const p = s.lastIndexOf('.');
      const se = (p >= 0 ? s.slice(p + 1) : s);
      return allowedSet.has(se);
    }).sort((a, b) => a.localeCompare(b, 'zh-CN'));

    let suf = suffixes;
    if (suf.length === 0) {
      try {
        for (const extShort of Array.from(allowedSet)) {
          const cand = path.join(dir, `${base}.${extShort}`);
          if (fs.existsSync(cand)) {
            if (!suf.includes(extShort)) suf.push(extShort);
          }
        }
      } catch (_) {}
    }

    const subExtList = Array.from(allowedSet);
    const baseExist = subExtList.some(x => suf.includes(x));
    const enExist = subExtList.some(x => suf.includes(`en.${x}`));
    const cnExist = subExtList.some(x => suf.includes(`cn.${x}`));
    const has = suf.length > 0;
    return { base: baseExist, en: enExist, cn: cnExist, has, suffixes: suf };
  } catch (_) {
    return { base: false, en: false, cn: false, has: false, suffixes: [] };
  }
}

function isVideoFileName(name, videoExtSet) {
  const ext = path.extname(name).toLowerCase();
  return videoExtSet && typeof videoExtSet.has === 'function' ? videoExtSet.has(ext) : false;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${units[i]}`;
}

function formatDate(d) {
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  return `${yyyy}.${mm}.${dd} ${HH}:${MM}`;
}

function walkVideoFiles(baseDir, videoExts, recursive = true) {
  const fileEntries = [];
  (function visit(dirAbs) {
    let ents = [];
    try { ents = fs.readdirSync(dirAbs, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const abs = path.join(dirAbs, e.name);
      if (e.isDirectory()) { if (recursive) visit(abs); continue; }
      if (e.isFile() && isVideoFileName(e.name, videoExts)) {
        const dirRel = path.relative(MOUNT_DIR, dirAbs).split(path.sep).join('/');
        fileEntries.push({ dirAbs, dirRel, name: e.name, abs });
      }
    }
  })(baseDir);
  return fileEntries;
}

module.exports = { md5File, getOutputAudioPathFromVideo, getSubtitlePathFromAudio, resolveDirSafe, detectSubtitles, isVideoFileName, formatBytes, formatDate, walkVideoFiles };