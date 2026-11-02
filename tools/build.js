'use strict';
/**
 * 洛月 · 静态站生成器（零依赖）
 *
 *   content/site.json      全站配置（导航、文案、看板娘、音乐、开关）
 *   content/about.json     关于页
 *   content/quotes.json    台词
 *   content/moments.json   说说
 *   content/gallery.json   相册
 *   content/friends.json   友链
 *   content/posts/*.md     文章
 *
 * 输出：/ /posts/ /posts/<slug>/ /archive/ /moments/ /gallery/ /gallery/<album>/
 *       /quotes/ /friends/ /about/ /404.html /sitemap.xml /robots.txt
 *
 * 用法：node tools/build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');

/* ============================ 小工具 ============================ */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}
function readText(p, fallback) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return fallback; } }
function writeFile(rel, html) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html, 'utf8');
}

/* ============================ front matter ============================ */

function splitFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  m[1].split(/\r?\n/).forEach(function (line) {
    const i = line.indexOf(':');
    if (i < 0) return;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v[0] === '"' && v.slice(-1) === '"') || (v[0] === "'" && v.slice(-1) === "'")) v = v.slice(1, -1);
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    data[k] = v;
  });
  return { data: data, body: raw.slice(m[0].length) };
}

/* ============================ markdown ============================ */

function escInline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
}

function mdToHtml(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^```(\w*)/);
    if (fence) {
      const lang = fence[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push('<pre><code' + (lang ? ' data-lang="' + esc(lang) + '"' : '') + '>' + esc(buf.join('\n')) + '</code></pre>');
      continue;
    }

    const custom = line.match(/^:::\s*([a-z-]+)\s*$/);
    if (custom) {
      const type = custom[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      if (type === 'dialogue') {
        out.push('<div class="dialogue">' + buf.filter(Boolean).map(function (t) {
          return escInline(t.trim());
        }).join('<br>') + '</div>');
      } else if (type === 'note') {
        out.push('<div class="note">' + buf.map(function (t) { return escInline(t.trim()); }).join('<br>') + '</div>');
      } else if (type === 'quote') {
        out.push('<blockquote>' + buf.map(function (t) { return escInline(t.trim()); }).join('<br>') + '</blockquote>');
      } else if (type === 'figure' || type === 'polaroid') {
        const imgLine = buf.find(function (t) { return /!\[/.test(t); }) || '';
        const cap = buf.filter(function (t) { return t.trim() && !/!\[/.test(t); }).join(' ').trim();
        const im = imgLine.match(/!\[([^\]]*)\]\(([^)\s]+)\)/);
        if (im) {
          out.push('<figure' + (type === 'polaroid' ? ' class="polaroid"' : '') + '>' +
            '<img src="' + esc(im[2]) + '" alt="' + esc(im[1]) + '">' +
            (cap ? '<figcaption>' + escInline(cap) + '</figcaption>' : '') + '</figure>');
        }
      } else {
        out.push('<div class="note">' + buf.map(function (t) { return escInline(t.trim()); }).join('<br>') + '</div>');
      }
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = Math.min(3, Math.max(2, h[1].length));
      out.push('<h' + level + '>' + escInline(h[2].trim()) + '</h' + level + '>');
      i++;
      continue;
    }

    if (/^(\*\s*){3,}$|^(-\s*){3,}$/.test(line.trim())) { out.push('<hr>'); i++; continue; }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push('<blockquote>' + buf.map(escInline).join('<br>') + '</blockquote>');
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && (/^[-*]\s+/.test(lines[i]) || /^\d+\.\s+/.test(lines[i]))) {
        items.push(lines[i++].replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
      }
      out.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.map(function (t) {
        return '<li>' + escInline(t) + '</li>';
      }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>');
      continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() &&
      !/^(#{1,4}\s|```|:::|>\s?|[-*]\s|\d+\.\s)/.test(lines[i])) {
      buf.push(lines[i++].trim());
    }
    const text = buf.join(' ');
    const onlyImg = text.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (onlyImg) {
      out.push('<figure><img src="' + esc(onlyImg[2]) + '" alt="' + esc(onlyImg[1]) + '">' +
        (onlyImg[1] ? '<figcaption>' + esc(onlyImg[1]) + '</figcaption>' : '') + '</figure>');
    } else {
      out.push('<p>' + escInline(text) + '</p>');
    }
  }

  return out.join('\n');
}

