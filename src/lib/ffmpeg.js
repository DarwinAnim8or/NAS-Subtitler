const { spawn } = require('child_process');

function getFfmpegCmd() {
  const p = process.env.FFMPEG_PATH && String(process.env.FFMPEG_PATH).trim();
  return p || 'ffmpeg';
}

function spawnFfmpeg(args, options) {
  const cmd = getFfmpegCmd();
  return spawn(cmd, args, options);
}

function _stderrPromise(child) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    if (child.stderr) child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', (e) => reject(e));
    child.on('close', (code) => {
      if (code === 0) resolve({ code, stderr });
      else reject(new Error(stderr || `ffmpeg exit ${code}`));
    });
  });
}

async function extractAudio(input, output, { bitrate = '192k', channels = 2 } = {}) {
  const args = ['-y', '-i', input, '-vn', '-ac', String(channels), '-b:a', String(bitrate), output];
  const child = spawnFfmpeg(args);
  await _stderrPromise(child);
}

async function cutAudioSegment(input, startSec, endSec, output, { bitrate = '96k', channels = 1, ar = 16000 } = {}) {
  const s = Math.max(0, Number(startSec) || 0).toFixed(3);
  const e = Math.max(Number(s), Number(endSec) || 0).toFixed(3);
  const args = ['-y', '-ss', s, '-to', e, '-i', input, '-vn', '-ac', String(channels), '-ar', String(ar), '-b:a', String(bitrate), output];
  const child = spawnFfmpeg(args);
  await _stderrPromise(child);
}

async function convertToWav(input, output, { ar = 16000, channels = 1 } = {}) {
  const args = ['-y', '-i', input, '-ar', String(ar), '-ac', String(channels), '-f', 'wav', '-acodec', 'pcm_s16le', output];
  const child = spawnFfmpeg(args);
  await _stderrPromise(child);
}

async function compressAudio(input, output, { ar = 16000, channels = 1, bitrate = '64k' } = {}) {
  const args = ['-y', '-i', input, '-ac', String(channels), '-ar', String(ar), '-b:a', String(bitrate), output];
  const child = spawnFfmpeg(args);
  await _stderrPromise(child);
}

// 为语音识别准备较小体积的音频（SambaNova Whisper 限制 ~25MB），必要时压缩到 16kHz/单声道/64k -> 32k
async function prepareAudioForTranscription(inputPath, fsModule, pathModule) {
  const fs = fsModule || require('fs');
  const path = pathModule || require('path');
  const LIMIT = 25 * 1024 * 1024; // 25MB
  try {
    const stat = fs.statSync(inputPath);
    if (stat.size <= LIMIT) return inputPath;
  } catch (e) {
    throw new Error('原始音频不存在');
  }

  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const out1 = path.join(dir, `${base}.asr.16k.m4a`);

  // 首次压缩 64k
  await (async () => {
    const child = spawnFfmpeg(['-y', '-i', inputPath, '-ac', '1', '-ar', '16000', '-b:a', '64k', out1]);
    await _stderrPromise(child);
  })();

  try {
    const s1 = fs.statSync(out1).size;
    if (s1 <= LIMIT) return out1;
  } catch {}

  // 二次更小码率 32k
  const out2 = path.join(dir, `${base}.asr.16k.32k.m4a`);
  await (async () => {
    const child = spawnFfmpeg(['-y', '-i', out1, '-ac', '1', '-ar', '16000', '-b:a', '32k', out2]);
    await _stderrPromise(child);
  })();
  const s2 = fs.statSync(out2).size;
  if (s2 > LIMIT) throw new Error('音频过大，压缩后仍超过 25MB 限制');
  return out2;
}

module.exports = {
  spawn: spawnFfmpeg,
  extractAudio,
  cutAudioSegment,
  convertToWav,
  compressAudio,
  prepareAudioForTranscription,
};