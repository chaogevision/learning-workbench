import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildTaskPrompt, buildPreviewPrompt } from './api-prompts.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
loadDotEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const API_MODE = String(process.env.API_MODE || 'mock').toLowerCase();
const MAX_BODY = Number(process.env.MAX_BODY_BYTES || 1_000_000);
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);
const rateBuckets = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

function corsHeaders(req) {
  const configured = process.env.CORS_ORIGIN;
  if (!configured) return {};
  const origin = req.headers.origin;
  if (configured === '*' || configured.split(',').map((v) => v.trim()).includes(origin)) {
    return {
      'Access-Control-Allow-Origin': configured === '*' ? '*' : origin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Vary': 'Origin'
    };
  }
  return {};
}

function sendJson(req, res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...corsHeaders(req)
  });
  res.end(body);
}

function checkRateLimit(req) {
  const key = req.socket.remoteAddress || 'local';
  const now = Date.now();
  const recent = (rateBuckets.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= RATE_LIMIT_PER_MINUTE) return false;
  recent.push(now);
  rateBuckets.set(key, recent);
  return true;
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('请求内容过大。'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(Object.assign(new Error('请求 JSON 格式无效。'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function stripCodeFence(text) {
  return String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function compatibleEndpoint() {
  const base = String(process.env.AI_API_BASE_URL || '').replace(/\/$/, '');
  const pathOverride = String(process.env.AI_API_PATH || '').trim();
  if (pathOverride) return pathOverride.startsWith('http') ? pathOverride : `${base}${pathOverride.startsWith('/') ? '' : '/'}${pathOverride}`;
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

async function callCompatibleModel(messages) {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  const base = process.env.AI_API_BASE_URL;
  if (!apiKey || !model || !base) {
    const error = new Error('API_MODE=compatible 时必须设置 AI_API_BASE_URL、AI_API_KEY 和 AI_MODEL。');
    error.code = 'API_NOT_CONFIGURED';
    throw error;
  }

  const endpoint = compatibleEndpoint();
  const baseBody = {
    model,
    messages,
    temperature: Number(process.env.AI_TEMPERATURE || 0.2),
    max_tokens: Number(process.env.AI_MAX_TOKENS || 3600)
  };

  const attempt = async (withJsonMode) => {
    const body = withJsonMode ? { ...baseBody, response_format: { type: 'json_object' } } : baseBody;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(process.env.AI_EXTRA_HEADER_NAME && process.env.AI_EXTRA_HEADER_VALUE
          ? { [process.env.AI_EXTRA_HEADER_NAME]: process.env.AI_EXTRA_HEADER_VALUE }
          : {})
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || 40_000))
    });
    const raw = await response.text();
    if (!response.ok) {
      const error = new Error(`模型接口返回 ${response.status}：${raw.slice(0, 400)}`);
      error.status = response.status;
      throw error;
    }
    let envelope;
    try { envelope = JSON.parse(raw); }
    catch { throw new Error('模型接口外层响应不是 JSON。'); }
    const content = envelope?.choices?.[0]?.message?.content ?? envelope?.output_text ?? envelope?.result;
    if (!content) throw new Error('模型接口未返回可解析内容。');
    try { return JSON.parse(stripCodeFence(content)); }
    catch { throw new Error(`模型未返回合法 JSON：${String(content).slice(0, 300)}`); }
  };

  const jsonMode = String(process.env.AI_JSON_MODE || 'auto').toLowerCase();
  if (jsonMode === 'off') return attempt(false);
  try { return await attempt(true); }
  catch (error) {
    if (jsonMode === 'on' || ![400, 404, 422].includes(error.status)) throw error;
    return attempt(false);
  }
}

function clamp(number, min, max) {
  return Math.max(min, Math.min(max, Number(number) || min));
}

function uniqueId(prefix, index = 0) {
  return `${prefix}-${Date.now()}-${index}`;
}

function normalizeFocus(payload) {
  const focus = payload.focus || payload.focusSubjects || [];
  return Array.isArray(focus) ? focus.filter(Boolean) : [focus].filter(Boolean);
}

function mockTasks(payload) {
  const focus = normalizeFocus(payload);
  const subjects = focus.length ? focus : ['数学', '阅读', '预习'];
  const totalMinutes = clamp(payload.minutes || payload.availableMinutes || 60, 15, 180);
  const count = clamp(Math.ceil(totalMinutes / 25), 3, 5);
  const selected = [...subjects, '数学', '语文', '英语', '阅读', '科学', '思维']
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, count);
  const baseMinutes = Math.max(10, Math.floor(totalMinutes / selected.length / 5) * 5);
  const templates = {
    '数学': ['math', '核心概念回顾与两题练习', '用自己的话解释一个概念，再完成一道基础题和一道迁移题。', '概念理解'],
    '英语': ['english', '主题口语五轮问答', '围绕一个熟悉主题完成五轮简短问答，并记录一句想保留的表达。', '开口表达'],
    '语文': ['reading', '课文阅读与问题记录', '圈出三个关键词，用三句话复述，并写下一个课堂问题。', '信息提取'],
    '阅读': ['book', '整本书阅读与一句概括', '专注阅读后写下一句概括和一个值得讨论的问题。', '概括提问'],
    '科学': ['science', '生活现象观察任务', '观察一个现象，记录“看到什么—我的猜想—准备怎样验证”。', '观察证据'],
    '思维': ['thinking', '条件推理小挑战', '画出条件关系，完成一道推理题，并说清排除过程。', '解释理由'],
    '预习': ['preview', '六步课前预习', '完成看全貌、测基础、想明白、验理解、练迁移和定重点。', '问题意识']
  };

  const tasks = selected.map((subject, index) => {
    const [icon, title, description, taskFocus] = templates[subject] || templates['阅读'];
    return {
      id: uniqueId('mock-task', index),
      subject,
      icon,
      group: index < 2 ? 'required' : index === selected.length - 1 ? 'adventure' : 'optional',
      title,
      description,
      minutes: baseMinutes,
      difficulty: clamp(index + 1, 1, 3),
      focus: taskFocus,
      reward: { stars: 12 + index * 3, coins: 18 + index * 4, xp: 20 + index * 4, mapEnergy: 8 + index * 2 }
    };
  });
  return { tasks, parentTip: '先让孩子完成最容易启动的一项，再根据状态决定是否继续。', mode: 'mock' };
}

function mockPreview(payload) {
  const title = String(payload.title || payload.lesson || '新课预习');
  const subject = String(payload.subject || '数学');
  const grade = String(payload.grade || payload.childProfile?.grade || '四年级');
  const edition = String(payload.edition || '通用版');
  return {
    mode: 'mock',
    lesson: {
      id: uniqueId('mock-preview'), subject, grade, edition, title,
      textbookPages: '待家长核对', estimatedMinutes: 25,
      goal: `先了解《${title}》的全貌，发现自己已经会什么、还想知道什么。`,
      sourceNote: '由本地模板生成。正式使用前，请家长或教师核对教材表述、页码、图示和答案。',
      knowledgeCards: [
        { title: '本课核心概念', core: `先从教材例子中找出《${title}》最重要的共同特点。`, keyword: '观察与概括', pitfall: '只抄结论，没有记录观察依据。', question: '你能找到哪两个相同点？' },
        { title: '可能用到的旧知识', core: '把新内容和已经学过的概念、方法或生活经验联系起来。', keyword: '旧知联系', pitfall: '遇到陌生内容立刻搜答案。', question: '哪个旧知识最可能帮助你？' },
        { title: '课堂验证重点', core: '保留一个问题和一个猜想，在课堂中通过讲解、讨论或实验验证。', keyword: '问题与验证', pitfall: '把预习当成提前学完。', question: '你最想验证哪一个猜想？' }
      ],
      steps: [
        { id:'overview', title:'看全貌', subtitle:'我已经知道什么', instruction:`回忆和《${title}》有关的旧知识或生活经验。`, placeholder:'我已经知道……', icon:'book', reward:8 },
        { id:'baseline', title:'测基础', subtitle:'快速试一试', instruction:'写下自己最确定的一点和最不确定的一点。', placeholder:'我确定……我不确定……', icon:'clipboard', reward:8 },
        { id:'understand', title:'想明白', subtitle:'本课我先观察', instruction:'观察教材例子、图示或关键词，写下一条发现。', placeholder:'我观察到……', icon:'thinking', reward:10 },
        { id:'verify', title:'验理解', subtitle:'用自己的话说', instruction:'不用照抄课本，尝试解释本课核心概念。', placeholder:'我的解释是……', icon:'reading', reward:10 },
        { id:'transfer', title:'练迁移', subtitle:'动手试一试', instruction:'找一个新例子、完成一个小实验或做一道简单迁移题。', placeholder:'我的尝试是……', icon:'science', reward:12 },
        { id:'focus', title:'定重点', subtitle:'我的问题与课堂验证', instruction:'写下最重要的问题和你目前的猜想。', placeholder:'我想在课堂上验证……', icon:'preview', reward:12 }
      ],
      challenges: {
        recognize: { label:'认一认', question:'预习时最应该先做什么？', options:['直接背结论','观察材料并联系旧知','只做大量练习'], answer:1 },
        explain: { label:'说一说', prompt:'用自己的话解释一个本课核心知识。' },
        apply: { label:'用一用', prompt:'写下一个生活例子、简单应用或验证方法。' }
      }
    }
  };
}

function normalizeTaskResult(result) {
  const rawTasks = Array.isArray(result?.tasks) ? result.tasks : [];
  const allowedIcons = new Set(['math','english','reading','science','book','thinking','preview','clipboard']);
  const allowedGroups = new Set(['required','optional','adventure']);
  const tasks = rawTasks.slice(0, 5).map((task, index) => ({
    id: task.id || uniqueId('api-task', index),
    subject: String(task.subject || '阅读').slice(0, 10),
    icon: allowedIcons.has(task.icon) ? task.icon : 'book',
    group: allowedGroups.has(task.group) ? task.group : (index < 2 ? 'required' : 'optional'),
    title: String(task.title || '新的学习任务').slice(0, 40),
    description: String(task.description || '完成任务并写下一条学习记录。').slice(0, 160),
    minutes: clamp(task.minutes, 5, 30),
    difficulty: clamp(task.difficulty, 1, 3),
    focus: String(task.focus || '持续学习').slice(0, 20),
    reward: {
      stars: clamp(task.reward?.stars, 8, 25),
      coins: clamp(task.reward?.coins, 10, 35),
      xp: clamp(task.reward?.xp, 10, 35),
      mapEnergy: clamp(task.reward?.mapEnergy, 5, 20)
    }
  }));
  if (tasks.length < 3) throw new Error('模型返回的任务数量不足。');
  return { tasks, parentTip: String(result?.parentTip || '先完成最容易启动的一项。').slice(0, 100), mode: 'api' };
}

function normalizePreviewResult(result, payload) {
  const lesson = result?.lesson || result;
  if (!lesson || !Array.isArray(lesson.steps) || lesson.steps.length < 6) throw new Error('模型返回的预习单结构不完整。');
  const fallback = mockPreview(payload).lesson;
  const stepIds = ['overview','baseline','understand','verify','transfer','focus'];
  const iconById = { overview:'book', baseline:'clipboard', understand:'thinking', verify:'reading', transfer:'science', focus:'preview' };
  const steps = stepIds.map((id, index) => {
    const raw = lesson.steps.find((item) => item.id === id) || lesson.steps[index] || fallback.steps[index];
    return {
      ...fallback.steps[index],
      ...raw,
      id,
      icon: iconById[id],
      reward: clamp(raw.reward, 6, 15)
    };
  });
  const cards = Array.isArray(lesson.knowledgeCards) ? lesson.knowledgeCards.slice(0, 5) : fallback.knowledgeCards;
  const challenges = lesson.challenges || fallback.challenges;
  return {
    mode: 'api',
    lesson: {
      ...fallback,
      ...lesson,
      id: lesson.id || uniqueId('api-preview'),
      estimatedMinutes: clamp(lesson.estimatedMinutes, 15, 45),
      textbookPages: String(lesson.textbookPages || '待家长核对').slice(0, 40),
      sourceNote: String(lesson.sourceNote || fallback.sourceNote).slice(0, 240),
      knowledgeCards: cards.map((card, index) => ({
        title: String(card.title || `知识卡 ${index + 1}`).slice(0, 40),
        core: String(card.core || '').slice(0, 180),
        keyword: String(card.keyword || '').slice(0, 30),
        pitfall: String(card.pitfall || '').slice(0, 120),
        question: String(card.question || '').slice(0, 120)
      })),
      steps,
      challenges: {
        recognize: {
          label: '认一认',
          question: String(challenges.recognize?.question || fallback.challenges.recognize.question).slice(0, 140),
          options: Array.isArray(challenges.recognize?.options) ? challenges.recognize.options.slice(0, 3).map(String) : fallback.challenges.recognize.options,
          answer: clamp(challenges.recognize?.answer, 0, 2)
        },
        explain: { label:'说一说', prompt:String(challenges.explain?.prompt || fallback.challenges.explain.prompt).slice(0, 160) },
        apply: { label:'用一用', prompt:String(challenges.apply?.prompt || fallback.challenges.apply.prompt).slice(0, 160) }
      }
    }
  };
}

async function generateTasks(payload) {
  if (API_MODE === 'mock') return mockTasks(payload);
  return normalizeTaskResult(await callCompatibleModel(buildTaskPrompt(payload)));
}

async function generatePreview(payload) {
  if (API_MODE === 'mock') return mockPreview(payload);
  return normalizePreviewResult(await callCompatibleModel(buildPreviewPrompt(payload)), payload);
}

function safeStaticPath(requestPath) {
  const pathname = decodeURIComponent(String(requestPath || '/').split('?')[0]);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relative);
  if (!filePath.startsWith(`${ROOT}${path.sep}`) && filePath !== path.join(ROOT, 'index.html')) return null;
  return filePath;
}

async function serveStatic(req, res) {
  let filePath = safeStaticPath(req.url);
  if (!filePath) return sendJson(req, res, 403, { code:'FORBIDDEN', message:'禁止访问。' });
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    if (!path.extname(filePath)) filePath = path.join(ROOT, 'index.html');
  }
  try {
    const data = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': ext === '.html' || ext === '.js' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      ...corsHeaders(req)
    });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  } catch {
    sendJson(req, res, 404, { code:'NOT_FOUND', message:'文件不存在。' });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req));
      return res.end();
    }
    if ((req.url === '/health' || req.url === '/api/health') && req.method === 'GET') {
      return sendJson(req, res, 200, { ok:true, apiMode:API_MODE, model:process.env.AI_MODEL || null });
    }
    if (req.method === 'POST' && req.url === '/api/ai/generate-tasks') {
      if (!checkRateLimit(req)) return sendJson(req, res, 429, { code:'RATE_LIMITED', message:'请求过于频繁，请稍后再试。' });
      const payload = await readJson(req);
      if (!(payload.grade || payload.childProfile?.grade) || !(payload.minutes || payload.availableMinutes)) {
        return sendJson(req, res, 400, { code:'INVALID_INPUT', message:'缺少年级或可用时间。' });
      }
      return sendJson(req, res, 200, await generateTasks(payload));
    }
    if (req.method === 'POST' && req.url === '/api/ai/generate-preview') {
      if (!checkRateLimit(req)) return sendJson(req, res, 429, { code:'RATE_LIMITED', message:'请求过于频繁，请稍后再试。' });
      const payload = await readJson(req);
      if (!payload.subject || !(payload.grade || payload.childProfile?.grade) || !(payload.title || payload.lesson)) {
        return sendJson(req, res, 400, { code:'INVALID_INPUT', message:'缺少学科、年级或课题。' });
      }
      return sendJson(req, res, 200, await generatePreview(payload));
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
    return sendJson(req, res, 405, { code:'METHOD_NOT_ALLOWED', message:'不支持的请求方法。' });
  } catch (error) {
    console.error(error);
    sendJson(req, res, error.statusCode || 500, { code:error.code || 'SERVER_ERROR', message:error.message || '服务器内部错误。' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`孩子学习冒险基地 V2.0 已启动：http://${HOST}:${PORT}`);
  console.log(`API 模式：${API_MODE}${API_MODE === 'mock' ? '（无需密钥）' : ''}`);
});