/** 首字下沉遇到引号会难看，这类段落跳过 */
function renderBody(md) {
  let html = mdToHtml(md);
  const m = html.match(/^<p>([\s\S])/);
  if (m && /[「『（(《“"‘]/.test(m[1])) html = '<p class="no-drop">' + html.slice(3);
  return html;
}

/* ============================ 图标 ============================ */

const ICON = {
  sun: '<svg class="ic-sun" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M18.5 5.5L17 7M7 17l-1.5 1.5"/></svg>',
  moon: '<svg class="ic-moon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.6A8 8 0 0 1 9.4 4 8.2 8.2 0 1 0 20 14.6z"/></svg>',
  note: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
  github: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.05c-3.2.7-3.88-1.4-3.88-1.4-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/></svg>',
  bilibili: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7.5" width="18" height="12" rx="3"/><path d="M7.5 4l2.5 3M16.5 4L14 7"/></svg>',
  email: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M4 7.5l8 5.5 8-5.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11 6.3"/><path d="M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7L13 17.7"/></svg>',
  volume: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.2L12 18V6L7.2 9.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>'
};

/* ============================ 数据 ============================ */

function loadSite() {
  const s = readJSON(path.join(CONTENT, 'site.json'), {});
  s.base = s.base || '';
  s.nav = s.nav || [];
  return s;
}

function loadPosts() {
  const dir = path.join(CONTENT, 'posts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(function (f) { return /\.md$/i.test(f); })
    .map(function (f) {
      const raw = readText(path.join(dir, f), '');
      const fm = splitFrontMatter(raw);
      const d = fm.data || {};
      const slug = f.replace(/\.md$/i, '');
      const text = fm.body.replace(/```[\s\S]*?```/g, '').replace(/:::\w*/g, '').replace(/[#>*`\-]/g, '');
      return {
        slug: slug, file: f,
        title: d.title || slug,
        date: d.date || '1970-01-01',
        tag: d.tag || '杂记',
        word: d.word || '',
        tone: Number(d.tone) || 2,
        cover: d.cover || '',
        excerpt: d.excerpt || text.trim().slice(0, 70),
        pinned: d.pinned === true,
        draft: d.draft === true,
        body: fm.body,
        chars: text.replace(/\s/g, '').length
      };
    })
    .filter(function (p) { return !p.draft; })
    .sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
}

function loadMoments() {
  const d = readJSON(path.join(CONTENT, 'moments.json'), { items: [] });
  return (d.items || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
}

function loadGallery() {
  const d = readJSON(path.join(CONTENT, 'gallery.json'), { albums: [] });
  return d.albums || [];
}

function loadFriends() {
  return readJSON(path.join(CONTENT, 'friends.json'), { list: [] });
}

function dateLabel(iso) { return String(iso || '').replace(/-/g, '.'); }
function readMinutes(n) { return Math.max(1, Math.round(n / 400)); }

/* ============================ 公共片段 ============================ */

function u(site, p) { return site.base + p; }

function themeBoot() {
  return '<script>(function(){try{var q=new URLSearchParams(location.search).get("theme");' +
    'if(q==="dark"||q==="light"){document.documentElement.setAttribute("data-theme",q);return;}' +
    'if(localStorage.getItem("sb-theme")==="dark"){document.documentElement.setAttribute("data-theme","dark");}' +
    '}catch(e){}})();</script>';
}

function navHTML(site, current) {
  return (site.nav || []).map(function (n) {
    return '<a href="' + u(site, n.href) + '"' + (n.key === current ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>';
  }).join('');
}

function topbar(site, current) {
  const avatar = site.avatar || '/assets/img/avatar.svg';
  return '' +
    '<header class="nav">\n' +
    '  <div class="nav-in">\n' +
    '    <div class="brand">\n' +
    '      <a class="brand-avatar-link" href="' + u(site, '/about/') + '" aria-label="关于我" title="关于我">' +
    '<img class="brand-avatar" src="' + u(site, avatar) + '" alt="头像"></a>\n' +
    '      <a class="brand-name" href="' + u(site, '/') + '"><b>' + esc(site.brand.name) + '</b><i>' + esc(site.brand.latin) + '</i></a>\n' +
    '    </div>\n' +
    '    <nav class="menu" id="menu" aria-label="主导航">' + navHTML(site, current) + '</nav>\n' +
    '    <div class="nav-tools">\n' +
    '      <button class="tgl" type="button" data-theme-toggle aria-label="切换昼夜" title="切换昼夜">' + ICON.sun + ICON.moon + '</button>\n' +
    '      <button class="nav-toggle" type="button" aria-expanded="false" aria-label="打开菜单"><span></span><span></span><span></span></button>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</header>\n';
}

function footer(site) {
  const f = site.footer || {};
  const about = readJSON(path.join(CONTENT, 'about.json'), {});
  return '' +
    '<footer class="site-foot">\n  <div class="wrap">\n' +
    '    <div class="foot-inner">\n' +
    '      <div class="foot-brand">\n' +
    '        <p class="jp">' + esc(site.brand.name) + '</p>\n' +
    '        <p class="note">' + esc(f.note1 || '') + '<br>' + esc(f.note2 || '') + '</p>\n' +
    '      </div>\n' +
    '      <nav class="foot-nav" aria-label="页脚导航">' + navHTML(site, '') + '</nav>\n' +
    '      <p class="foot-tag" aria-hidden="true">' + esc(f.tag || '') + '</p>\n' +
    '    </div>\n' +
    '    <div class="foot-copy">\n' +
    '      <span>© <span data-year>2026</span> ' + esc(about.name || '') + ' · ' + esc(f.copyright || '') + '</span>\n' +
    '      <span>已运行 <b data-since="' + esc(site.since || '') + '">0</b> 天 · ' + esc(f.meta || '') + '</span>\n' +
    '    </div>\n' +
    '  </div>\n</footer>\n';
}

function loader(site) {
  if (!site.features || site.features.loader === false) return '';
  return '' +
    '<div class="loader" id="loader" role="status" aria-live="polite">\n' +
    '  <div class="loader-grid" aria-hidden="true"></div>\n' +
    '  <div class="loader-inner">\n' +
    '    <svg class="loader-flower" viewBox="0 0 40 40" aria-hidden="true"><path d="M27.8 4.2a15.2 15.2 0 1 0 8.1 26.1A12.4 12.4 0 0 1 27.8 4.2z" fill="currentColor"/></svg>\n' +
    '    <p class="loader-word">' + esc(site.brand.name) + '</p>\n' +
    '    <p class="loader-sub">' + esc(site.brand.jp) + '</p>\n' +
    '    <div class="loader-bar"><span id="loaderBar"></span></div>\n' +
    '    <div class="loader-meta"><span id="loaderStatus">connecting</span><span class="loader-pct"><b id="loaderPct">0</b>%</span></div>\n' +
    '  </div>\n</div>\n';
}

function musicDock(site) {
  const m = site.music || {};
  if (!site.features || site.features.music === false || !m.songs || !m.songs.length) return '';
  const list = m.songs.map(function (song, i) {
    const bad = song && song.ok === false;
    return '<button type="button" class="music-item' + (i === 0 ? ' is-on' : '') + '" data-id="' + esc(song.id) + '" data-name="' + esc(song.name || song.id) + '"' + (bad ? ' data-ok="0"' : '') + '>' + esc(song.name || song.id) + (bad ? ' ⚠' : '') + '</button>';
  }).join('');
  const vol = typeof m.volume === 'number' ? m.volume : 0.3;
  return '' +
    '<div class="music-dock" id="music-dock" data-volume="' + vol + '"' + (m.autoplay === false ? ' data-autoplay="0"' : ' data-autoplay="1"') + '>' +
    '<button type="button" class="music-fab" id="music-fab" aria-label="音乐播放器" aria-expanded="false">' + ICON.note + '</button>' +
    '<div class="music-panel" id="music-panel">' +
    '<button type="button" class="music-close" id="music-close" aria-label="收起">×</button>' +
    '<p class="music-title">' + esc(m.title || 'Playlist') + '</p>' +
    '<p class="music-now" id="music-now">' + esc((m.songs[0] || {}).name || '') + '</p>' +
    '<div class="music-progress">' +
    '<span id="music-cur">0:00</span>' +
    '<input type="range" id="music-seek" min="0" max="1000" value="0" aria-label="播放进度">' +
    '<span id="music-dur">0:00</span>' +
    '</div>' +
    '<div class="music-ctrl">' +
    '<button type="button" id="music-prev" aria-label="上一首">⏮</button>' +
    '<button type="button" class="play" id="music-play" aria-label="播放">▶</button>' +
    '<button type="button" id="music-next" aria-label="下一首">⏭</button>' +
    '<button type="button" class="music-vol-btn" id="music-vol-btn" aria-label="音量" title="音量">' + ICON.volume + '</button>' +
    '<button type="button" class="music-list-toggle" id="music-list-toggle" aria-label="播放列表">≡</button>' +
    '</div>' +
    '<div class="music-vol-row" id="music-vol-row">' +
    '<input type="range" id="music-vol" min="0" max="100" value="' + Math.round(vol * 100) + '" aria-label="音量">' +
    '<span id="music-vol-num">' + Math.round(vol * 100) + '%' + '</span>' +
    '</div>' +
    '<div class="music-list" id="music-list">' + list + '</div>' +
    '<audio id="music-audio" preload="none"></audio>' +
    '</div></div>';
}

function toTop(site) {
  if (!site.features || site.features.toTop === false) return '';
  return '<a class="to-top" id="to-top" href="#main" aria-label="回到顶部" title="回到顶部">' + ICON.up + '</a>\n';
}

function clickFx(site) {
  if (!site.features || site.features.clickEffect === false) return '';
  return '<div class="click-fx" id="click-fx" aria-hidden="true"></div>\n';
}

/* ============================ 布局 ============================ */

function layout(site, opts) {
  const o = opts || {};
  const url = site.url + (o.path || '/');
  const desc = o.desc || site.description;
  return '<!DOCTYPE html>\n' +
    '<html lang="' + esc(site.lang || 'zh-CN') + '" data-theme="light">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(o.title) + '</title>\n' +
    '<meta name="description" content="' + esc(desc) + '">\n' +
    '<meta name="theme-color" content="#F5EDE6">\n' +
    '<link rel="canonical" href="' + esc(url) + '">\n' +
    '<meta property="og:type" content="' + (o.type || 'website') + '">\n' +
    '<meta property="og:title" content="' + esc(o.title) + '">\n' +
    '<meta property="og:description" content="' + esc(desc) + '">\n' +
    '<meta property="og:url" content="' + esc(url) + '">\n' +
    '<link rel="icon" type="image/svg+xml" href="' + u(site, '/assets/img/favicon.svg') + '">\n' +
    themeBoot() + '\n' +
    '<link rel="stylesheet" href="' + u(site, '/assets/css/style.css') + '">\n' +
    '</head>\n<body class="is-loading">\n\n' +
    '<a class="skip-link" href="#main">跳到正文</a>\n\n' +
    '<div class="atmo" aria-hidden="true"><i></i><i></i><i></i><b></b></div>\n' +
    loader(site) +
    '<div class="wrap">\n' + topbar(site, o.current) +
    '\n<main id="main">\n' + (o.content || '') + '\n</main>\n' +
    footer(site) + '</div>\n' +
    musicDock(site) + toTop(site) + clickFx(site) +
    '<script src="' + u(site, '/assets/js/main.js') + '" defer></script>\n' +
    '</body>\n</html>\n';
}

/* ============================ 卡片片段 ============================ */

function postUrl(site, p) { return u(site, '/posts/' + p.slug + '/'); }
function coverBg(p) {
  return p.cover ? ' style="background-image:url(' + "'" + esc(p.cover) + "'" + ')"' : '';
}
function tagChip(t) { return '<span class="tag-chip">' + esc(t) + '</span>'; }

function rowHTML(site, p, from) {
  const day = String(p.date).slice(8, 10) || '';
  return '<a class="row" href="' + postUrl(site, p) + (from ? '?from=' + from : '') + '" data-tag="' + esc(p.tag) + '">' +
    '<span class="no">' + esc(day) + '</span>' +
    '<span><h3>' + esc(p.title) + (p.pinned ? '<span class="pin-mark">置顶</span>' : '') + '</h3>' +
    '<p>' + esc(p.excerpt) + '</p></span>' +
    '<span class="meta">' + esc(dateLabel(p.date)) + ' ' + tagChip(p.tag) + '</span>' +
    '<span class="arw" aria-hidden="true">→</span></a>';
}

/* ============================ 页面 ============================ */

function inferIcon(l) {
  const k = String(l.icon || '').toLowerCase();
  if (k) return k;
  const url = String(l.url || '').toLowerCase();
  if (url.indexOf('github.com') > -1) return 'github';
  if (url.indexOf('bilibili.com') > -1 || url.indexOf('b23.tv') > -1) return 'bilibili';
  if (url.indexOf('mailto:') === 0 || url.indexOf('@') > -1 && url.indexOf('http') < 0) return 'email';
  return 'link';
}
function linkPills(list) {
  return (list || []).map(function (l) {
    const k = inferIcon(l);
    if (k === 'email') {
      const addr = String(l.url || '').replace(/^mailto:/i, '');
      return '<button type="button" class="pill" data-copy="' + esc(addr) + '">' + ICON.email + '<span>' + esc(addr) + '</span></button>';
    }
    const name = k === 'github' ? 'github' : k === 'bilibili' ? 'bilibili' : 'link';
    return '<a class="pill" href="' + esc(l.url) + '">' + ICON[name] + '<span>' + esc(l.label) + '</span></a>';
  }).join('');
}

function homePage(site, posts) {
  const moments = loadMoments();
  const albums = loadGallery();
  const photos = albums.reduce(function (n, a) { return n + (a.images || []).length; }, 0);
  const hero = site.hero || {};
  const day = (site.characters || {}).day || {};
  const night = (site.characters || {}).night || {};
  const about = readJSON(path.join(CONTENT, 'about.json'), {});
  const links = linkPills(about.links);
  const chars = posts.reduce(function (n, p) { return n + p.chars; }, 0);
  const tags = posts.map(function (p) { return p.tag; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).length;
  const rows = posts.slice(0, 5).map(function (p) { return rowHTML(site, p, 'home'); }).join('');

  return layout(site, {
    title: site.title, desc: site.description, path: '/', current: 'home',
    content: '' +
      '<section class="hero">\n' +
      '  <div class="hero-copy">\n' +
      '    <p class="kicker"><i></i><span>' + esc(site.brand.jp) + ' / ' + esc(site.brand.latin) + '</span></p>\n' +
      '    <h1 class="hero-title">' + esc(hero.title1 || '') + '<br><em>' + esc(hero.title2 || '') + '</em></h1>\n' +
      '    <p class="hero-lead">' + esc(hero.lead1 || '') + '<br>' + esc(hero.lead2 || '') + '</p>\n' +
      '    <div class="hero-actions"><a class="btn" href="' + u(site, (hero.primary || {}).href || '/posts/') + '">' +
      esc((hero.primary || {}).label || '开始阅读') + '<span class="arw" aria-hidden="true">→</span></a></div>\n' +
      '    <ul class="hero-stats"><li><b>' + posts.length + '</b><span>文章</span></li>' +
      '      <li><b>' + moments.length + '</b><span>说说</span></li><li><b>' + photos + '</b><span>照片</span></li></ul>\n' +
      '    <div class="hero-links">' + links + '</div>\n' +
      '    <p class="hero-hint">' + esc(hero.hint || '') + '</p>\n' +
      '    <p class="moon-note"><span class="note-day">' + esc(hero.noteDay || '') + '</span>' +
      '<span class="note-night">' + esc(hero.noteNight || '') + '</span></p>\n' +
      '  </div>\n' +
      '  <div class="hero-figure">' + charBlock(site, 'day', day) + charBlock(site, 'night', night) + '</div>\n' +
      '</section>\n' +
      '<section class="sec"><div class="sec-head"><span class="n">01</span><h2>最近的文章</h2>' +
      '<a href="' + u(site, '/posts/') + '">全部文章 →</a></div>' +
      '<div class="rows">' + (rows || '<div class="empty"><b>还没有文章</b>写下第一篇，这里就会出现。</div>') + '</div></section>\n' +
      '<section class="entries">' + (site.shortcuts || []).map(function (s, i) {
        return '<a class="entry" href="' + u(site, s.href) + '"><span class="n">' + ('0' + (i + 1)).slice(-2) + ' / ' + esc(s.title) + '</span>' +
          '<h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p><span class="go">进入 →</span></a>';
      }).join('') + '</section>\n' +
      '<section class="quote"><div><div class="jp">' + esc((site.teaser || {}).quoteJp || '') + '</div>' +
      '<div class="cn">' + esc((site.teaser || {}).quoteCn || '') + '</div></div>' +
      '<div class="by">' + esc((site.teaser || {}).quoteBy || '') + '</div></section>\n'
  });
}

function charBlock(site, kind, c) {
  if (!c || !c.img) return '';
  return '<div class="hero-char hero-char--' + kind + '">' +
    '<img src="' + u(site, c.img) + '" alt="看板娘：' + esc(c.name) + '" width="' + (c.width || 1200) + '" height="' + (c.height || 1600) + '" loading="eager">' +
    '<div class="nameplate"><b>' + esc(c.name) + '</b><span>' + esc(c.sub) + ' · ' + esc(c.role) + '</span></div></div>';
}

function postsPage(site, posts) {
  const pg = (site.pages || {}).posts || {};
  const tags = ['全部'].concat(posts.map(function (p) { return p.tag; })
    .filter(function (t, i, a) { return a.indexOf(t) === i; }));
  return layout(site, {
    title: '文章 ｜ ' + site.brand.name, desc: pg.lead || site.description,
    path: '/posts/', current: 'posts',
    content: '' +
      '<section class="page-head"><div class="wrap">\n' +
      '  <p class="kicker"><i></i><span>' + esc(pg.kicker || 'アーカイブ') + ' / Archive</span></p>\n' +
      '  <h1 class="page-title">' + esc(pg.title || '全部文章') + '</h1>\n' +
      '  <p class="page-lead">' + esc(pg.lead || '') + '</p>\n' +
      '  <div class="post-search"><input id="post-search" type="search" placeholder="搜索标题、摘要、分类…" aria-label="搜索文章"><span class="post-search-count" id="post-search-count"></span></div>\n' +
      '  <div class="filter-bar" id="post-filters">' + tags.map(function (t, i) {
        return '<button type="button" class="filter' + (i === 0 ? ' is-active' : '') + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>\n' +
      '</div></section>\n' +
      '<div class="post-wrap"><div class="post-grid" id="post-list">' +
      posts.map(function (p) {
        return '<article class="post-item" data-tag="' + esc(p.tag) + '">' + rowHTML(site, p, 'posts') + '</article>';
      }).join('') +
      '</div><p class="post-empty" id="post-empty">没有找到匹配的文章。</p></div>\n'
  });
}

function postPage(site, post, prev, next) {
  const mins = readMinutes(post.chars);
  const pager = (prev || next)
    ? '<nav class="pager" aria-label="上下篇">' +
      (prev ? '<a href="' + postUrl(site, prev) + '"><span>NEWER</span><b>' + esc(prev.title) + '</b><i class="arw" aria-hidden="true">→</i></a>' : '') +
      (next ? '<a class="next" href="' + postUrl(site, next) + '"><span>OLDER</span><b>' + esc(next.title) + '</b><i class="arw" aria-hidden="true">←</i></a>' : '') +
      '</nav>'
    : '';
  const cover = post.cover
    ? '<img src="' + esc(post.cover) + '" alt="">'
    : '<span class="cover-ph cover-' + (post.tone || 2) + '"></span>';

  return layout(site, {
    title: post.title + ' ｜ ' + site.brand.name, desc: post.excerpt,
    path: '/posts/' + post.slug + '/', current: 'posts', type: 'article',
    content: '' +
      '<article>\n' +
      '  <div class="article-top"><a class="pill-btn back-inline" href="' + u(site, '/posts/') + '" data-back>← 返回文章列表</a></div>\n' +
      '  <div class="cover">' + cover + '<span class="jp">' + esc(post.word) + '</span></div>\n' +
      '  <header class="article-head">\n' +
      '    <p class="kicker">' + tagChip(post.tag) + '<span>' + esc(dateLabel(post.date)) + '</span><span>' + mins + ' min</span>' +
      (post.pinned ? '<span class="pin-mark">置顶</span>' : '') + '</p>\n' +
      '    <h1 class="article-title">' + esc(post.title) + '</h1>\n' +
      '  </header>\n' +
      '  <div class="article">\n' +
      '    <div class="prose">\n\n' + renderBody(post.body) + '\n\n    </div>\n' +
      '    <aside class="rail">\n' +
      '      <div class="panel"><dl>' +
      '<div><dt>发布于</dt><dd>' + esc(dateLabel(post.date)) + '</dd></div>' +
      '<div><dt>分类</dt><dd>' + esc(post.tag) + '</dd></div>' +
      '<div><dt>阅读</dt><dd>约 ' + mins + ' 分钟</dd></div>' +
      '</dl></div>\n' +
      '      <div class="panel toc" id="toc-panel"><p class="toc-title">目录</p><div id="toc"></div>' +
      '<div class="progress" aria-hidden="true"><i id="read-bar"></i></div></div>\n' +
      '    </aside>\n' +
      '  </div>\n' +
      '  <a class="pill-btn back-float" href="' + u(site, '/posts/') + '" data-back aria-label="返回文章列表">← 返回文章列表</a>\n' +
      '  ' + pager + '\n' +
      '</article>\n'
  });
}

function archivePage(site, posts) {
  const pg = (site.pages || {}).archive || {};
  const sorted = posts.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  const byYear = {};
  sorted.forEach(function (p) {
    const y = String(p.date).slice(0, 4) || '未标年份';
    (byYear[y] = byYear[y] || []).push(p);
  });
  const years = Object.keys(byYear).sort().reverse();
  const body = years.map(function (y) {
    return '<section class="tl-year"><span>' + esc(y) + '</span></section>' +
      byYear[y].map(function (p) {
        const img = p.cover ? '<img src="' + esc(p.cover) + '" alt="">' : '';
        return '<a class="tl-item" href="' + postUrl(site, p) + '?from=archive"><div class="tl-card">' + img +
          '<p class="tl-date">' + esc(dateLabel(p.date)) + ' · ' + esc(p.tag) + '</p>' +
          '<p class="tl-title">' + esc(p.title) + '</p>' +
          '<p class="tl-ex">' + esc(p.excerpt) + '</p></div></a>';
      }).join('');
  }).join('');

  return layout(site, {
    title: '归档 ｜ ' + site.brand.name, desc: pg.lead || '', path: '/archive/', current: 'archive',
    content: '' +
      '<section class="page-head"><div class="wrap">\n' +
      '  <p class="kicker"><i></i><span>' + esc(pg.kicker || 'ねんぴょう') + ' / Timeline</span></p>\n' +
      '  <h1 class="page-title">' + esc(pg.title || '文章归档') + '</h1>\n' +
      '  <p class="page-lead">' + esc(pg.lead || '') + '</p>\n' +
      '</div></section>\n' +
      '<div class="timeline">' + (body || '<div class="empty"><b>还没有文章</b></div>') + '</div>\n'
  });
}

function momentsPage(site, items) {
  const pg = (site.pages || {}).moments || {};
  const body = items.map(function (m) {
    const imgs = (m.images || []).length
      ? '<div class="imgs">' + m.images.map(function (src) {
        return '<img src="' + esc(typeof src === 'string' ? src : src.src) + '" alt="" data-zoom>';
      }).join('') + '</div>'
      : '';
    const text = esc(m.text).split('\n').join('<br>');
    return '<article class="moment">' +
      '<img class="ava" src="' + u(site, site.avatar || '/assets/img/avatar.svg') + '" alt="' + esc(site.brand.name) + '">' +
      '<time>' + esc(dateLabel(m.date)) + '</time>' +
      '<div><p>' + text + '</p>' + imgs + '</div></article>';
  }).join('');
  return layout(site, {
    title: '说说 ｜ ' + site.brand.name, desc: pg.lead || '', path: '/moments/', current: 'moments',
    content: '' +
      '<section class="page-head"><div class="wrap">\n' +
      '  <p class="kicker"><i></i><span>' + esc(pg.kicker || 'つぶやき') + ' / Moments</span></p>\n' +
      '  <h1 class="page-title">' + esc(pg.title || '说说') + '</h1>\n' +
      '  <p class="page-lead">' + esc(pg.lead || '') + '</p>\n' +
      '</div></section>\n' +
      '<div class="moments">' + (body || '<div class="empty"><b>还没有说说</b>想说什么就写在这。</div>') + '</div>\n'
  });
}

function galleryPage(site, albums) {
  const pg = (site.pages || {}).gallery || {};
  const body = albums.map(function (a) {
    return '<a class="album" href="' + u(site, '/gallery/' + a.slug + '/') + '">' +
      '<img src="' + u(site, a.cover || ((a.images || [])[0] || {}).src || '/assets/img/feature-cover.jpg') + '" alt="">' +
      '<span class="album-info"><b>' + esc(a.title) + '</b><span>' + esc(dateLabel(a.date)) + ' · ' + (a.images || []).length + ' 张</span></span></a>';
  }).join('');
  return layout(site, {
    title: '相册 ｜ ' + site.brand.name, desc: pg.lead || '', path: '/gallery/', current: 'gallery',
    content: '' +
      '<section class="page-head"><div class="wrap">\n' +
      '  <p class="kicker"><i></i><span>' + esc(pg.kicker || 'アルバム') + ' / Albums</span></p>\n' +
      '  <h1 class="page-title">' + esc(pg.title || '相册') + '</h1>\n' +
      '  <p class="page-lead">' + esc(pg.lead || '') + '</p>\n' +
      '</div></section>\n' +
      '<div class="albums">' + (body || '<div class="empty"><b>还没有相册</b>在写作台里建一个。</div>') + '</div>\n'
  });
}

function albumPage(site, a) {
  const shots = (a.images || []).map(function (im) {
    const src = typeof im === 'string' ? im : im.src;
    const cap = typeof im === 'string' ? '' : (im.caption || '');
    return '<figure class="shot"><img src="' + esc(src) + '" alt="' + esc(cap) + '" loading="lazy" data-zoom>' +
      (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') + '</figure>';
  }).join('');
  return layout(site, {
    title: a.title + ' ｜ ' + site.brand.name, desc: a.desc || '', path: '/gallery/' + a.slug + '/', current: 'gallery',
    content: '' +
      '<section class="page-head"><div class="wrap">\n' +
      '  <p class="kicker"><i></i><span>' + esc(dateLabel(a.date)) + ' / Album</span></p>\n' +
      '  <h1 class="page-title">' + esc(a.title) + '</h1>\n' +
      '  <p class="page-lead">' + esc(a.desc || '') + '</p>\n' +
      '  <p style="margin-top:18px"><a class="pill-btn" href="' + u(site, '/gallery/') + '">← 全部相册</a></p>\n' +
      '</div></section>\n' +
      '<div class="gallery-grid">' + (shots || '<div class="empty"><b>这个相册还是空的</b></div>') + '</div>\n'
  });
}

function quotesPage(site) {
  const pg = (site.pages || {}).quotes || {};
  const list = readJSON(path.join(CONTENT, 'quotes.json'), { quotes: [] }).quotes || [];
  return layout(site, {
    title: '台词 ｜ ' + site.brand.name, desc: pg.lead || '', path: '/quotes/', current: 'quotes',
    content: '' +
      '<section class="page-head"><div class="wrap">\n' +
      '  <p class="kicker"><i></i><span>' + esc(pg.kicker || 'ことば') + ' / Quotes</span></p>\n' +
      '  <h1 class="page-title">' + esc(pg.title || '台词收藏') + '</h1>\n' +
      '  <p class="page-lead">' + esc(pg.lead || '') + '</p>\n' +
      '</div></section>\n' +
      '<div class="quote-grid">' + (list.length ? list.map(function (q) {
        return '<figure class="quote-card"><blockquote>' + esc(q.text) + '</blockquote>' +
          (q.from ? '<figcaption>' + esc(q.from) + '</figcaption>' : '') + '</figure>';
      }).join('') : '<div class="empty"><b>还没有收藏</b>在写作台里加几句。</div>') + '</div>\n'
  });
}

function friendsPage(site) {
  const pg = (site.pages || {}).friends || {};
  const f = loadFriends();
  const list = f.list || [];
  const cards = list.map(function (x) {
    return '<a class="friend" href="' + esc(x.url) + '" target="_blank" rel="noopener">' +
      '<img src="' + esc(x.avatar || '/assets/img/avatar.svg') + '" alt="">' +
      '<span><b>' + esc(x.name) + '</b><span>' + esc(x.desc || '') + '</span></span></a>';
  }).join('');
  return layout(site, {
    title: '友链 ｜ ' + site.brand.name, desc: pg.lead || '', path: '/friends/', current: 'friends',
    content: '' +
      '<section class="page-head"><div class="wrap">\n' +
      '  <p class="kicker"><i></i><span>' + esc(pg.kicker || 'リンク') + ' / Links</span></p>\n' +
      '  <h1 class="page-title">' + esc(pg.title || '友链') + '</h1>\n' +
      '  <p class="page-lead">' + esc(pg.lead || '') + '</p>\n' +
      '</div></section>\n' +
      '<div class="wrap">' +
      (cards ? '<div class="friends">' + cards + '</div>' : '<div class="empty" style="margin:36px 0 20px"><b>还没有友链</b>' + esc(f.emptyText || '') + '</div>') +
      (f.applyText ? '<p class="friends-note">' + esc(f.applyText) + '</p>' : '') +
      '</div>\n'
  });
}

function aboutPage(site) {
  const pg = (site.pages || {}).about || {};
  const d = readJSON(path.join(CONTENT, 'about.json'), {});
  const facts = (d.facts || []).map(function (x) {
    const v = x.vn
      ? '<span class="fact-v"><span class="fact-day">' + esc(x.v) + '</span><span class="fact-night">' + esc(x.vn) + '</span></span>'
      : esc(x.v);
    return '<li><b>' + esc(x.k) + '</b>' + v + '</li>';
  }).join('');
  const intro = (d.intro || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
  const favs = (d.favorites || []).map(function (x) {
    return '<div class="fav"><b>' + esc(x.name) + '</b><span>' + esc(x.src) + '</span></div>';
  }).join('');
  const links = linkPills(d.links);

  return layout(site, {
    title: '关于 ｜ ' + site.brand.name, desc: '关于' + d.name + '：写字的人，也是看月亮的人。',
    path: '/about/', current: 'about',
    content: '' +
      '<section class="page-head"><div class="wrap">\n' +
      '  <p class="kicker"><i></i><span>' + esc(pg.kicker || 'プロフィール') + ' / About</span></p>\n' +
      '  <h1 class="page-title">关于' + esc(d.name) + '</h1>\n' +
      '  <p class="page-lead">' + esc(pg.lead || d.lead || '') + '</p>\n' +
      '</div></section>\n' +
      '<div class="wrap"><div class="about-grid">\n' +
      '  <aside class="profile-card">\n' +
      '    <img src="' + u(site, d.avatar || '/assets/img/avatar.svg') + '" alt="头像">\n' +
      '    <p class="profile-name">' + esc(d.name) + '</p>\n' +
      '    <p class="profile-handle">' + esc(d.handle) + '</p>\n' +
      '    <ul class="profile-list">' + facts + '</ul>\n' +
      '  </aside>\n' +
      '  <div class="about-body">\n' +
      '    <h2>' + esc(d.introTitle) + '</h2>' + intro +
      '    <h2>' + esc(d.favoritesTitle || '心上人与心头好') + '</h2><div class="fav-grid">' + favs + '</div>\n' +
      '    <h2>写信给我</h2><p>站内不设评论区。想说点什么，下面任选一个入口。</p>\n' +
      '    <div class="hero-links">' + links + '</div>\n' +
      '  </div>\n' +
      '</div></div>\n'
  });
}

function notFoundPage(site) {
  return layout(site, {
    title: '页面不存在 ｜ ' + site.brand.name, desc: '这个地址没有东西。', path: '/404.html',
    content: '<section class="page-head"><div class="wrap">\n' +
      '  <p class="kicker"><i></i><span>404 / Not Found</span></p>\n' +
      '  <h1 class="page-title">这里的月亮落下去了</h1>\n' +
      '  <p class="page-lead">你要找的页面不在了，也许是改过名字，也许从来没写过。</p>\n' +
      '  <p style="margin-top:24px"><a class="btn" href="' + u(site, '/') + '">回首页<span class="arw" aria-hidden="true">→</span></a></p>\n' +
      '</div></section>\n'
  });
}

/* ============================ 构建 ============================ */

const LEGACY = [
  'about.html', 'posts.html', 'quotes.html',
  'posts/post-first.html', 'posts/post-05.html', 'posts/post-template.html',
  'assets/js/posts.js', 'assets/js/quotes-data.js'
];

function build(opts) {
  const quiet = opts && opts.quiet;
  const site = loadSite();
  const posts = loadPosts();

  LEGACY.forEach(function (rel) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  writeFile('index.html', homePage(site, posts));
  writeFile('posts/index.html', postsPage(site, posts));
  posts.forEach(function (p, i) {
    const prev = i > 0 ? posts[i - 1] : null;
    const next = i < posts.length - 1 ? posts[i + 1] : null;
    writeFile('posts/' + p.slug + '/index.html', postPage(site, p, prev, next));
  });
  writeFile('archive/index.html', archivePage(site, posts));
  writeFile('moments/index.html', momentsPage(site, loadMoments()));
  writeFile('gallery/index.html', galleryPage(site, loadGallery()));
  loadGallery().forEach(function (a) {
    writeFile('gallery/' + a.slug + '/index.html', albumPage(site, a));
  });
  writeFile('quotes/index.html', quotesPage(site));
  writeFile('friends/index.html', friendsPage(site));
  writeFile('about/index.html', aboutPage(site));
  writeFile('404.html', notFoundPage(site));

  // 清理已删除文章的旧目录
  const postsDir = path.join(ROOT, 'posts');
  if (fs.existsSync(postsDir)) {
    const keep = posts.map(function (p) { return p.slug; });
    fs.readdirSync(postsDir).forEach(function (f) {
      const full = path.join(postsDir, f);
      if (fs.statSync(full).isDirectory() && keep.indexOf(f) < 0) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    });
  }
  // 清理已删除相册的旧目录
  const galDir = path.join(ROOT, 'gallery');
  if (fs.existsSync(galDir)) {
    const keep = loadGallery().map(function (a) { return a.slug; });
    fs.readdirSync(galDir).forEach(function (f) {
      const full = path.join(galDir, f);
      if (fs.statSync(full).isDirectory() && keep.indexOf(f) < 0) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', pri: '1.0', last: today },
    { loc: '/posts/', pri: '0.9', last: today },
    { loc: '/archive/', pri: '0.7', last: today },
    { loc: '/moments/', pri: '0.7', last: today },
    { loc: '/gallery/', pri: '0.7', last: today },
    { loc: '/quotes/', pri: '0.6', last: today },
    { loc: '/friends/', pri: '0.5', last: today },
    { loc: '/about/', pri: '0.6', last: today }
  ].concat(posts.map(function (p) {
    return { loc: '/posts/' + p.slug + '/', pri: '0.8', last: p.date || today };
  }));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(function (x) {
      return '  <url>\n    <loc>' + esc(site.url + site.base + x.loc) + '</loc>\n' +
        '    <lastmod>' + esc(x.last) + '</lastmod>\n    <priority>' + x.pri + '</priority>\n  </url>';
    }).join('\n') + '\n</urlset>\n';
  writeFile('sitemap.xml', xml);
  writeFile('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: ' + site.url + site.base + '/sitemap.xml\n');

  if (!quiet) {
    console.log('  built · ' + posts.length + ' posts · ' + loadGallery().length + ' albums');
    posts.forEach(function (p) { console.log('    /posts/' + p.slug + '/  ' + p.title); });
  }
  return { site: site, posts: posts };
}

module.exports = {
  build: build,
  loadSite: loadSite,
  loadPosts: loadPosts,
  loadMoments: loadMoments,
  loadGallery: loadGallery,
  loadFriends: loadFriends,
  mdToHtml: mdToHtml,
  renderBody: renderBody,
  splitFrontMatter: splitFrontMatter,
  readMinutes: readMinutes,
  dateLabel: dateLabel
};

if (require.main === module) build();
