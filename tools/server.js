'use strict';
/**
 * 洛月 · 本地写作工具
 *
 * 一个零依赖的本地小服务：
 *   - 在浏览器里写文章（积木式）
 *   - 生成 post-XX.html，并把条目写进 assets/js/posts.js
 *   - 通过 git 一键提交并推送到 GitHub
 *
 * 启动：双击 tools/start.bat，或命令行 node tools/server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, exec, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4173;
const POSTS_JS = path.join(ROOT, 'assets', 'js', 'posts.js');
const CONFIG_JSON = path.join(__dirname, 'config.json');

/* ---------------- 小工具 ---------------- */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    req.on('data', function (c) {
      data += c;
      if (data.length > 30 * 1024 * 1024) reject(new Error('请求体过大'));
    });
    req.on('end', function () { resolve(data); });
    req.on('error', reject);
  });
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf8')); } catch (e) { return {}; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_JSON, JSON.stringify(cfg, null, 2), 'utf8');
}

/* ---------------- git ---------------- */

let GIT_BIN = null;

function findGit() {
  // 优先用配置里指定的路径（换电脑后不用改代码）
  try {
    const cfg = loadConfig();
    if (cfg.gitPath && fs.existsSync(cfg.gitPath)) { GIT_BIN = cfg.gitPath; return GIT_BIN; }
  } catch (e) {}
  if (process.env.GIT_BIN && fs.existsSync(process.env.GIT_BIN)) {
    GIT_BIN = process.env.GIT_BIN;
    return GIT_BIN;
  }

  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    GIT_BIN = 'git';
    return 'git';
  } catch (e) { /* 继续找 */ }

  const candidates = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'D:\\Git\\cmd\\git.exe',
    'D:\\Git\\mingw64\\bin\\git.exe',
    'D:\\Git\\bin\\git.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'cmd', 'git.exe')
  ];

  // GitHub Desktop 自带的 git
  try {
    const base = path.join(process.env.LOCALAPPDATA || '', 'GitHubDesktop');
    if (fs.existsSync(base)) {
      fs.readdirSync(base).forEach(function (d) {
        if (d.indexOf('app-') === 0) {
          candidates.push(path.join(base, d, 'resources', 'app', 'git', 'cmd', 'git.exe'));
        }
      });
    }
  } catch (e) {}

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) { GIT_BIN = c; return c; }
    } catch (e) {}
  }
  return null;
}

function git(args, cwd) {
  return new Promise(function (resolve) {
    if (!GIT_BIN) return resolve({ ok: false, out: '没有找到 git，请先安装 Git for Windows 或 GitHub Desktop。' });
    execFile(GIT_BIN, args, { cwd: cwd || ROOT, maxBuffer: 20 * 1024 * 1024 }, function (err, stdout, stderr) {
      const out = (stdout || '') + (stderr || '');
      resolve({ ok: !err, out: out.trim() || (err ? String(err.message) : '') });
    });
  });
}

async function gitStatus() {
  const isRepo = fs.existsSync(path.join(ROOT, '.git'));
  if (!isRepo) {
    return { isRepo: false, git: GIT_BIN, branch: '', remote: '', changes: [] };
  }
  const b = await git(['branch', '--show-current']);
  const r = await git(['remote', '-v']);
  const s = await git(['status', '--porcelain']);
  return {
    isRepo: true,
    git: GIT_BIN,
    branch: b.out.split('\n')[0] || 'main',
    remote: r.out.split('\n')[0] || '',
    changes: s.out ? s.out.split('\n').filter(Boolean) : []
  };
}

/* ---------------- 文章数据 ---------------- */

function readPostsRaw() {
  return fs.readFileSync(POSTS_JS, 'utf8');
}

function listPosts() {
  const raw = readPostsRaw();
  const out = [];
  const re = /slug:\s*"([^"]*)"[\s\S]*?no:\s*"([^"]*)"[\s\S]*?title:\s*"([^"]*)"[\s\S]*?date:\s*"([^"]*)"[\s\S]*?tag:\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(raw))) {
    out.push({ slug: m[1], no: m[2], title: m[3], date: m[4], tag: m[5] });
  }
  return out;
}

function parsePostsFull() {
  const raw = readPostsRaw();
  const out = [];
  const marks = [];
  const re = /slug:\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(raw))) marks.push({ pos: m.index, slug: m[1] });
  for (let i = 0; i < marks.length; i++) {
    const start = raw.lastIndexOf('{', marks[i].pos);
    let end = raw.indexOf('\n  }', marks[i].pos);
    if (end < 0) end = raw.length;
    const block = raw.slice(start, end + 4);
    const txt = function (k) {
      const mm = block.match(new RegExp(k + ':\\s*"((?:[^"\\\\]|\\\\.)*)"'));
      return mm ? mm[1].replace(/\\"/g, '"') : '';
    };
    const num = function (k, d) {
      const mm = block.match(new RegExp(k + ':\\s*(\\d+)'));
      return mm ? +mm[1] : d;
    };
    out.push({
      slug: txt('slug') || marks[i].slug, file: txt('file'), no: txt('no'), title: txt('title'),
      word: txt('word'), date: txt('date'), tag: txt('tag'),
      tone: num('tone', 2), read: num('read', 5),
      cover: txt('cover'), excerpt: txt('excerpt')
    });
  }
  return out;
}

