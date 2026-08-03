import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const errors = [];
const notes = [];

function fail(message) { errors.push(message); }
function ok(message) { notes.push(message); }
function exists(relative) { return fs.existsSync(path.join(ROOT, relative)); }
function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function walk(directory) {
  const absolute = path.join(ROOT, directory);
  if (!fs.existsSync(absolute)) return [];
  const result = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(relative));
    else result.push(relative);
  }
  return result;
}

const required = [
  'index.html', 'START_HERE.html', 'README.md', 'server.mjs', 'api-prompts.mjs',
  'package.json', '.env.example', 'assets/css/app.css', 'assets/js/config.js',
  'assets/js/data.js', 'assets/js/api-client.js', 'assets/js/app.js',
  'assets/mascot/xiaotanxing-wave.svg', 'assets/mascot/xiaotanxing-map.svg',
  'assets/mascot/xiaotanxing-clipboard.svg', 'docs/DEVELOPMENT_SPEC.md',
  'docs/ICON_AND_MASCOT_SPEC.md', 'docs/API_INTEGRATION.md',
  'docs/WORKBUDDY_FULL_PROMPT.md', 'docs/ACCEPTANCE_CHECKLIST.md'
];
for (const file of required) {
  if (!exists(file)) fail(`缺少必要文件：${file}`);
}
if (!errors.length) ok(`必要文件：${required.length} 项完整`);

const jsFiles = ['assets/js/config.js', 'assets/js/data.js', 'assets/js/api-client.js', 'assets/js/app.js', 'server.mjs', 'api-prompts.mjs', 'tests/static-check.mjs'];
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
  if (result.status !== 0) fail(`JavaScript 语法错误：${file}\n${result.stderr || result.stdout}`);
}
ok(`JavaScript 语法检查：${jsFiles.length} 个文件`);

const index = read('index.html');
const assetRefs = [...index.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)].map((match) => match[1]);
for (const ref of assetRefs) {
  if (/^(?:https?:|data:|mailto:)/i.test(ref)) continue;
  if (!exists(ref)) fail(`index.html 引用不存在：${ref}`);
}
ok(`index.html 静态引用：${assetRefs.length} 项`);

const iconFiles = walk('assets/icons').filter((file) => file.endsWith('.svg'));
if (iconFiles.length < 35) fail(`SVG 功能图标数量不足：${iconFiles.length}`);
for (const file of iconFiles) {
  const text = read(file);
  if (!/^\s*<svg\b/.test(text)) fail(`图标不是有效 SVG 开头：${file}`);
  if (!/viewBox=["']0 0 64 64["']/.test(text)) fail(`图标 viewBox 不统一：${file}`);
}
ok(`本地 SVG 功能图标：${iconFiles.length} 个`);

const sourceForIcons = [read('assets/js/app.js'), read('assets/js/data.js')].join('\n');
const referencedIcons = new Set();
for (const pattern of [
  /icon\(\s*['"]([a-z0-9-]+)['"]/g,
  /icon\s*:\s*['"]([a-z0-9-]+)['"]/g,
  /iconMap\s*=\s*\{([^}]+)\}/gs
]) {
  let match;
  while ((match = pattern.exec(sourceForIcons))) {
    if (pattern.source.startsWith('iconMap')) {
      for (const iconMatch of match[1].matchAll(/['"]([a-z0-9-]+)['"]\s*(?:,|$)/g)) referencedIcons.add(iconMatch[1]);
    } else referencedIcons.add(match[1]);
  }
}
for (const name of referencedIcons) {
  if (!exists(`assets/icons/${name}.svg`)) fail(`代码引用但缺少图标：assets/icons/${name}.svg`);
}
ok(`静态图标引用检查：${referencedIcons.size} 个语义名`);

const frontendFiles = ['index.html', 'START_HERE.html', 'assets/css/app.css', 'assets/js/config.js', 'assets/js/data.js', 'assets/js/api-client.js', 'assets/js/app.js', ...walk('assets/icons'), ...walk('assets/mascot'), ...walk('assets/illustrations')]
  .filter((file) => !/\.(?:png|jpe?g|webp)$/i.test(file));
const emojiRanges = [
  [0x1F000, 0x1FAFF],
  [0x2600, 0x27BF],
  [0xFE00, 0xFE0F]
];
for (const file of frontendFiles) {
  const text = read(file);
  for (const character of text) {
    const point = character.codePointAt(0);
    if (emojiRanges.some(([min, max]) => point >= min && point <= max)) {
      fail(`检测到 Emoji/图形字符：${file} U+${point.toString(16).toUpperCase()}`);
      break;
    }
  }
}
ok(`Emoji 图标扫描：${frontendFiles.length} 个前端文件`);

const externalScanFiles = ['index.html', 'START_HERE.html', 'assets/css/app.css', 'assets/js/config.js', 'assets/js/data.js', 'assets/js/api-client.js', 'assets/js/app.js'];
for (const file of externalScanFiles) {
  const text = read(file);
  if (/https?:\/\//i.test(text)) fail(`前端存在外部 URL/CDN：${file}`);
}
ok('前端无外部 CDN 与远程资源');

const config = read('assets/js/config.js');
const server = read('server.mjs');
for (const endpoint of ['/api/ai/generate-tasks', '/api/ai/generate-preview', '/api/health']) {
  if (!server.includes(endpoint)) fail(`服务端缺少路由：${endpoint}`);
}
for (const endpoint of ['/api/ai/generate-tasks', '/api/ai/generate-preview']) {
  if (!config.includes(endpoint)) fail(`前端 config 缺少接口：${endpoint}`);
}
ok('前后端 API 路由一致');

const prototypeFiles = walk('docs/prototypes').filter((file) => file.endsWith('.png'));
const screenshotFiles = walk('screenshots').filter((file) => file.endsWith('.png'));
if (prototypeFiles.length < 4) fail(`原型图至少应为 4 张，当前 ${prototypeFiles.length} 张`);
if (screenshotFiles.length < 5) fail(`实际页面截图至少 5 张，当前 ${screenshotFiles.length} 张`);
ok(`原型图 ${prototypeFiles.length} 张，运行截图 ${screenshotFiles.length} 张`);

const html = read('index.html');
if (!html.includes('assets/css/app.css')) fail('index.html 未引用唯一有效 CSS');
if (!html.includes('assets/js/app.js')) fail('index.html 未引用唯一有效主应用脚本');
if (html.includes('styles.css') || html.includes('src="app.js"')) fail('index.html 仍引用旧版根目录文件');

if (errors.length) {
  console.error('\n静态检查失败：');
  errors.forEach((error, index) => console.error(`${index + 1}. ${error}`));
  process.exit(1);
}

console.log('AI学习冒险基地静态检查通过。');
for (const note of notes) console.log(`- ${note}`);
