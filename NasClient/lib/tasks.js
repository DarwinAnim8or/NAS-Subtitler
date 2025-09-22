const path = require('path');

/**
 * 任务服务模块 - 封装任务取消、自动入队、字幕生成流程
 * @param {object} ctx 注入的依赖上下文
 * @returns {object} 任务服务实例
 */
function createTaskService(ctx) {
  const {
    fs,
    prisma,
    MOUNT_DIR,
    // 外部模块/类
    SileroVAD,
    ffmpeg,
    getSnClient,
    getOutputAudioPathFromVideo,
    // 状态管理与辅助函数
    taskControls,  // Map
    activeTasks,   // Map
    taskQueue,     // Array
    setTaskState,  // function(id, patch)
    detectSubtitles, // function(dir, videoFilename)
    isVideoFileName, // function(name, VIDEO_EXTS)
    VIDEO_EXTS,
    // 进程注册
    registerProc,  // function(taskId, proc)
    registerAbort, // function(taskId, controller)
    isAuthError,   // function(err): boolean
  } = ctx;

  // 新增：文件稳定性检测（两次一致法），避免复制过程中被自动入队
  const __fileStableMap = new Map(); // key: absPath -> { size, mtimeMs }
  function isFileStable(absPath) {
    try {
      const st = fs.statSync(absPath);
      const size = Number(st.size) || 0;
      const mtimeMs = Number(st.mtimeMs) || 0;
      const rec = __fileStableMap.get(absPath);
      if (!rec) {
        __fileStableMap.set(absPath, { size, mtimeMs });
        return false; // 首次看到，等待下一轮确认
      }
      if (rec.size === size && rec.mtimeMs === mtimeMs) {
        return true; // 连续两次一致，判定为稳定
      }
      // 发生变化则更新记录，下一轮再确认
      __fileStableMap.set(absPath, { size, mtimeMs });
      return false;
    } catch (_) {
      // 文件不存在或无法 stat，视为不稳定并清理记录
      try { __fileStableMap.delete(absPath); } catch (_) {}
      return false;
    }
  }

  /**
   * 取消指定任务
   */
  async function cancelTask(taskId, reason) {
    try { console.info('[tasks] cancelTask invoked', { taskId, reason: reason || 'stopped' }); } catch (_) {}
    try {
      const ctl = taskControls.get(taskId);
      if (ctl) {
        ctl.canceled = true;
        ctl.reason = reason || 'stopped';
        for (const p of Array.from(ctl.procs || [])) {
          try { p.kill('SIGKILL'); } catch (_) { try { p.kill(); } catch (_) {} }
        }
        for (const c of Array.from(ctl.controllers || [])) {
          try { c.abort(); } catch (_) {}
        }
      }
      const t = activeTasks.get(taskId);
      if (t) setTaskState(taskId, { status: 'stopping', stage: '停止中', message: reason || '正在停止当前任务…' });
    } catch (_) {}
  }

  /**
   * 取消所有任务
   */
  async function cancelAllTasks(reason, source) {
    try { console.info('[tasks] cancelAllTasks invoked', { source: source || 'unspecified', reason: reason || '' }); } catch (_) {}
    try {
      // 清空待处理队列
      while (taskQueue.length) taskQueue.pop();
    } catch (_) {}
    try {
      // 标记排队中的任务为已停止
      for (const [id, t] of activeTasks.entries()) {
        if (t && t.status === 'queued') {
          try { console.info('[tasks] mark queued task stopped', { id, reason: reason || '已手动停止' }); } catch (_) {}
          setTaskState(id, { status: 'stopped', stage: '已停止', message: reason || '已手动停止' });
          setTimeout(() => { try { activeTasks.delete(id); } catch (_) {} }, 5000);
        }
      }
    } catch (_) {}
    try {
      // 终止当前运行中的任务
      for (const [id, t] of activeTasks.entries()) {
        if (t && t.status === 'processing') {
          try { console.info('[tasks] request cancel of processing task', { id, reason: reason || '已关闭自动任务，停止当前任务', source: source || 'unspecified' }); } catch (_) {}
          await cancelTask(id, reason || '已关闭自动任务，停止当前任务');
          break;
        }
      }
    } catch (_) {}
  }

  /**
   * 自动入队逻辑：按 sequence 倒序选择无字幕文件
   */
  async function maybeAutoEnqueueNext() {
    try {
      // 读取设置
      const s = await prisma.settings.findUnique({
        where: { key: 'singleton' },
        select: { autoGenerate: true }
      });
      if (!s || !s.autoGenerate) return;

      // 若正在处理或已有排队，暂不新增任务
      if (ctx.getProcessing() || (Array.isArray(taskQueue) && taskQueue.length > 0)) return;

      // 构建当前活跃任务集合，避免重复入队
      const activeSet = new Set();
      try {
        for (const t of activeTasks.values()) {
          if (!t) continue;
          if (t.status === 'queued' || t.status === 'processing') {
            const dirRel = t.dirRel || '';
            const name = t.name || '';
            activeSet.add(`${dirRel}||${name}`);
          }
        }
      } catch (_) {}

      // 从媒体表中按 sequence 倒序拿一批候选
      const recs = await prisma.mediaFile.findMany({
        where: { sequence: { gt: 0 } },
        orderBy: { sequence: 'desc' },
        take: 100,
        select: { dirRel: true, name: true }
      });

      const sep = path.sep;
      let candidate = null;
      for (const r of recs) {
        try {
          const dirRel = (r.dirRel || '').toString();
          const baseDir = path.join(MOUNT_DIR, dirRel.split('/').join(sep));
          const safeName = path.basename(r.name || '');
          if (!safeName) continue;
          // 视频类型过滤
          if (!isVideoFileName(safeName, VIDEO_EXTS)) continue;
          const key = `${dirRel}||${safeName}`;
          if (activeSet.has(key)) continue;
          const videoPath = path.join(baseDir, safeName);
          if (!fs.existsSync(videoPath)) continue;
          // 字幕检测
          const subs = detectSubtitles(baseDir, safeName);
          if (subs && subs.base) continue; // 已有原始字幕，跳过
          // 新增：只有当文件在最近一段时间内保持“稳定”（未变化）才允许自动入队
          if (!isFileStable(videoPath)) {
            try { console.info('[tasks] skip unstable file (copy in progress?)', { dirRel, safeName }); } catch (_) {}
            continue;
          }
          candidate = { baseDir, dirRel, safeName, videoPath };
          break;
        } catch (_) {}
      }

      if (!candidate) return;

      // 入队一个"生成字幕"任务
      const { baseDir, dirRel, safeName, videoPath } = candidate;
      const base = path.basename(safeName, path.extname(safeName));
      const srtPath = path.join(baseDir, `${base}.srt`);

      const taskId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setTaskState(taskId, { dirRel, name: safeName, status: 'queued', stage: '排队中', progress: 0, message: '等待开始…' });
      taskQueue.push({ taskId, baseDir, safeName, videoPath, srtPath });
      startNextTask();
    } catch (_) {
      // 忽略自动入队中的错误，等待下次轮询
    }
  }

  /**
   * 启动下一个任务
   */
  async function startNextTask() {
    if (ctx.getProcessing()) return;
    const job = taskQueue.shift();
    if (!job) return;
    ctx.setProcessing(true);
    try {
      await processGenerate(job);
    } catch (e) {
      const { taskId } = job || {};
      try { setTaskState(taskId, { status: 'error', stage: '出错', message: e && (e.message || String(e)) }); } catch (_) {}
    } finally {
      ctx.setProcessing(false);
      setImmediate(startNextTask);
    }
  }

  /**
   * 生成字幕任务的核心处理逻辑：提取音频 -> VAD 分段 -> 逐段识别 -> 写入 SRT
   */
  async function processGenerate(job) {
    const { taskId, baseDir, safeName, videoPath, srtPath } = job;
    const preExistSrt = fs.existsSync(srtPath);
    let audioPath;
    let segDir;
    try {
      // 若任务已被取消，直接返回
      if (taskControls.get(taskId)?.canceled) {
        setTaskState(taskId, { status: 'stopped', stage: '已停止', message: (taskControls.get(taskId)?.reason || '已停止') });
        return;
      }
      // 任务开始前确认源视频存在
      if (!fs.existsSync(videoPath)) {
        setTaskState(taskId, { status: 'skipped', stage: '跳过', progress: 0, message: '源视频不存在，任务已跳过' });
        return;
      }

      // 启动前检查 Key
      try {
        await getSnClient();
      } catch (e) {
        const msg = (e && e.code === 'NO_API_KEY')
          ? '未配置识别服务的 API Key，请前往"设置"页面填写 OpenAI Key'
          : String((e && e.message) || e);
        setTaskState(taskId, { status: 'error', stage: '出错', message: msg });
        return;
      }
      setTaskState(taskId, { status: 'processing', stage: '提取音频', progress: 1, message: '正在提取音频…' });

      // 1) 提取音频
      audioPath = await getOutputAudioPathFromVideo(videoPath);
      try { fs.mkdirSync(path.dirname(audioPath), { recursive: true }); } catch {}
      await new Promise((resolve, reject) => {
        const ff = ffmpeg.spawn(['-y', '-i', videoPath, '-vn', '-ac', '2', '-b:a', '192k', audioPath]);
        registerProc(taskId, ff);
        let err = '';
        ff.stderr.on('data', (d) => { err += d.toString(); });
        ff.on('error', (e) => { reject(new Error(err || (e && e.message) || 'Failed to start ffmpeg (is it installed and in PATH?)')); });
        ff.on('close', (code) => { (code === 0 || (taskControls.get(taskId)?.canceled)) ? resolve() : reject(new Error(err || `ffmpeg exit ${code}`)); });
      });

      if (taskControls.get(taskId)?.canceled) { setTaskState(taskId, { status: 'stopped', stage: '已停止', message: (taskControls.get(taskId)?.reason || '已停止') }); return; }
      setTaskState(taskId, { stage: 'VAD 分段', progress: 10, message: '正在检测语音片段…' });

      // 2) VAD 分段
      const vad = new SileroVAD();
      await vad.initSession();
      const segmentsRaw = await vad.processAudioFile(audioPath, 0.5, 0.25, 0.15);
      // 过滤极短片段，并在两端各加入 0.1s 余量
      const segments = [];
      for (let i = 0; i < segmentsRaw.length; i++) {
        const seg = segmentsRaw[i];
        const start = Math.max(0, seg.start - 0.10);
        const end = Math.max(start, seg.end + 0.10);
        if (end - start < 0.2) continue;
        segments.push({ start, end });
      }
      const totalSeg = Math.max(1, segments.length);
      setTaskState(taskId, { stage: '识别中', progress: 15, message: `逐段识别中… 0/${totalSeg}` });

      // 3) 逐段裁剪并识别
      // 将 VAD 生成的音频片段目录从“挂载根目录/segments”改为“挂载目录/data/temp/segments/<taskId_timestamp>”
      const segBase = path.join(MOUNT_DIR, 'data', 'temp', 'segments');
      try { fs.mkdirSync(segBase, { recursive: true }); } catch {}
      const segName = `task_${taskId || 'seg'}_${Date.now()}`;
      segDir = path.join(segBase, segName);
      try { fs.mkdirSync(segDir, { recursive: true }); } catch {}
      const cutSegment = (input, startSec, endSec, outPath) => new Promise((resolve, reject) => {
        const safeStart = Math.max(0, Number(startSec) || 0);
        const safeEnd = Math.max(safeStart, Number(endSec) || safeStart);
        const args = ['-y', '-ss', safeStart.toFixed(3), '-to', safeEnd.toFixed(3), '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '96k', outPath];
        const ff = ffmpeg.spawn(args);
        registerProc(taskId, ff);
        let stderrBuf = '';
        ff.stderr.on('data', (d) => { stderrBuf += d.toString(); });
        ff.on('error', (e) => { reject(new Error(stderrBuf || (e && e.message) || 'Failed to start ffmpeg (is it installed and in PATH?)')); });
        ff.on('close', (code) => { (code === 0 || (taskControls.get(taskId)?.canceled)) ? resolve() : reject(new Error(stderrBuf || `ffmpeg exit ${code}`)); });
      });
      const toSrtTime = (secFloat) => {
        const msTotal = Math.max(0, Math.round(secFloat * 1000));
        const h = String(Math.floor(msTotal / 3600000)).padStart(2, '0');
        const m = String(Math.floor((msTotal % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((msTotal % 60000) / 1000)).padStart(2, '0');
        const ms3 = String(msTotal % 1000).padStart(3, '0');
        return `${h}:${m}:${s},${ms3}`;
      };

      const srtLines = [];
      let idx = 1;
      for (let i = 0; i < segments.length; i++) {
        if (taskControls.get(taskId)?.canceled) { break; }
        const { start, end } = segments[i];
        const segPath = path.join(segDir, `seg_${String(i).padStart(4, '0')}.mp3`);
        try {
          await cutSegment(audioPath, start, end, segPath);
          // 逐段识别
          const p = Math.min(95, 15 + Math.floor((i + 1) * 80 / totalSeg));
          setTaskState(taskId, { stage: '识别中', progress: p, message: `逐段识别中… ${Math.min(i + 1, totalSeg)}/${totalSeg}` });

          const client = await getSnClient();
          const ac = new AbortController();
          try { registerAbort(taskId, ac); } catch (_) {}
          let text = '';
          try {
            const resp = await client.audio.transcriptions.create({
              file: fs.createReadStream(segPath),
              model: process.env.SAMBANOVA_STT_MODEL || 'Whisper-Large-v3',
              response_format: 'json',
              signal: ac.signal,
            });
            if (resp && typeof resp === 'object' && typeof resp.text === 'string') text = resp.text;
            else if (typeof resp === 'string') text = resp;
            else text = String(resp?.text || '');
          } catch (e) {
            if (isAuthError && isAuthError(e)) {
              setTaskState(taskId, { status: 'error', stage: '出错', message: '识别服务 Key 不可用或已失效，请在“设置”页检查并保存正确的 Key' });
              throw e;
            }
            // 其他识别错误：跳过当前段，写入空行
            text = '';
          }

          const textNorm = (text || '').replace(/\s+/g, ' ').trim();
          srtLines.push(`${idx++}\n${toSrtTime(start)} --> ${toSrtTime(end)}\n${textNorm || ' '}\n`);
        } catch (e) {
          try {
            console.warn('[tasks] segment failed, skip', { i, err: e && (e.message || String(e)) });
          } catch (_) {}
          // 失败也推进一个空白字幕块，保证时间轴连续
          srtLines.push(`${idx++}\n${toSrtTime(start)} --> ${toSrtTime(end)}\n\n`);
        }
      }

      if (taskControls.get(taskId)?.canceled) { setTaskState(taskId, { status: 'stopped', stage: '已停止', message: (taskControls.get(taskId)?.reason || '已停止') }); return; }

      setTaskState(taskId, { stage: '写入字幕', progress: 97, message: '写入字幕文件…' });
      try {
        const content = srtLines.join('\n');
        fs.writeFileSync(srtPath, content);
        if (preExistSrt) {
          setTaskState(taskId, { status: 'done', stage: '完成', progress: 100, message: '已覆盖生成 SRT（因之前已存在）' });
        } else {
          setTaskState(taskId, { status: 'done', stage: '完成', progress: 100, message: '已生成 SRT 字幕' });
        }
      } catch (e) {
        setTaskState(taskId, { status: 'error', stage: '出错', message: e && (e.message || String(e)) });
        return;
      }
    } finally {
      // 清理临时文件
      try {
        if (segDir && fs.existsSync(segDir)) {
          try {
            const entries = fs.readdirSync(segDir, { withFileTypes: true });
            for (const it of entries) {
              if (it.isFile()) {
                try { fs.unlinkSync(path.join(segDir, it.name)); } catch (_) {}
              }
            }
          } catch (_) {}
          try { fs.rmdirSync(segDir); } catch (_) {}
        }
      } catch (_) {}
      try { if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (_) {}
      // 完成后保留一段时间用于前端展示，然后删除 activeTasks 项
      try { setTimeout(() => { try { activeTasks.delete(taskId); } catch (_) {} }, 30 * 1000); } catch (_) {}
    }
  }

  // 自动入队定时器（内部管理）
  let autoTimer = null;
  function ensureAutoTimer() {
    if (!autoTimer) {
      autoTimer = setInterval(maybeAutoEnqueueNext, 10000);
      try { setTimeout(maybeAutoEnqueueNext, 1500); } catch (_) {}
    }
  }
  return { 
    cancelTask, 
    cancelAllTasks, 
    maybeAutoEnqueueNext, 
    startNextTask, 
    processGenerate,
    ensureAutoTimer,
  };
}

module.exports = { createTaskService };