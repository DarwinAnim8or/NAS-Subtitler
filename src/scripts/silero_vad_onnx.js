const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const ort = require('onnxruntime-node');
const wavDecoder = require('wav-decoder');
const ffmpeg = require('../lib/ffmpeg');

class SileroVAD {
  constructor() {
    this.session = null;
    // 优先将模型放到挂载目录，保证持久化；支持通过环境变量覆盖
    const MOUNT_DIR = process.env.MOUNT_DIR || '/data';
    this.modelPath = process.env.VAD_MODEL_PATH || path.join(MOUNT_DIR, 'config', 'models', 'silero_vad.onnx');
    this.sampleRate = 16000;
    this.windowSamples = 512; // default for 16kHz
    this.hiddenSize = 64; // 默认隐藏维度
    this.h = null; // shape [2,1,H]
    this.c = null; // shape [2,1,H]
    this.state = null; // shape [2,1,H] for models using single 'state'
    this.useState = false;
    this.inputNames = [];
    this.outputNames = [];
    this.inputMeta = {};
    this.outputMeta = {};
    this.io = null; // 缓存映射，便于运行时自适应更新
    this.srDtype = null; // 'int64' | 'int32' | null
  }

  async downloadModel() {
    if (fs.existsSync(this.modelPath)) return;
    // 确保目录存在
    fs.mkdirSync(path.dirname(this.modelPath), { recursive: true });

    const candidates = [
      process.env.VAD_MODEL_URL,
      // 国内镜像优先，其次官方；附加 download 参数以减少网页包装
      'https://hf-mirror.com/onnx-community/silero-vad/resolve/main/onnx/model.onnx?download=true',
      'https://hf-mirror.com/onnx-community/silero-vad/resolve/main/onnx/model.onnx',
      'https://huggingface.co/onnx-community/silero-vad/resolve/main/onnx/model.onnx?download=true',
      'https://huggingface.co/onnx-community/silero-vad/resolve/main/onnx/model.onnx',
    ].filter(Boolean);

    const errors = [];
    for (const url of candidates) {
      try {
        await this._fetchToFile(url, this.modelPath, 60000, 5); // 最多 5 次重定向，60s 超时
        // 简单校验非空和体积（避免误下 HTML）
        const stat = fs.statSync(this.modelPath);
        if (stat.size < 500000) throw new Error(`downloaded file too small: ${stat.size}`); // <0.5MB 视为异常
        const head = fs.readFileSync(this.modelPath, { encoding: 'utf8', flag: 'r' }).slice(0, 64);
        if (/<!DOCTYPE|<html|AccessDenied|<\?xml/i.test(head)) throw new Error('downloaded content looks like HTML/XML');
        return;
      } catch (e) {
        errors.push(`${url} -> ${e.message}`);
        try { fs.unlinkSync(this.modelPath); } catch {}
      }
    }
    throw new Error(`下载 Silero VAD 模型失败：\n${errors.join('\n')}`);
  }

