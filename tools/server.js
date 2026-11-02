'use strict';
/**
 * 洛月 · 本地写作台
 *
 *   node tools/server.js        启动（会先构建一次站点）
 *   http://127.0.0.1:4173/       看站点
 *   http://127.0.0.1:4173/admin/ 写作台
 *
 * 数据都在 content/ 里：site.json / about.json / quotes.json / posts/*.md
 * 保存后自动重建静态页，产物直接提交到仓库根目录。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile, exec, execFileSync } = require('child_process');
const deps = require('./deps');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const POSTS_DIR = path.join(CONTENT, 'posts');
const TRASH = path.join(ROOT, '_trash');
const PORT = 4173;

const buildMod = require('./build.js');

/* ---------------- 工具 ---------------- */

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let data = '';
    req.on('data', function (c) {
      data += c;
      if (data.length > 40 * 1024 * 1024) reject(new Error('请求体过大'));
    });
    req.on('end', function () { resolve(data); });
    req.on('error', reject);
  });
}

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function safeSlug(s) {
  return String(s || '').trim().toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function frontMatter(post) {
  const lines = ['---'];
  lines.push('title: ' + JSON.stringify(String(post.title || '无标题')));
  lines.push('date: ' + String(post.date || new Date().toISOString().slice(0, 10)));
  lines.push('tag: ' + JSON.stringify(String(post.tag || '杂记')));
  if (post.word) lines.push('word: ' + JSON.stringify(String(post.word)));
  lines.push('tone: ' + (Number(post.tone) || 2));
  if (post.cover) lines.push('cover: ' + JSON.stringify(String(post.cover)));
  if (post.pinned) lines.push('pinned: true');
  if (post.draft) lines.push('draft: true');
  if (post.excerpt) lines.push('excerpt: ' + JSON.stringify(String(post.excerpt)));
  lines.push('---');
  return lines.join('\n') + '\n';
}

function listPostFiles() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR).filter(function (f) { return /\.md$/i.test(f); });
}

function readPost(slug) {
  const file = path.join(POSTS_DIR, slug + '.md');
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const fm = buildMod.splitFrontMatter(raw);
  return { slug: slug, meta: fm.data, body: fm.body.replace(/^\n+/, '') };
}