function entryText(e) {
  return '  {\n' +
    '    slug: "' + e.slug + '",\n' +
    '    file: "' + e.file + '",\n' +
    '    no: "' + e.no + '",\n' +
    '    title: "' + String(e.title).replace(/"/g, '\\"') + '",\n' +
    '    word: "' + String(e.word).replace(/"/g, '\\"') + '",\n' +
    '    date: "' + e.date + '",\n' +
    '    tag: "' + String(e.tag).replace(/"/g, '\\"') + '",\n' +
    '    tone: ' + (e.tone || 2) + ',\n' +
    '    read: ' + (e.read || 5) + ',\n' +
    '    cover: "' + String(e.cover || '').replace(/"/g, '\\"') + '",\n' +
    '    excerpt: "' + String(e.excerpt || '').replace(/"/g, '\\"') + '"\n' +
    '  },';
}

function replacePostEntry(file, e) {
  const raw = readPostsRaw();
  const re = new RegExp('\\n  \\{\\n    slug: "[^"]*",\\n    file: "' + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '",[\\s\\S]*?\\n  \\},');
  if (!re.test(raw)) return false;
  fs.writeFileSync(POSTS_JS, raw.replace(re, '\n' + entryText(e)), 'utf8');
  return true;
}

function removePostEntry(file) {
  const raw = readPostsRaw();
  const re = new RegExp('\\n  \\{\\n    slug: "[^"]*",\\n    file: "' + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '",[\\s\\S]*?\\n  \\},');
  if (!re.test(raw)) return false;
  fs.writeFileSync(POSTS_JS, raw.replace(re, ''), 'utf8');
  return true;
}

function stripTags(html) {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
}

function parseArticle(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return null;
  const html = fs.readFileSync(full, 'utf8');

  const meta = {};
  const kicker = html.match(/<p class="article-kicker">([\s\S]*?)<\/p>/);
  if (kicker) {
    const spans = [];
    kicker[1].replace(/<span>([\s\S]*?)<\/span>/g, function (_, t) { spans.push(stripTags(t)); return ''; });
    meta.tag = spans[0] || '日々';
    meta.date = spans[1] || '';
    meta.read = (spans[2] || '5').replace(/[^\d]/g, '') || '5';
  }
  const h1 = html.match(/<h1 class="article-title">([\s\S]*?)<\/h1>/);
  meta.title = h1 ? stripTags(h1[1]) : '';

  const cover = html.match(/<div class="article-cover ([^"]*)">/);
  meta.tone = 2;
  if (cover) {
    const m = cover[1].match(/cover-(\d)/);
    if (m) meta.tone = +m[1];
  }
  const word = html.match(/<span class="cover-word" lang="ja">([\s\S]*?)<\/span>/);
  meta.word = word ? stripTags(word[1]) : '';

  const desc = html.match(/<meta name="description" content="([^"]*)">/);
  meta.excerpt = desc ? desc[1] : '';

  // 取 prose 内部
  const pm = html.match(/<div class="prose">([\s\S]*?)<\/div>\s*<div class="article-foot">/);
  const inner = pm ? pm[1] : '';
  const blocks = [];
  const re = /<(p|h2|blockquote|figure)\b([^>]*)>([\s\S]*?)<\/\1>|<div class="(dialogue|note)">([\s\S]*?)<\/div>/g;
  let m2;
  while ((m2 = re.exec(inner))) {
    if (m2[1]) {
      const tag = m2[1], attrs = m2[2] || '', content = m2[3];
      if (tag === 'p') blocks.push({ type: 'p', text: stripTags(content) });
      else if (tag === 'h2') blocks.push({ type: 'h2', text: stripTags(content) });
      else if (tag === 'blockquote') blocks.push({ type: 'quote', text: stripTags(content) });
      else if (tag === 'figure') {
        const img = content.match(/<img[^>]*src="([^"]*)"/);
        const cap = content.match(/<figcaption>([\s\S]*?)<\/figcaption>/);
        const alt = content.match(/<img[^>]*alt="([^"]*)"/);
        blocks.push({
          type: /polaroid/.test(attrs) ? 'polaroid' : 'figure',
          src: img ? img[1] : '',
          caption: cap ? stripTags(cap[1]) : '',
          alt: alt ? alt[1] : ''
        });
      }
    } else {
      blocks.push({ type: m2[4], text: stripTags(m2[5]) });
    }
  }
  return { meta: meta, blocks: blocks };
}

function pagerHTML(prev, next) {
  if (!prev && !next) return '';
  var out = '<nav class="pager">';
  if (prev) out += '<a href="' + prev.file.split('/').pop() + '"><span>NEWER</span><b>' + esc(prev.title) + '</b></a>';
  if (next) out += '<a href="' + next.file.split('/').pop() + '"><span>OLDER</span><b>' + esc(next.title) + '</b></a>';
  out += '</nav>';
  return out;
}


/* ---------------- 关于页 ---------------- */
const ABOUT_JSON = path.join(__dirname, 'about.json');

const ABOUT_SEED = {
  avatar: 'assets/img/avatar.svg',
  name: '洛叶',
  handle: '洛叶Zzz · @luoye',
  facts: [
    { k: '身份', v: '学生 / 写字的人' },
    { k: '喜欢', v: '月亮、樱花、便利店的热牛奶' },
    { k: '在做', v: '一个没有算法的博客' },
    { k: '看板娘', v: '逢坂大河' }
  ],
  introTitle: '白天是学生，晚上写字',
  intro: [
    '喜欢在句尾加省略号，喜欢便利店六点钟的关东煮，喜欢下雨之后没人走的台阶。写东西的原因很简单：有些瞬间如果不记下来，第二天就只剩下一个模糊的形状。',
    '这个站是 2026 年 9 月开的。名字从「樱日和」改到「洛叶书斋」，最后定成「洛月」——因为我想留一点赏月的心情，也喜欢夜里那段没人打扰的时间。'
  ],
  favorites: [
    { name: '洛琪希·米格路迪亚', src: '无职转生 / 水圣级魔法师' },
    { name: '音理', src: '星空列车与白的旅行 / 夜行的旅伴' },
    { name: '逢坂大河', src: '龙与虎 / 掌中老虎' },
    { name: '普卡（风花）', src: '融化的风花与白兔 / 两个名字，同一个人' },
    { name: '蕾克', src: 'BLACK SOULS / 小红帽' },
    { name: '哥伦比娅', src: '原神 / 少女，月亮与夜' },
    { name: '安魂曲', src: '异环 / 安静的二游角色' }
  ],
  timeline: [
    { date: '2026.09.12', text: '开了这个站，写下第一篇。' },
    { date: '2026.09.29', text: '开始把喜欢的句子抄进读书笔记。' },
    { date: '2026.10.11', text: '记录清晨六点的便利店。' },
    { date: '2026.10.18', text: '第一次把天空写进小说里。' },
    { date: '2026.10.21', text: '站名改成「洛月」，看板娘昼夜各一位。' }
  ],
  links: [
    { label: 'GitHub', url: '#' },
    { label: 'Bilibili', url: '#' },
    { label: '邮箱', url: '#' }
  ]
};

function loadAbout() {
  try {
    if (!fs.existsSync(ABOUT_JSON)) {
      fs.writeFileSync(ABOUT_JSON, JSON.stringify(ABOUT_SEED, null, 2), 'utf8');
      return JSON.parse(JSON.stringify(ABOUT_SEED));
    }
    const d = JSON.parse(fs.readFileSync(ABOUT_JSON, 'utf8'));
    return Object.assign(JSON.parse(JSON.stringify(ABOUT_SEED)), d);
  } catch (e) {
    return JSON.parse(JSON.stringify(ABOUT_SEED));
  }
}

function renderAbout(d) {
  const facts = (d.facts || []).map(function (x) {
    return '        <li><b>' + esc(x.k) + '</b>　' + esc(x.v) + '</li>';
  }).join('\n');
  const intro = (d.intro || []).map(function (p) { return '      <p>' + esc(p) + '</p>'; }).join('\n');
  const favs = (d.favorites || []).map(function (x) {
    return '        <div class="fav"><b>' + esc(x.name) + '</b><span>' + esc(x.src) + '</span></div>';
  }).join('\n');
  const tl = (d.timeline || []).map(function (x) {
    return '        <li><time>' + esc(x.date) + '</time>' + esc(x.text) + '</li>';
  }).join('\n');
  const links = (d.links || []).map(function (x) {
    const svg2 = iconSVG(iconKeyFor(x.label, x.icon));
    return '        <a class="pill" href="' + esc(x.url) + '">' + (svg2 ? svg2 + ' ' : '') + esc(x.label) + '</a>';
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>关于 ｜ 洛月</title>
<meta name="description" content="关于${esc(d.name)}：写字的人，也是看月亮的人。">
<meta name="theme-color" content="#FBF5F0">
<link rel="icon" type="image/svg+xml" href="assets/img/favicon.svg">
<script>
  (function () {
    try {
      var q = new URLSearchParams(location.search).get("theme");
      if (q === "dark" || q === "light") { document.documentElement.setAttribute("data-theme", q); return; }
      if (localStorage.getItem("sb-theme") === "dark") { document.documentElement.setAttribute("data-theme", "dark"); }
    } catch (e) {}
  })();
</script>
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

<a class="skip-link" href="#main">跳到正文</a>

<header class="topbar">
  <div class="topbar-inner">
    <div class="topbar-left">
    <a class="back-btn" href="index.html" aria-label="返回首页">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>
      <span>首页</span>
    </a>
    <a class="brand" href="index.html">
      <img src="assets/img/moon.svg" alt="" width="24" height="24">
      <span class="brand-txt"><b>洛月</b><i>LUOYUE</i></span>
    </a>
    </div>
    <nav class="topnav" id="topnav">
      <a href="index.html">首页</a>
      <a href="posts.html">文章</a>
      <a href="about.html" class="is-current" aria-current="page">关于</a>
    </nav>
    <div class="topbar-tools">
      <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="切换夜间模式" title="切换夜间模式">
        <svg class="ic-sun" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></svg>
        <svg class="ic-moon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8.2 8.2 0 1 0 20 14.5z"/></svg>
      </button>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="topnav" aria-label="打开菜单"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>

<main id="main">

  <section class="page-head">
    <div class="wrap">
      <p class="page-kicker">プロフィール <span class="sep">/</span> ABOUT</p>
      <h1 class="page-title">关于${esc(d.name)}</h1>
      <p class="page-lead">写字的人，也是看月亮的人。这个站没有算法、没有推荐，只有我隔一段时间放进来的东西。</p>
    </div>
  </section>

  <div class="about-grid">

    <aside class="profile-card">
      <img src="${esc(d.avatar)}" alt="头像" width="92" height="92">
      <p class="profile-name">${esc(d.name)}</p>
      <p class="profile-handle">${esc(d.handle)}</p>
      <ul class="profile-list">
${facts}
      </ul>
    </aside>

    <div class="about-body">
      <h2>${esc(d.introTitle)}</h2>
${intro}

      <h2>喜欢的东西</h2>
      <div class="fav-grid">
${favs}
      </div>

      <h2>时间线</h2>
      <ul class="timeline">
${tl}
      </ul>

      <h2>写信给我</h2>
      <p>站内不设评论区。想说话的话，下面任选一个入口。</p>
      <div class="hero-links">
${links}
      </div>
    </div>

  </div>

</main>

<footer class="site-foot">
  <div class="foot-inner">
    <div class="foot-brand">
      <p class="foot-jp">洛月</p>
      <p class="foot-note">把日常写成轻小说。<br>在句尾留一点空白。</p>
    </div>
    <nav class="foot-nav" aria-label="页脚导航">
      <a href="index.html">首页</a>
      <a href="posts.html">文章</a>
      <a href="about.html">关于</a>
    </nav>
    <p class="foot-tag" aria-hidden="true">つきがきれい</p>
  </div>
  <div class="foot-copy">
    <span>© <span data-year>2026</span> 洛叶 · 内容与图片版权归原作者所有</span>
    <span>已运行 <b data-since="2026-09-12">0</b> 天 · 手写 HTML / CSS</span>
  </div>
</footer>

<script src="assets/js/main.js"></script>
</body>
</html>
`;
}


const ICONS = (function () {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'icons.json'), 'utf8')); }
  catch (e) { return {}; }
})();

function iconSVG(key) {
  const it = ICONS[key];
  return it && it.svg ? it.svg : '';
}

function iconKeyFor(label, icon) {
  if (icon && ICONS[icon]) return icon;
  const t = String(label || '').toLowerCase();
  if (t.indexOf('github') > -1 || t.indexOf('git') > -1) return 'github';
  if (t.indexOf('bili') > -1) return 'bilibili';
  if (t.indexOf('wechat') > -1 || t.indexOf('微信') > -1) return 'wechat';
  if (t.indexOf('qq') > -1) return 'qq';
  if (t.indexOf('weibo') > -1 || t.indexOf('微博') > -1) return 'weibo';
  if (t.indexOf('抖音') > -1 || t.indexOf('douyin') > -1) return 'douyin';
  if (t.indexOf('快手') > -1 || t.indexOf('kuaishou') > -1) return 'kuaishou';
  if (t.indexOf('小红书') > -1) return 'xiaohongshu';
  if (t.indexOf('知乎') > -1) return 'zhihu';
  if (t.indexOf('贴吧') > -1) return 'tieba';
  if (t.indexOf('mail') > -1 || t.indexOf('邮') > -1) return 'email';
  if (t.indexOf('x') > -1 || t.indexOf('twitter') > -1) return 'twitter';
  if (t.indexOf('telegram') > -1) return 'telegram';
  if (t.indexOf('discord') > -1) return 'discord';
  if (t.indexOf('youtube') > -1) return 'youtube';
  if (t.indexOf('steam') > -1) return 'steam';
  if (t.indexOf('pixiv') > -1) return 'pixiv';
  if (t.indexOf('instagram') > -1) return 'instagram';
  return '';
}

function renderHeroLinks(links) {
  return (links || []).map(function (x) {
    const svg = iconSVG(iconKeyFor(x.label, x.icon));
    return '          <a class="pill" href="' + esc(x.url) + '">\n' +
      (svg ? '            ' + svg + '\n' : '') +
      '            ' + esc(x.label) + '\n' +
      '          </a>';
  }).join('\n');
}

function syncHomeLinks(links) {
  const idx = path.join(ROOT, 'index.html');
  if (!fs.existsSync(idx)) return false;
  const html = fs.readFileSync(idx, 'utf8');
  const startTag = '<div class="hero-links">';
  const i = html.indexOf(startTag);
  if (i < 0) return false;
  const innerStart = i + startTag.length;
  const end = html.indexOf('</div>', innerStart);
  if (end < 0) return false;
  const next = html.slice(0, innerStart) + '\n' + renderHeroLinks(links) + '\n        ' + html.slice(end);
  fs.writeFileSync(idx, next, 'utf8');
  return true;
}


function siteOrigin() {
  const cfg = loadConfig();
  let u = (cfg.siteUrl || '').trim();
  if (!u) return '';
  return u.replace(/\/+$/, '');
}

function buildSitemap() {
  const origin = siteOrigin();
  if (!origin) return false;
  const posts = parsePostsFull();
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: origin + '/', last: today, pri: '1.0' },
    { loc: origin + '/posts.html', last: today, pri: '0.9' },
    { loc: origin + '/quotes.html', last: today, pri: '0.7' },
    { loc: origin + '/about.html', last: today, pri: '0.6' }
  ];
  posts.forEach(function (p) {
    const d = (p.date || '').replace(/\./g, '-');
    urls.push({ loc: origin + '/' + p.file, last: d || today, pri: '0.8' });
  });
  const body = urls.map(function (u) {
    return '  <url>\n' +
      '    <loc>' + u.loc + '</loc>\n' +
      '    <lastmod>' + u.last + '</lastmod>\n' +
      '    <priority>' + u.pri + '</priority>\n' +
      '  </url>';
  }).join('\n');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
  return true;
}

function buildRobots() {
  const origin = siteOrigin();
  if (!origin) return false;
  fs.writeFileSync(path.join(ROOT, 'robots.txt'),
    'User-agent: *\nAllow: /\n\nSitemap: ' + origin + '/sitemap.xml\n', 'utf8');
  return true;
}

/* ---------------- 首页文案 ---------------- */
const INDEX_HTML = path.join(ROOT, "index.html");

function readHomeCopy() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const out = {};
  const t = html.match(/<h1 class="hero-title">([\s\S]*?)<\/h1>/);
  if (t) {
    const parts = t[1].split(/<br\s*\/?>\s*<em>/i);
    out.heroLine1 = parts[0].replace(/<[^>]+>/g, "").trim();
    out.heroLine2 = (parts[1] || "").replace(/<[^>]+>/g, "").trim();
  }
  const l = html.match(/<p class="hero-lead">([\s\S]*?)<\/p>/);
  if (l) {
    const lines = l[1].split(/<br\s*\/?>/i);
    out.lead1 = lines[0].replace(/<[^>]+>/g, "").trim();
    out.lead2 = (lines[1] || "").replace(/<[^>]+>/g, "").trim();
  }
  const f = html.match(/<p class="foot-note">([\s\S]*?)<\/p>/);
  if (f) {
    const lines = f[1].split(/<br\s*\/?>/i);
    out.foot1 = lines[0].replace(/<[^>]+>/g, "").trim();
    out.foot2 = (lines[1] || "").replace(/<[^>]+>/g, "").trim();
  }
  return out;
}

function writeHomeCopy(d) {
  let html = fs.readFileSync(INDEX_HTML, "utf8");
  const safe = function (v) { return String(v || "").replace(/[<>&]/g, ""); };
  html = html.replace(/<h1 class="hero-title">[\s\S]*?<\/h1>/i,
    '<h1 class="hero-title">' + safe(d.heroLine1) + '<br><em>' + safe(d.heroLine2) + '</em></h1>');
  html = html.replace(/<p class="hero-lead">[\s\S]*?<\/p>/i,
    '<p class="hero-lead">' + safe(d.lead1) + '<br>' + safe(d.lead2) + '</p>');
  html = html.replace(/<p class="foot-note">[\s\S]*?<\/p>/i,
    '<p class="foot-note">' + safe(d.foot1) + '<br>' + safe(d.foot2) + '</p>');
  fs.writeFileSync(INDEX_HTML, html, "utf8");
  return true;
}
/* ---------------- 台词收藏 ---------------- */
const QUOTES_JSON = path.join(__dirname, "quotes.json");
const QUOTES_JS = path.join(ROOT, "assets", "js", "quotes-data.js");

function loadQuotes() {
  try {
    if (!fs.existsSync(QUOTES_JSON)) return { quotes: [] };
    return JSON.parse(fs.readFileSync(QUOTES_JSON, "utf8"));
  } catch (e) { return { quotes: [] }; }
}

function saveQuotes(data) {
  const list = (data && data.quotes) ? data.quotes : [];
  fs.writeFileSync(QUOTES_JSON, JSON.stringify({ quotes: list }, null, 2), "utf8");
  fs.writeFileSync(QUOTES_JS, "window.QUOTES = " + JSON.stringify(list, null, 2) + ";\n", "utf8");
  return true;
}
async function ensureGitIdentity(remote) {
  const cur = await git(['config', 'user.email']);
  if (cur.out && cur.out.trim()) return false;
  let owner = '';
  try {
    const url = remote || (await git(['remote', 'get-url', 'origin'])).out || '';
    const m = url.match(/github\.com[:\/]([^\/]+)\//i);
    if (m) owner = m[1];
  } catch (e) {}
  const name = owner || 'Luoyue';
  const email = owner ? owner + '@users.noreply.github.com' : 'luoye@local';
  await git(['config', 'user.name', name]);
  await git(['config', 'user.email', email]);
  return true;
}
function nextNo() {
  const posts = listPosts();
  let max = 0;
  posts.forEach(function (p) {
    const n = parseInt(p.no, 10);
    if (!isNaN(n) && n > max) max = n;
  });
  const n = max + 1;
  return n < 10 ? '0' + n : String(n);
}

function insertPost(entry) {
  const raw = readPostsRaw();
  const marker = 'window.POSTS = [';
  const i = raw.indexOf(marker);
  if (i < 0) throw new Error('posts.js 结构不对，找不到 window.POSTS = [');
  const at = i + marker.length;
  fs.writeFileSync(POSTS_JS, raw.slice(0, at) + '\n' + entryText(entry) + raw.slice(at), 'utf8');
}

function renderBlock(b) {
  const t = b.text || '';
  switch (b.type) {
    case 'h2':
      return '      <h2>' + esc(t) + '</h2>';
    case 'dialogue':
      return '      <div class="dialogue">' + t.split(/\r?\n/).map(esc).join('<br>') + '</div>';
    case 'note':
      return '      <div class="note">' + esc(t) + '</div>';
    case 'quote':
      return '      <blockquote>' + esc(t) + '</blockquote>';
    case 'figure':
      return '      <figure>\n        <img src="' + esc(b.src) + '" alt="' + esc(b.alt) + '">\n        <figcaption>' + esc(b.caption) + '</figcaption>\n      </figure>';
    case 'polaroid':
      return '      <figure class="polaroid">\n        <img src="' + esc(b.src) + '" alt="' + esc(b.alt) + '">\n        <figcaption>' + esc(b.caption) + '</figcaption>\n      </figure>';
    default:
      return '      <p>' + esc(t) + '</p>';
  }
}

function renderArticle(meta, blocks, pager) {
  const body = blocks.map(renderBlock).filter(Boolean).join('\n\n');
  const cover = meta.tone === 1
    ? 'cover-1'
    : 'cover-' + (meta.tone || 2);

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)} ｜ 洛月</title>
<meta name="description" content="${esc(meta.excerpt)}">
<meta name="theme-color" content="#FBF5F0">
<link rel="icon" type="image/svg+xml" href="../assets/img/favicon.svg">
<script>
  (function () {
    try {
      var q = new URLSearchParams(location.search).get("theme");
      if (q === "dark" || q === "light") { document.documentElement.setAttribute("data-theme", q); return; }
      if (localStorage.getItem("sb-theme") === "dark") { document.documentElement.setAttribute("data-theme", "dark"); }
    } catch (e) {}
  })();
</script>
<link rel="stylesheet" href="../assets/css/style.css">
</head>
<body>

<a class="skip-link" href="#main">跳到正文</a>

<header class="topbar">
  <div class="topbar-inner">
    <div class="topbar-left">
    <a class="back-btn" href="../posts.html" aria-label="返回文章">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>
      <span>文章</span>
    </a>
    <a class="brand" href="../index.html">
      <img src="../assets/img/moon.svg" alt="" width="24" height="24">
      <span class="brand-txt"><b>洛月</b><i>LUOYUE</i></span>
    </a>
    </div>
    <nav class="topnav" id="topnav">
      <a href="../index.html">首页</a>
      <a href="../posts.html" class="is-current" aria-current="page">文章</a>
      <a href="../about.html">关于</a>
    </nav>
    <div class="topbar-tools">
      <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="切换夜间模式" title="切换夜间模式">
        <svg class="ic-sun" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></svg>
        <svg class="ic-moon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8.2 8.2 0 1 0 20 14.5z"/></svg>
      </button>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="topnav" aria-label="打开菜单"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>

<main id="main">
  <article>
    <header class="article-head">
      <p class="article-kicker"><span>${esc(meta.tag)}</span><span>${esc(meta.date)}</span><span>${esc(meta.read)} min</span></p>
      <h1 class="article-title">${esc(meta.title)}</h1>
    </header>

    <div class="article-cover ${cover}"${meta.cover ? ` style="background-image:url('${meta.cover}')"` : ''}>
      <span class="cover-word" lang="ja">${esc(meta.word)}</span>
      <img class="cover-flower" src="../assets/img/flower.svg" alt="" aria-hidden="true">
    </div>

    <div class="prose">

${body}

    </div>

    <div class="article-foot">
      <div class="article-tags">
        <a class="tag-chip" href="../posts.html">${esc(meta.tag)}</a>
      </div>
      <a class="link-arrow" href="../posts.html">← 返回列表</a>
    </div>

${pager || ''}
  </article>
</main>

<footer class="site-foot">
  <div class="foot-inner">
    <div class="foot-brand">
      <p class="foot-jp">洛月</p>
      <p class="foot-note">把日常写成轻小说。<br>在句尾留一点空白。</p>
    </div>
    <nav class="foot-nav" aria-label="页脚导航">
      <a href="../index.html">首页</a>
      <a href="../posts.html">文章</a>
      <a href="../about.html">关于</a>
    </nav>
    <p class="foot-tag" aria-hidden="true">つきがきれい</p>
  </div>
  <div class="foot-copy">
    <span>© <span data-year>2026</span> 洛叶 · 内容与图片版权归原作者所有</span>
    <span>已运行 <b data-since="2026-09-12">0</b> 天 · 手写 HTML / CSS</span>
  </div>
</footer>

<script src="../assets/js/main.js"></script>
</body>
</html>
`;
}

/* ---------------- 静态文件 ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, function (err, buf) {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

/* ---------------- 路由 ---------------- */

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      return serveStatic(res, path.join(__dirname, 'editor.html'));
    }

    if (req.method === 'GET' && url.pathname === '/api/status') {
      const st = await gitStatus();
      return sendJSON(res, 200, {
        node: process.version,
        port: PORT,
        git: st.git, isRepo: st.isRepo, branch: st.branch,
        remote: st.remote, changes: st.changes,
        posts: listPosts(),
        config: loadConfig()
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/shutdown') {
      sendJSON(res, 200, { ok: true });
      setTimeout(function () { process.exit(0); }, 200);
      return;
    }


    if (req.method === 'GET' && url.pathname === '/api/home') {
      return sendJSON(res, 200, { ok: true, data: readHomeCopy() });
    }

    if (req.method === 'POST' && url.pathname === '/api/home') {
      const body = JSON.parse(await readBody(req));
      writeHomeCopy(body.data || {});
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/quotes') {
      return sendJSON(res, 200, { ok: true, data: loadQuotes() });
    }

    if (req.method === 'POST' && url.pathname === '/api/quotes') {
      const body = JSON.parse(await readBody(req));
      saveQuotes(body.data || {});
      return sendJSON(res, 200, { ok: true, count: (body.data && body.data.quotes || []).length });
    }

    if (req.method === 'POST' && url.pathname === '/api/config') {
      const body = JSON.parse(await readBody(req));
      const cfg = loadConfig();
      if (typeof body.siteUrl === 'string') cfg.siteUrl = body.siteUrl.trim();
      if (typeof body.gitPath === 'string') cfg.gitPath = body.gitPath.trim();
      saveConfig(cfg);
      buildSitemap(); buildRobots();
      return sendJSON(res, 200, { ok: true, config: cfg, sitemap: !!siteOrigin() });
    }

    if (req.method === 'GET' && url.pathname === '/api/icons') {
      return sendJSON(res, 200, { ok: true, icons: ICONS });
    }

    if (req.method === 'GET' && url.pathname === '/api/about') {
      return sendJSON(res, 200, { ok: true, data: loadAbout() });
    }

    if (req.method === 'POST' && url.pathname === '/api/about') {
      const body = JSON.parse(await readBody(req));
      const data = body.data || {};
      fs.writeFileSync(ABOUT_JSON, JSON.stringify(data, null, 2), 'utf8');
      fs.writeFileSync(path.join(ROOT, 'about.html'), renderAbout(data), 'utf8');
      syncHomeLinks(data.links);
      return sendJSON(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/posts') {
      return sendJSON(res, 200, { ok: true, posts: parsePostsFull() });
    }

    if (req.method === 'GET' && url.pathname === '/api/post') {
      const file = url.searchParams.get('file') || '';
      if (!/^posts[\/][\w.-]+\.html$/.test(file)) return sendJSON(res, 400, { ok: false, error: '文件名不合法' });
      const data = parseArticle(file);
      if (!data) return sendJSON(res, 404, { ok: false, error: '文件不存在' });
      return sendJSON(res, 200, { ok: true, file: file, meta: data.meta, blocks: data.blocks });
    }

    if (req.method === 'POST' && url.pathname === '/api/delete') {
      const body = JSON.parse(await readBody(req));
      const file = String(body.file || '');
      if (!/^posts[\/][\w.-]+\.html$/.test(file)) return sendJSON(res, 400, { ok: false, error: '文件名不合法' });
      const full = path.join(ROOT, file);
      if (!full.startsWith(ROOT + path.sep)) return sendJSON(res, 400, { ok: false, error: '路径不合法' });
      let removedFile = false;
      try { if (fs.existsSync(full)) { fs.unlinkSync(full); removedFile = true; } } catch (e) {}
      const removedEntry = removePostEntry(file);
      buildSitemap(); buildRobots();
      return sendJSON(res, 200, { ok: true, removedFile: removedFile, removedEntry: removedEntry });
    }

    if (req.method === 'POST' && url.pathname === '/api/save') {
      const body = JSON.parse(await readBody(req));
      const meta = body.meta || {};
      const blocks = body.blocks || [];
      const editFile = String(body.editFile || '');
      if (!meta.title) return sendJSON(res, 400, { ok: false, error: '标题不能为空' });

      const plainText = (blocks || []).map(function (b) {
        if (!b) return '';
        if (b.type === 'figure' || b.type === 'polaroid') return '';
        return (b.text || '');
      }).join('').replace(/\s+/g, '');
      const autoRead = Math.max(1, Math.round(plainText.length / 400));
      const givenRead = parseInt(meta.read, 10);

      const metaFull = {
        date: meta.date || new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
        tag: meta.tag || '日々',
        read: givenRead > 0 ? givenRead : autoRead,
        word: meta.word || 'ことば',
        tone: parseInt(meta.tone, 10) || 2,
        title: meta.title,
        cover: meta.cover || '',
        excerpt: meta.excerpt || ''
      };

      // 编辑已有文章
      if (editFile && /^posts[\/][\w.-]+\.html$/.test(editFile)) {
        const existing = parsePostsFull().filter(function (p) { return p.file === editFile; })[0];
        if (!existing) return sendJSON(res, 404, { ok: false, error: '在文章列表里找不到这篇' });
        metaFull.no = existing.no;
        var list0 = parsePostsFull();
        var idx0 = -1;
        for (var k = 0; k < list0.length; k++) { if (list0[k].file === editFile) idx0 = k; }
        var prevPost = idx0 > 0 ? list0[idx0 - 1] : null;
        var nextPost = idx0 >= 0 && idx0 < list0.length - 1 ? list0[idx0 + 1] : null;
        fs.writeFileSync(path.join(ROOT, editFile), renderArticle(metaFull, blocks, pagerHTML(prevPost, nextPost)), 'utf8');
        buildSitemap(); buildRobots();
        replacePostEntry(editFile, {
          slug: existing.slug, file: editFile, no: existing.no,
          title: metaFull.title, word: metaFull.word, date: metaFull.date,
          tag: metaFull.tag, tone: metaFull.tone, read: metaFull.read, cover: metaFull.cover, excerpt: metaFull.excerpt
        });
        return sendJSON(res, 200, { ok: true, file: editFile, no: existing.no, edited: true });
      }

      // 新建
      const no = nextNo();
      const slug = 'post-' + no;
      const file = slug + '.html';
      metaFull.no = no;

      var listNew = parsePostsFull();
      var olderPost = listNew.length ? listNew[0] : null;
      fs.writeFileSync(path.join(ROOT, 'posts', file), renderArticle(metaFull, blocks, pagerHTML(null, olderPost)), 'utf8');
      buildSitemap(); buildRobots();
      insertPost({
        slug: slug, file: 'posts/' + file, no: no, title: metaFull.title, word: metaFull.word,
        date: metaFull.date, tag: metaFull.tag, tone: metaFull.tone, read: metaFull.read,
        cover: metaFull.cover, excerpt: metaFull.excerpt
      });

      return sendJSON(res, 200, { ok: true, file: 'posts/' + file, no: no });
    }

    if (req.method === 'POST' && url.pathname === '/api/upload') {
      const body = JSON.parse(await readBody(req));
      const name = String(body.name || '').replace(/[^\w.\-]/g, '_');
      const data = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
      if (!name || !data) return sendJSON(res, 400, { ok: false, error: '缺少文件数据' });
      const dir = path.join(ROOT, 'assets', 'img', 'posts');
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, name);
      fs.writeFileSync(out, Buffer.from(data, 'base64'));
      return sendJSON(res, 200, { ok: true, path: 'assets/img/posts/' + name });
    }

    if (req.method === 'POST' && url.pathname === '/api/git') {
      const body = JSON.parse(await readBody(req));
      const action = body.action;
      const msg = body.message || '更新网站';
      const log = [];

      if (!GIT_BIN) GIT_BIN = findGit();
try { buildSitemap(); buildRobots(); } catch (e) {}
      if (!GIT_BIN) return sendJSON(res, 200, { ok: false, log: ['没有找到 git。请安装 Git for Windows 或 GitHub Desktop 后重试。'] });

      if (action === 'init') {
        log.push((await git(['init'])).out);
        log.push((await git(['add', '-A'])).out);
        if (await ensureGitIdentity(body.remote)) log.push('已自动配置 git 身份（提交作者）');
        log.push((await git(['commit', '-m', '初始化网站'])).out);
        if (body.remote) {
          await git(['remote', 'remove', 'origin']);
          log.push((await git(['remote', 'add', 'origin', body.remote])).out);
        }
        log.push((await git(['branch', '-M', 'main'])).out);
        const cfg = loadConfig();
        if (body.remote) { cfg.remote = body.remote; saveConfig(cfg); }
        return sendJSON(res, 200, { ok: true, log: log.filter(Boolean) });
      }

      if (action === 'sync') {
        let remote = (body.remote || '').trim();
        let token = (body.token || '').trim();

        if (remote) {
          await git(['remote', 'remove', 'origin']);
          await git(['remote', 'add', 'origin', remote]);
          const cfg = loadConfig(); cfg.remote = remote; saveConfig(cfg);
        } else {
          const cfg = loadConfig();
          remote = cfg.remote || '';
        }

        log.push((await git(['add', '-A'])).out);
        if (await ensureGitIdentity(remote)) log.push('已自动配置 git 身份（提交作者）');
        log.push((await git(['commit', '-m', msg])).out);

        // 有 token 时：临时把 remote 换成带令牌的地址，推完立刻还原，令牌不落盘
        let push;
        if (token && remote && /^https?:\/\//.test(remote)) {
          let authUrl = remote;
          try {
            const u = new URL(remote);
            authUrl = u.protocol + '//x-access-token:' + encodeURIComponent(token) + '@' + u.host + u.pathname;
          } catch (e) {}
          await git(['remote', 'set-url', 'origin', authUrl]);
          push = await git(['push', '-u', 'origin', 'HEAD']);
          await git(['remote', 'set-url', 'origin', remote]);
          log.push('（已使用访问令牌推送）');
        } else {
          push = await git(['push', '-u', 'origin', 'HEAD']);
        }

        log.push(push.out);
        const st = await gitStatus();
        return sendJSON(res, 200, { ok: push.ok, log: log.filter(Boolean), status: st });
      }

      if (action === 'pull') {
        const pull = await git(['pull', '--ff-only']);
        return sendJSON(res, 200, { ok: pull.ok, log: [pull.out] });
      }

      return sendJSON(res, 400, { ok: false, log: ['未知操作'] });
    }

    // 静态资源：文章预览、图片、CSS 等
    if (req.method === 'GET') {
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const p = path.join(ROOT, rel);
      const safe = p === ROOT || p.startsWith(ROOT + path.sep);
      if (safe && fs.existsSync(p) && fs.statSync(p).isFile()) {
        return serveStatic(res, p);
      }
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    sendJSON(res, 500, { ok: false, error: String(e && e.message || e) });
  }
});

GIT_BIN = findGit();

server.listen(PORT, '127.0.0.1', function () {
  const url = 'http://127.0.0.1:' + PORT;
  console.log('');
  console.log('  洛月 · 写作工具已启动');
  console.log('  ' + url);
  console.log('  git: ' + (GIT_BIN || '未安装'));
  console.log('');
  console.log('  关闭这个窗口即可停止工具。');
  console.log('');
  if (process.platform === 'win32') {
    exec('start "" "' + url + '"');
  }
});
