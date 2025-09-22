// AI client utilities for SambaNova OpenAI-compatible endpoint
const OpenAI = require('openai');
const { prisma } = require('./db');

async function getSnClient() {
  let dbKey = null;
  try {
    const s = await prisma.settings.findUnique({ where: { key: 'singleton' }, select: { openaiKey: true } });
    if (s && typeof s.openaiKey === 'string' && s.openaiKey.trim()) dbKey = s.openaiKey.trim();
  } catch (_) {}
  if (!dbKey) {
    const err = new Error('未配置识别服务的 API Key，请前往“设置”页面填写 OpenAI Key');
    err.code = 'NO_API_KEY';
    throw err;
  }
  const apiKey = dbKey;
  const baseURL = process.env.SAMBANOVA_BASE_URL || 'https://api.sambanova.ai/v1';
  return new OpenAI({ apiKey, baseURL });
}

function isAuthError(err) {
  try {
    if (!err) return false;
    if (err.code === 'NO_API_KEY' || err.code === 'INVALID_API_KEY') return true;
    const status = err.status || err.httpStatus || err.statusCode;
    if (status === 401 || status === 403) return true;
    const msg = String((err && (err.message || err)) || '').toLowerCase();
    return msg.includes('unauthorized') || msg.includes('invalid api key') || msg.includes('401') || msg.includes('403');
  } catch (_) { return false; }
}

module.exports = { getSnClient, isAuthError };