  _fetchToFile(inputUrl, dest, timeoutMs = 30000, maxRedirects = 3, redirectCount = 0) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(inputUrl);
      const lib = urlObj.protocol === 'http:' ? http : https;
      const req = lib.get({
        hostname: urlObj.hostname,
        path: urlObj.pathname + (urlObj.search || ''),
        protocol: urlObj.protocol,
        port: urlObj.port || (urlObj.protocol === 'http:' ? 80 : 443),
        headers: {
          'User-Agent': 'silero-vad-downloader/1.0',
          'Accept': 'application/octet-stream,application/zip;q=0.9,*/*;q=0.8'
        }
      }, (res) => {
        const status = res.statusCode || 0;
        // 处理重定向
        if ([301, 302, 303, 307, 308].includes(status)) {
          const loc = res.headers.location;
          if (!loc) {
            reject(new Error(`redirect status ${status} without Location header`));
            return;
          }
          if (redirectCount >= maxRedirects) {
            reject(new Error(`too many redirects (>${maxRedirects})`));
            return;
          }
          const nextUrl = new URL(loc, urlObj);
          res.resume(); // 丢弃当前响应体
          this._fetchToFile(nextUrl.toString(), dest, timeoutMs, maxRedirects, redirectCount + 1)
            .then(resolve).catch(reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`HTTP ${status}: ${res.statusMessage || ''}`.trim()));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', (err) => { try { fs.unlinkSync(dest); } catch {} reject(err); });
      });
      req.on('error', (err) => { try { fs.unlinkSync(dest); } catch {} reject(err); });
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('request timeout'));
      });
    });
  }

  async initSession() {
    await this.downloadModel();
    this.session = await ort.InferenceSession.create(this.modelPath, {
      executionProviders: ['cpu'],
    });
    // capture IO names for dynamic mapping
    this.inputNames = this.session.inputNames || [];
    this.outputNames = this.session.outputNames || [];
    // metadata (best-effort)
    this.inputMeta = this.session.inputMetadata || {};
    this.outputMeta = this.session.outputMetadata || {};

    // 结合元数据推断窗口与隐藏维度
    this.io = this._ioMap();
    // window
    const inMeta = this.inputMeta[this.io.inInput];
    if (inMeta && Array.isArray(inMeta.dimensions)) {
      const dims = inMeta.dimensions.filter(d => typeof d === 'number');
      const last = dims[dims.length - 1];
      if (typeof last === 'number' && last > 0) this.windowSamples = last;
    }
    // hidden size & state mode from inputs
    let hiddenFromInputs = false;
    if (this.io.inState && this.inputMeta[this.io.inState] && Array.isArray(this.inputMeta[this.io.inState].dimensions)) {
      const dims = this.inputMeta[this.io.inState].dimensions.filter(d => typeof d === 'number');
      const hs = dims[dims.length - 1];
      if (typeof hs === 'number' && hs > 0) { this.hiddenSize = hs; hiddenFromInputs = true; }
      this.useState = true;
    } else if (this.io.inH && this.inputMeta[this.io.inH] && Array.isArray(this.inputMeta[this.io.inH].dimensions)) {
      const dims = this.inputMeta[this.io.inH].dimensions.filter(d => typeof d === 'number');
      const hs = dims[dims.length - 1];
      if (typeof hs === 'number' && hs > 0) { this.hiddenSize = hs; hiddenFromInputs = true; }
      this.useState = false;
    } else {
      this.useState = !!this.io.inState; // fallback
    }

    // 若末端无法确定，则尝试通过输出端推断
    if (!hiddenFromInputs) {
      if (this.io.outState && this.outputMeta[this.io.outState] && Array.isArray(this.outputMeta[this.io.outState].dimensions)) {
        const dims = this.outputMeta[this.io.outState].dimensions.filter(d => typeof d === 'number');
        const hs = dims[dims.length - 1];
        if (typeof hs === 'number' && hs > 0) this.hiddenSize = hs;
      } else if (this.io.outH && this.outputMeta[this.io.outH] && Array.isArray(this.outputMeta[this.io.outH].dimensions)) {
        const dims = this.outputMeta[this.io.outH].dimensions.filter(d => typeof d === 'number');
        const hs = dims[dims.length - 1];
        if (typeof hs === 'number' && hs > 0) this.hiddenSize = hs;
      }
    }

    // initialize states with derived sizes
    this.resetStates();
  }

  resetStates() {
    const H = this.hiddenSize || 64;
    this.h = new Float32Array(2 * 1 * H);
    this.c = new Float32Array(2 * 1 * H);
    this.state = new Float32Array(2 * 1 * H);
  }

  async convertToWav(inputPath, outputPath) {
    return ffmpeg.convertToWav(inputPath, outputPath, { ar: 16000, channels: 1 });
  }

  async decodeWav(wavPath) {
    const buffer = fs.readFileSync(wavPath);
    const decoded = await wavDecoder.decode(buffer);
    if (decoded.sampleRate !== this.sampleRate) {
      throw new Error(`Expected ${this.sampleRate}Hz, got ${decoded.sampleRate}`);
    }
    const ch0 = decoded.channelData[0];
    return new Float32Array(ch0);
  }

  // Map input/output names for compatibility across model versions（更宽松的匹配规则）
  _ioMap() {
    const names = this.inputNames || [];
    const outs = this.outputNames || [];

    const findBy = (arr, regex) => arr.find(n => regex.test(n)) || null;
    const findContains = (arr, keyword) => arr.find(n => n.toLowerCase().includes(keyword)) || null;

    // 优先利用元数据形状进行判定
    const isScalarInt = (name) => {
      const m = this.inputMeta[name] || {};
      const dims = m.dimensions || [];
      const type = (m.type || '').toString().toLowerCase();
      return dims && dims.length === 1 && (type.includes('int32') || type.includes('int64'));
    };
    const isAudio2D = (name) => {
      const m = this.inputMeta[name] || {};
      const dims = m.dimensions || [];
      return dims && dims.length === 2; // [1, N]
    };
    const isRnn3D = (name) => {
      const m = this.inputMeta[name] || {};
      const dims = m.dimensions || [];
      return dims && dims.length === 3; // [2,1,H]
    };

    // 输入名称推断
    let inSr = names.find(n => isScalarInt(n)) || findBy(names, /^sr$/i) || findContains(names, 'sample_rate') || findContains(names, 'sr') || null;
    let inState = names.find(n => isRnn3D(n) && n.toLowerCase().includes('state')) || findContains(names, 'state');
    let inH = names.find(n => isRnn3D(n) && /(h0|h_in|h$|^h)/i.test(n)) || findBy(names, /^(h0|h)$/i) || findContains(names, 'h');
    let inC = names.find(n => isRnn3D(n) && /(c0|c_in|c$|^c)/i.test(n)) || findBy(names, /^(c0|c)$/i) || findContains(names, 'c');

    // 避免错误匹配，将 inH/inC 中的 state 排除
    if (inH && /state/i.test(inH)) inH = null;
    if (inC && /state/i.test(inC)) inC = null;

    // 音频输入
    let inInput = names.find(n => isAudio2D(n) && /(input|x)/i.test(n)) || findContains(names, 'input') || findContains(names, 'x') || names[0] || 'input';

    // 输出：主概率输出、递归状态
    let outState = outs.find(n => /(state)/i.test(n)) || null;
    let outH = outs.find(n => /(hn|h_out|^h$)/i.test(n)) || null;
    let outC = outs.find(n => /(cn|c_out|^c$)/i.test(n)) || null;
    // 主输出尽量排除状态类
    let outMain = outs.find(n => !/(state|hn|h_out|cn|c_out)/i.test(n)) || outs[0] || 'output';

    return { inInput, inH, inC, inState, inSr, outMain, outH, outC, outState };
  }

  _buildSrTensor(inSr) {
    if (!inSr) return null;
    // 若已根据错误信息确定了采样率张量类型，优先使用
    if (this.srDtype === 'int64') {
      return new ort.Tensor('int64', BigInt64Array.from([BigInt(this.sampleRate)]), [1]);
    } else if (this.srDtype === 'int32') {
      return new ort.Tensor('int32', Int32Array.from([this.sampleRate]), [1]);
    }
    const meta = (this.inputMeta && this.inputMeta[inSr]) || {};
    const type = (meta.type || '').toString().toLowerCase();
    try {
      if (type.includes('int64')) {
        return new ort.Tensor('int64', BigInt64Array.from([BigInt(this.sampleRate)]), [1]);
      } else if (type.includes('int32')) {
        return new ort.Tensor('int32', Int32Array.from([this.sampleRate]), [1]);
      } else {
        return new ort.Tensor('float32', Float32Array.from([this.sampleRate]), [1]);
      }
    } catch (_) {
      // 兜底使用 float32
      return new ort.Tensor('float32', Float32Array.from([this.sampleRate]), [1]);
    }
  }

  // 根据错误消息自动修复 IO 映射/隐藏维度，并返回是否已修复
  _autoFixFromError(errMsg) {
    if (!errMsg) return false;
    const msg = String(errMsg);
    let fixed = false;

    // 1) 缺少输入
    const missMatch = msg.match(/input\s+'([^']+)'\s+is\s+missing\s+in\s+'feeds'/i);
    if (missMatch && missMatch[1]) {
      const miss = missMatch[1].toLowerCase();
      const findName = (needle) => (this.inputNames || []).find(n => n.toLowerCase() === needle || n.toLowerCase().includes(needle));
      if (/sample|sr|fs/.test(miss)) {
        const name = findName('sr') || findName('sample') || findName('sample_rate') || findName('fs');
        if (name) { this.io.inSr = name; fixed = true; }
      } else if (/state/.test(miss)) {
        const name = findName('state');
        if (name) { this.io.inState = name; this.useState = true; fixed = true; }
      } else if (/^h/.test(miss)) {
        const name = (this.inputNames || []).find(n => /^h/i.test(n));
        if (name) { this.io.inH = name; this.useState = false; fixed = true; }
      } else if (/^c/.test(miss)) {
        const name = (this.inputNames || []).find(n => /^c/i.test(n));
        if (name) { this.io.inC = name; this.useState = false; fixed = true; }
      } else if (/input|x/.test(miss)) {
        const name = (this.inputNames || []).find(n => /input|x/i.test(n));
        if (name) { this.io.inInput = name; fixed = true; }
      }
    }

    // 2) 隐藏维度不匹配：处理 onnxruntime 提示的 "Got invalid dimensions for input: state ... index: 2 Got: 64 Expected: 128"
    // 将消息压平以便正则匹配
    const flat = msg.replace(/\s+/g, ' ');
    // 优先匹配包含输入名称的报错
    const dimMatchNamed = flat.match(/Got invalid dimensions for input:\s*([\w\.:-]+).*?Expected:\s*(\d+)/i);
    if (dimMatchNamed) {
      const inputName = dimMatchNamed[1] || '';
      const expected = parseInt(dimMatchNamed[2], 10);
      if (Number.isFinite(expected) && expected > 0 && expected !== this.hiddenSize) {
        // 仅当报错来自 state/h/c 这类递归状态时才调整隐藏维度
        if (/^(state|h|c)/i.test(inputName)) {
          this.hiddenSize = expected;
          this.resetStates();
          fixed = true;
          try { console.warn(`[SileroVAD] auto-fix hiddenSize -> ${expected} from error for input ${inputName}`); } catch {}
        }
      }
    } else {
      // 退化匹配：没有名字，仅提取 Expected 数值，且错误文本包含 state/h/c 关键词
      const expectedOnly = flat.match(/Expected:\s*(\d+)/i);
      if (expectedOnly && /(state|hn|cn|\bh\b|\bc\b)/i.test(flat)) {
        const expected = parseInt(expectedOnly[1], 10);
        if (Number.isFinite(expected) && expected > 0 && expected !== this.hiddenSize) {
          this.hiddenSize = expected;
          this.resetStates();
          fixed = true;
          try { console.warn(`[SileroVAD] auto-fix hiddenSize -> ${expected} from error (unnamed)`); } catch {}
        }
      }
    }

    // 3) 输入窗口大小不匹配（尝试从错误中解析）
    const winShape = msg.match(/input[^\[]*\[\s*1\s*,\s*(\d+)\s*\]\s*.*expected.*\[\s*1\s*,\s*(\d+)\s*\]/i);
    if (winShape) {
      const want = parseInt(winShape[2], 10);
      if (want && want > 0 && want !== this.windowSamples) {
        this.windowSamples = want;
        fixed = true;
        try { console.warn(`[SileroVAD] auto-fix windowSamples -> ${want}`); } catch {}
      }
    }

    // 4) 采样率张量类型不匹配（float -> int64/int32）
    const typeMismatch = msg.match(/Unexpected input data type.*expected:\s*\(tensor\((int64|int32)\)\)/i);
    if (typeMismatch) {
      const wantType = typeMismatch[1].toLowerCase();
      if (wantType === 'int64' || wantType === 'int32') {
        if (this.srDtype !== wantType) {
          this.srDtype = wantType;
          fixed = true;
          try { console.warn(`[SileroVAD] auto-fix sr dtype -> ${wantType}`); } catch {}
        }
      }
    }

    return fixed;
  }

  async predict(chunk) {
    if (!this.session) throw new Error('Session not initialized');
    if (!this.io) this.io = this._ioMap();
    if (chunk.length !== this.windowSamples) {
      throw new Error(`Chunk size ${chunk.length} != ${this.windowSamples}`);
    }

    const { inInput, inH, inC, inState, inSr, outMain, outH, outC, outState } = this.io;
    const inputTensor = new ort.Tensor('float32', chunk, [1, chunk.length]);

    const feeds = {}; feeds[inInput] = inputTensor;
    const H = this.hiddenSize || 64;
    // Feed state or h/c depending on model variant
    if (inState && this.useState) {
      if (!this.state || this.state.length !== 2 * 1 * H) this.state = new Float32Array(2 * 1 * H);
      const stateTensor = new ort.Tensor('float32', this.state, [2, 1, H]);
      feeds[inState] = stateTensor;
    } else {
      if (!inH || !inC) {
        // 尝试退回到 state 模式（有些模型仅需要 state）
        if (inState) {
          this.useState = true;
          if (!this.state || this.state.length !== 2 * 1 * H) this.state = new Float32Array(2 * 1 * H);
          feeds[inState] = new ort.Tensor('float32', this.state, [2, 1, H]);
        } else {
          throw new Error("Model expects 'h'/'c' or 'state' inputs, none detected");
        }
      } else {
        if (!this.h || !this.h.length || this.h.length !== 2 * 1 * H) this.h = new Float32Array(2 * 1 * H);
        if (!this.c || !this.c.length || this.c.length !== 2 * 1 * H) this.c = new Float32Array(2 * 1 * H);
        const hTensor = new ort.Tensor('float32', this.h, [2, 1, H]);
        const cTensor = new ort.Tensor('float32', this.c, [2, 1, H]);
        feeds[inH] = hTensor; feeds[inC] = cTensor;
      }
    }
    // Optional sample rate input（更智能的名称匹配）
    let srName = inSr;
    if (!srName) {
      const guess = (this.inputNames || []).find(n => /(^|_|\.)sr($|_|\.)|sample_rate|^fs$/i.test(n));
      if (guess) { this.io.inSr = guess; srName = guess; }
    }
    if (srName) {
      feeds[srName] = this._buildSrTensor(srName);
    }

    // 执行推理，若失败尝试基于错误自修复并重试一次
    try {
      const result = await this.session.run(feeds);
      return this._extractResultAndUpdateStates(result, outMain, outH, outC, outState);
    } catch (e) {
      const fixed = this._autoFixFromError(e && e.message);
      if (!fixed) throw e; // 无法自动修复

      // 应用修复后重建 feeds 并重试一次
      const retryFeeds = {}; const io2 = this.io;
      retryFeeds[io2.inInput] = inputTensor;
      const H2 = this.hiddenSize || 64;
      if (io2.inState && this.useState) {
        if (!this.state || this.state.length !== 2 * 1 * H2) this.state = new Float32Array(2 * 1 * H2);
        retryFeeds[io2.inState] = new ort.Tensor('float32', this.state, [2, 1, H2]);
      } else {
        if (io2.inH && io2.inC) {
          if (!this.h || this.h.length !== 2 * 1 * H2) this.h = new Float32Array(2 * 1 * H2);
          if (!this.c || this.c.length !== 2 * 1 * H2) this.c = new Float32Array(2 * 1 * H2);
          retryFeeds[io2.inH] = new ort.Tensor('float32', this.h, [2, 1, H2]);
          retryFeeds[io2.inC] = new ort.Tensor('float32', this.c, [2, 1, H2]);
        }
      }
      if (io2.inSr) retryFeeds[io2.inSr] = this._buildSrTensor(io2.inSr);

      try {
        const result = await this.session.run(retryFeeds);
        return this._extractResultAndUpdateStates(result, io2.outMain, io2.outH, io2.outC, io2.outState);
      } catch (e2) {
        // 第二次尝试失败，再自修复一次（例如 sr 的 dtype）并进行最后一次尝试
        const fixed2 = this._autoFixFromError(e2 && e2.message);
        if (!fixed2) throw e2;
        const retryFeeds2 = {};
        retryFeeds2[this.io.inInput] = inputTensor;
        const H3 = this.hiddenSize || 64;
        if (this.io.inState && this.useState) {
          if (!this.state || this.state.length !== 2 * 1 * H3) this.state = new Float32Array(2 * 1 * H3);
          retryFeeds2[this.io.inState] = new ort.Tensor('float32', this.state, [2, 1, H3]);
        } else if (this.io.inH && this.io.inC) {
          if (!this.h || this.h.length !== 2 * 1 * H3) this.h = new Float32Array(2 * 1 * H3);
          if (!this.c || this.c.length !== 2 * 1 * H3) this.c = new Float32Array(2 * 1 * H3);
          retryFeeds2[this.io.inH] = new ort.Tensor('float32', this.h, [2, 1, H3]);
          retryFeeds2[this.io.inC] = new ort.Tensor('float32', this.c, [2, 1, H3]);
        }
        if (this.io.inSr) retryFeeds2[this.io.inSr] = this._buildSrTensor(this.io.inSr);
        const result = await this.session.run(retryFeeds2);
        return this._extractResultAndUpdateStates(result, this.io.outMain, this.io.outH, this.io.outC, this.io.outState);
      }
    }
  }

  _extractResultAndUpdateStates(result, outMain, outH, outC, outState) {
    // update states
    if (outState && result[outState]) {
      const st = result[outState];
      this.state = new Float32Array(st.data);
    } else {
      const hOut = outH ? result[outH] : null;
      const cOut = outC ? result[outC] : null;
      if (!hOut || !cOut) throw new Error('Model outputs missing recurrent states');
      this.h = new Float32Array(hOut.data);
      this.c = new Float32Array(cOut.data);
    }

    const main = result[outMain] || result['output'] || result['y'] || result['prob'] || result['probs'] || result['logits'];
    if (!main) throw new Error('Model output missing main logits');
    const arr = main.data; // expect length 2 (non-speech, speech) or more
    // heuristic: take last two values if longer
    let speechProb;
    if (arr.length >= 2) {
      speechProb = arr[arr.length - 1];
      if (arr.length === 2) speechProb = arr[1];
    } else {
      speechProb = arr[0] || 0;
    }
    return speechProb;
  }

  async processAudioFile(audioPath, threshold = 0.5, minSpeechSec = 0.25, minSilenceSec = 0.1) {
    const tempWav = audioPath.replace(/\.[^.]+$/, '_16k.wav');
    try {
      await this.convertToWav(audioPath, tempWav);
      const audio = await this.decodeWav(tempWav);
      this.resetStates();
      let step = this.windowSamples; // 允许在运行时通过 _autoFixFromError 动态调整 windowSamples
      const preds = [];
      for (let i = 0; i < audio.length; i += step) {
        const window = audio.slice(i, i + step);
        if (window.length < step) {
          const padded = new Float32Array(step);
          padded.set(window);
          const p = await this.predict(padded);
          // 若 predict 内因窗口大小自修复，更新 step 并重取该帧
          if (this.windowSamples !== step) { step = this.windowSamples; i -= step; continue; }
          preds.push({ t: i / this.sampleRate, p });
        } else {
          const p = await this.predict(window);
          if (this.windowSamples !== step) { step = this.windowSamples; i -= step; continue; }
          preds.push({ t: i / this.sampleRate, p });
        }
      }
      // post-process to segments
      const segs = [];
      let curStart = null;
      for (const { t, p } of preds) {
        if (p >= threshold) {
          if (curStart === null) curStart = t;
        } else {
          if (curStart !== null) {
            const end = t;
            if (end - curStart >= minSpeechSec) segs.push({ start: curStart, end });
            curStart = null;
          }
        }
      }
      if (curStart !== null) {
        const end = audio.length / this.sampleRate;
        if (end - curStart >= minSpeechSec) segs.push({ start: curStart, end });
      }
      // merge close segments
      const merged = [];
      for (const s of segs) {
        const last = merged[merged.length - 1];
        if (last && s.start - last.end < minSilenceSec) last.end = s.end; else merged.push({ ...s });
      }
      return merged;
    } finally {
      try { fs.unlinkSync(tempWav); } catch {}
    }
  }

  async close() {
    // nothing specific to release in onnxruntime-node js API
  }
}

if (require.main === module) {
  (async () => {
    const audio = process.argv[2];
    const threshold = parseFloat(process.argv[3]) || 0.5;
    if (!audio) {
      console.error('Usage: node silero_vad_onnx.js <audio_file> [threshold]');
      process.exit(1);
    }
    try {
      const vad = new SileroVAD();
      await vad.initSession();
      const segs = await vad.processAudioFile(audio, threshold);
      console.log(JSON.stringify(segs, null, 2));
    } catch (e) {
      console.error(e.stack || e.message);
      process.exit(1);
    }
  })();
}

module.exports = SileroVAD;