function savePost(payload) {
  const meta = payload.meta || {};
  let slug = safeSlug(payload.slug || '');
  if (!slug) {
    const day = String(meta.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    slug = day;
    let n = 2;
    while (fs.existsSync(path.join(POSTS_DIR, slug + '.md'))) slug = day + '-' + (n++);
  }
  ensureDir(POSTS_DIR);
  const md = frontMatter(meta) + '\n' + String(payload.body || '').replace(/\r\n/g, '\n').trim() + '\n';
  fs.writeFileSync(path.join(POSTS_DIR, slug + '.md'), md, 'utf8');
  return slug;
}

/* ---------------- git ---------------- */

let GIT_BIN = null;

function findGit() {
  const r = deps.findGit(ROOT);
  return r.ok ? (GIT_BIN = r.bin) : null;
}

function git(args) {
  return new Promise(function (resolve) {
    if (!GIT_BIN) return resolve({ ok: false, out: '没有找到 git' });
    execFile(GIT_BIN, args, { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 }, function (err, stdout, stderr) {
      const out = ((stdout || '') + (stderr || '')).split('\n').filter(function (x) { return x.indexOf('warning:') !== 0; }).join('\n').trim();
      resolve({ ok: !err, out: out || (err ? String(err.message) : '') });
    });
  });
}

/* ---------------- 静态文件 ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

function serveFile(res, file) {
  fs.readFile(file, function (err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      const nf = path.join(ROOT, '404.html');
      return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}

function resolveStatic(urlPath) {
  let p = path.join(ROOT, decodeURIComponent(urlPath));
  if (!p.startsWith(ROOT)) return null;
  try {
    if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  } catch (e) {
    if (!path.extname(p)) p = path.join(p, 'index.html');
  }
  return p;
}

/* ---------------- 路由 ---------------- */

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = url.pathname;

  try {
    /* ---- 写作台页面 ---- */
    if (req.method === 'GET' && (p === '/admin' || p === '/admin/' || p === '/tools/editor.html')) {
      return serveFile(res, path.join(__dirname, 'editor.html'));
    }

    /* ---- 站点配置 ---- */
    if (req.method === 'GET' && p === '/api/site') {
      return sendJSON(res, 200, { ok: true, data: readJSON(path.join(CONTENT, 'site.json'), {}) });
    }
    if (req.method === 'POST' && p === '/api/site') {
      const body = JSON.parse(await readBody(req));
      writeJSON(path.join(CONTENT, 'site.json'), body.data || body);
      const r = buildMod.build({ quiet: true });
      return sendJSON(res, 200, { ok: true, posts: r.posts.length });
    }

    /* ---- 关于 / 台词 ---- */
    if (req.method === 'GET' && p === '/api/about') {
      return sendJSON(res, 200, { ok: true, data: readJSON(path.join(CONTENT, 'about.json'), {}) });
    }
    if (req.method === 'POST' && p === '/api/about') {
      const body = JSON.parse(await readBody(req));
      writeJSON(path.join(CONTENT, 'about.json'), body.data || body);
      buildMod.build({ quiet: true });
      return sendJSON(res, 200, { ok: true });
    }
    if (req.method === 'GET' && p === '/api/quotes') {
      return sendJSON(res, 200, { ok: true, data: readJSON(path.join(CONTENT, 'quotes.json'), { quotes: [] }) });
    }
    if (req.method === 'POST' && p === '/api/quotes') {
      const body = JSON.parse(await readBody(req));
      writeJSON(path.join(CONTENT, 'quotes.json'), body.data || body);
      buildMod.build({ quiet: true });
      return sendJSON(res, 200, { ok: true });
    }

    /* ---- 说说 / 相册 / 友链 ---- */
    if (p === '/api/moments' || p === '/api/gallery' || p === '/api/friends') {
      const name = p.split('/').pop();
      const file = path.join(CONTENT, name + '.json');
      const fallback = name === 'moments' ? { items: [] } : name === 'gallery' ? { albums: [] } : { list: [] };
      if (req.method === 'GET') return sendJSON(res, 200, { ok: true, data: readJSON(file, fallback) });
      if (req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        writeJSON(file, body.data || body);
        buildMod.build({ quiet: true });
        return sendJSON(res, 200, { ok: true });
      }
    }

    /* ---- 仓库配置 ---- */
    if (p === '/api/config') {
      const cfgPath = path.join(__dirname, 'config.json');
      if (req.method === 'GET') return sendJSON(res, 200, { ok: true, config: readJSON(cfgPath, {}) });
      const b = JSON.parse(await readBody(req));
      const cfg = readJSON(cfgPath, {});
      if (typeof b.remote === 'string') cfg.remote = b.remote.trim();
      if (typeof b.gitPath === 'string') cfg.gitPath = b.gitPath.trim();
      if (typeof b.siteUrl === 'string') cfg.siteUrl = b.siteUrl.trim();
      writeJSON(cfgPath, cfg);
      return sendJSON(res, 200, { ok: true, config: cfg });
    }

    /* ---- 网易云链接解析 ---- */
    if (req.method === 'POST' && p === '/api/music/parse') {
      const body = JSON.parse(await readBody(req));
      const link = String(body.url || '').trim();
      const m = link.match(/[?&#]id=(\d+)/) || link.match(/^(\d+)$/);
      if (!m) return sendJSON(res, 400, { ok: false, error: '链接里没找到歌曲 id' });
      const id = m[1];
      let name = '';
      let fee = 0;
      let artist = '';
      try {
        const r = await fetch('https://music.163.com/api/song/detail/?id=' + id + '&ids=[' + id + ']', {
          headers: { Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' }
        });
        const j = await r.json();
        const song = (j.songs && j.songs[0]) || {};
        name = song.name || '';
        fee = Number(song.fee || 0);
        artist = (song.artists && song.artists[0] && song.artists[0].name) || (song.ar && song.ar[0] && song.ar[0].name) || '';
      } catch (e) {}
      /* fee: 0 免费 / 1 VIP / 4 付费专辑 / 8 低音质免费 */
      /* fee: 0 免费 / 1 VIP / 4 付费专辑 / 8 低音质免费 */
      const vip = fee === 1 || fee === 4;
      let playable = null;
      try {
        const rr = await fetch('https://music.163.com/song/media/outer/url?id=' + id + '.mp3', {
          headers: { Range: 'bytes=0-1', Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' },
          redirect: 'follow'
        });
        const ct = String(rr.headers.get('content-type') || '').toLowerCase();
        playable = ct.indexOf('audio') === 0 || ct.indexOf('octet-stream') > -1;
      } catch (e) {}
      return sendJSON(res, 200, {
        ok: true,
        id: id,
        name: name || ('歌曲 ' + id),
        artist: artist,
        fee: fee,
        vip: vip,
        playable: playable,
        hint: playable === false ? '这首受会员/版权限制，放不出来' : (vip ? '疑似 VIP 曲目，可能只能试听' : '')
      });
    }

    /* ---- 文章 ---- */
    if (req.method === 'GET' && p === '/api/posts') {
      const posts = buildMod.loadPosts();
      return sendJSON(res, 200, {
        ok: true,
        posts: posts.map(function (x) {
          return { slug: x.slug, title: x.title, date: x.date, tag: x.tag, pinned: x.pinned, chars: x.chars, excerpt: x.excerpt, tone: x.tone, word: x.word, cover: x.cover };
        })
      });
    }
    if (req.method === 'GET' && p === '/api/post') {
      const slug = safeSlug(url.searchParams.get('slug') || '');
      const post = readPost(slug);
      if (!post) return sendJSON(res, 404, { ok: false, error: '找不到这篇' });
      return sendJSON(res, 200, { ok: true, slug: slug, meta: post.meta, body: post.body });
    }
    if (req.method === 'POST' && p === '/api/post') {
      const body = JSON.parse(await readBody(req));
      if (!body.meta || !String(body.meta.title || '').trim()) {
        return sendJSON(res, 400, { ok: false, error: '标题不能为空' });
      }
      const oldSlug = safeSlug(body.oldSlug || '');
      const slug = savePost(body);
      if (oldSlug && oldSlug !== slug) {
        const old = path.join(POSTS_DIR, oldSlug + '.md');
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      const r = buildMod.build({ quiet: true });
      return sendJSON(res, 200, { ok: true, slug: slug, url: '/posts/' + encodeURIComponent(slug) + '/', total: r.posts.length });
    }
    if (req.method === 'POST' && p === '/api/delete') {
      const body = JSON.parse(await readBody(req));
      const slug = safeSlug(body.slug || '');
      const file = path.join(POSTS_DIR, slug + '.md');
      if (!fs.existsSync(file)) return sendJSON(res, 404, { ok: false, error: '文件不存在' });
      ensureDir(TRASH);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.renameSync(file, path.join(TRASH, stamp + '__' + slug + '.md'));
      buildMod.build({ quiet: true });
      return sendJSON(res, 200, { ok: true });
    }
    if (req.method === 'GET' && p === '/api/trash') {
      ensureDir(TRASH);
      const items = fs.readdirSync(TRASH).filter(function (f) { return /\.md$/i.test(f); }).map(function (f) {
        const i = f.indexOf('__');
        return { file: f, slug: i > 0 ? f.slice(i + 2).replace(/\.md$/, '') : f.replace(/\.md$/, ''), time: i > 0 ? f.slice(0, i) : '' };
      }).sort().reverse();
      return sendJSON(res, 200, { ok: true, items: items });
    }
    if (req.method === 'POST' && p === '/api/restore') {
      const body = JSON.parse(await readBody(req));
      const f = String(body.file || '');
      if (!/^[\w.-]+\.md$/.test(f)) return sendJSON(res, 400, { ok: false, error: '文件名不合法' });
      const src = path.join(TRASH, f);
      if (!fs.existsSync(src)) return sendJSON(res, 404, { ok: false, error: '回收站里没有' });
      const i = f.indexOf('__');
      const slug = (i > 0 ? f.slice(i + 2) : f).replace(/\.md$/, '');
      ensureDir(POSTS_DIR);
      fs.renameSync(src, path.join(POSTS_DIR, slug + '.md'));
      buildMod.build({ quiet: true });
      return sendJSON(res, 200, { ok: true, slug: slug });
    }

    /* ---- 预览 ---- */
    if (req.method === 'POST' && p === '/api/preview') {
      const body = JSON.parse(await readBody(req));
      return sendJSON(res, 200, { ok: true, html: buildMod.renderBody(body.body || '') });
    }

    /* ---- 上传图片 ---- */
    if (req.method === 'POST' && p === '/api/upload') {
      const body = JSON.parse(await readBody(req));
      let name = String(body.name || '').normalize('NFC').replace(/[\\/:*?"<>|]/g, '_').replace(/[\u0000-\u001f]/g, '').trim();
      name = name.replace(/^\.+/, '') || 'image-' + Date.now() + '.jpg';
      const data = String(body.data || '').replace(/^data:[^;]+;base64,/, '');
      if (!data) return sendJSON(res, 400, { ok: false, error: '缺少文件数据' });
      const dir = path.join(ROOT, 'assets', 'img', 'posts');
      ensureDir(dir);
      const ext = path.extname(name);
      const base = path.basename(name, ext) || 'image';
      let finalName = name, n = 1;
      while (fs.existsSync(path.join(dir, finalName))) finalName = base + '-' + (n++) + ext;
      fs.writeFileSync(path.join(dir, finalName), Buffer.from(data, 'base64'));
      return sendJSON(res, 200, { ok: true, path: '/assets/img/posts/' + finalName, name: finalName });
    }

    /* ---- 构建 ---- */
    if (req.method === 'POST' && p === '/api/build') {
      const r = buildMod.build({ quiet: true });
      return sendJSON(res, 200, { ok: true, posts: r.posts.length });
    }

    /* ---- 状态 / git ---- */
    if (req.method === 'GET' && p === '/api/env') {
      const doctor = require('./doctor');
      const r = await doctor.check();
      return sendJSON(res, 200, r);
    }

    if (req.method === 'GET' && p === '/api/status') {
      if (!GIT_BIN) GIT_BIN = findGit();
      const branch = await git(['branch', '--show-current']);
      const remote = await git(['remote', 'get-url', 'origin']);
      const status = await git(['status', '--porcelain']);
      return sendJSON(res, 200, {
        ok: true, git: GIT_BIN, branch: branch.out, remote: remote.out,
        changes: status.out ? status.out.split('\n').filter(Boolean) : [],
        posts: buildMod.loadPosts().length
      });
    }
    if (req.method === 'POST' && p === '/api/git') {
      const body = JSON.parse(await readBody(req));
      const action = body.action;
      const log = [];
      if (!GIT_BIN) GIT_BIN = findGit();
      if (!GIT_BIN) return sendJSON(res, 200, { ok: false, log: ['没有找到 git，先装 Git for Windows'] });

      const remoteIn = String(body.remote || '').trim();
      const token = String(body.token || '').trim();
      if (remoteIn) {
        const cfgPath = path.join(__dirname, 'config.json');
        const cfg = readJSON(cfgPath, {});
        cfg.remote = remoteIn;
        writeJSON(cfgPath, cfg);
        await git(['remote', 'remove', 'origin']);
        await git(['remote', 'add', 'origin', remoteIn]);
        log.push('仓库地址：' + remoteIn);
      }

      if (action === 'commit') {
        buildMod.build({ quiet: true });
        log.push((await git(['add', '-A'])).out);
        log.push((await git(['commit', '-m', body.message || '更新网站'])).out);
        return sendJSON(res, 200, { ok: true, log: log.filter(Boolean) });
      }
      if (action === 'push') {
        const push = await git(['push', '-u', 'origin', 'HEAD']);
        return sendJSON(res, 200, { ok: push.ok, log: [push.out].filter(Boolean) });
      }
      if (action === 'pull') {
        const pull = await git(['pull', '--ff-only']);
        return sendJSON(res, 200, { ok: pull.ok, log: [pull.out].filter(Boolean) });
      }
      if (action === 'sync') {
        buildMod.build({ quiet: true });
        log.push((await git(['add', '-A'])).out);
        log.push((await git(['commit', '-m', body.message || '更新网站'])).out);
        let push;
        const cur = (await git(['remote', 'get-url', 'origin'])).out;
        if (token && /^https?:/.test(cur)) {
          let authUrl = cur;
          try {
            const u = new URL(cur);
            authUrl = u.protocol + '//x-access-token:' + encodeURIComponent(token) + '@' + u.host + u.pathname;
          } catch (e) {}
          await git(['remote', 'set-url', 'origin', authUrl]);
          push = await git(['push', '-u', 'origin', 'HEAD']);
          await git(['remote', 'set-url', 'origin', cur]);
        } else {
          push = await git(['push', '-u', 'origin', 'HEAD']);
        }
        log.push(push.out);
        return sendJSON(res, 200, { ok: push.ok, log: log.filter(Boolean), hint: push.ok ? '' : '推送失败：检查仓库地址 / 令牌，或改用 SSH（tools/git-ssh-setup.bat）' });
      }
      return sendJSON(res, 400, { ok: false, log: ['未知操作'] });
    }

    if (req.method === 'POST' && p === '/api/shutdown') {
      sendJSON(res, 200, { ok: true });
      setTimeout(function () { process.exit(0); }, 200);
      return;
    }

    /* ---- 静态 ---- */
    if (req.method === 'GET') {
      const file = resolveStatic(p);
      if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return serveFile(res, file);
    }

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    const nf = path.join(ROOT, '404.html');
    res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
  } catch (e) {
    sendJSON(res, 500, { ok: false, error: String(e && e.message || e) });
  }
});

/* ---------------- 启动 ---------------- */

try {
  const r = buildMod.build({ quiet: true });
  console.log('  构建完成：' + r.posts.length + ' 篇文章');
} catch (e) {
  console.error('  构建失败：' + e.message);
}

GIT_BIN = findGit();

server.listen(PORT, '127.0.0.1', function () {
  const base = 'http://127.0.0.1:' + PORT;
  console.log('');
  console.log('  洛月 · 写作台已启动');
  console.log('  站点   ' + base + '/');
  console.log('  写作台 ' + base + '/admin/');
  console.log('  git    ' + (GIT_BIN || '未安装'));
  console.log('');
  if (process.platform === 'win32') exec('start "" "' + base + '/admin/"');
});
