/* =========================================================
   洛月 · 前台交互
   主题 / 加载 / 搜索筛选 / 目录 / 音乐 / 回顶 / 点击特效
   ========================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, ctx) { return (ctx || doc).querySelector(s); };
  var $$ = function (s, ctx) { return [].slice.call((ctx || doc).querySelectorAll(s)); };
  var pageCleanups = [];

  /* ---------------- 主题 ---------------- */
  var themeBtn = $('[data-theme-toggle]');
  var forced = null;
  try { forced = new URLSearchParams(location.search).get('theme'); } catch (e) {}

  function applyTheme(t, save) {
    root.setAttribute('data-theme', t);
    if (save !== false && !forced) { try { localStorage.setItem('sb-theme', t); } catch (e) {} }
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#141017' : '#FBF7F5');
    if (themeBtn) themeBtn.setAttribute('aria-label', t === 'dark' ? '切换到白天' : '切换到夜间');
  }
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);
  function switchTheme(next, x, y) {
    if (next === 'dark' && typeof ensureHeroNight === 'function') ensureHeroNight();
    if (!document.startViewTransition || reduce) { applyTheme(next); return; }
    root.style.setProperty('--vt-x', x + 'px');
    root.style.setProperty('--vt-y', y + 'px');
    document.startViewTransition(function () { applyTheme(next); });
    setTimeout(function () {
      if (root.getAttribute('data-theme') !== next) applyTheme(next);
    }, 600);
  }
  function ensureHeroNight() {
    var img = document.querySelector('.hero-char--night img[data-src]');
    if (!img || img.getAttribute('data-loaded')) return;
    img.setAttribute('data-loaded', '1');
    img.src = img.getAttribute('data-src');
  }
  function prefetchHeroNight() {
    if (document.readyState === 'complete') {
      setTimeout(ensureHeroNight, 1800);
    } else {
      window.addEventListener('load', function () { setTimeout(ensureHeroNight, 1800); }, { once: true });
    }
  }
  if (root.getAttribute('data-theme') === 'dark') ensureHeroNight();
  prefetchHeroNight();

  if (themeBtn) {
    themeBtn.addEventListener('click', function (e) {
      var r = themeBtn.getBoundingClientRect();
      var x = e.clientX || r.left + r.width / 2;
      var y = e.clientY || r.top + r.height / 2;
      switchTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', x, y);
    });
  }

  /* ---------------- 加载动画 ---------------- */
  var loader = $('#loader');
  var bar = $('#loaderBar'), pctEl = $('#loaderPct'), statusEl = $('#loaderStatus');
  var pct = 0, closed = false, start = Date.now(), done = false;

  function paint() {
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = Math.round(pct);
    if (statusEl) statusEl.textContent = pct < 40 ? 'connecting' : pct < 75 ? 'loading' : 'ready';
  }
  function close() {
    if (closed) return;
    closed = true;
    if (loader) {
      loader.classList.add('is-done');
      setTimeout(function () { if (loader && loader.parentNode) loader.remove(); }, 600);
    }
    doc.body.classList.remove('is-loading');
  }
  var timer = null;
  function finish() {
    if (done) return;
    done = true;
    if (timer) clearInterval(timer);
    pct = 100; paint();
    setTimeout(close, Math.max(0, 420 - (Date.now() - start)) + 100);
  }

  if (loader) {
    paint();
    if (reduce) finish();
    else {
      timer = setInterval(function () { pct = Math.min(92, pct + 8 + Math.random() * 10); paint(); }, 110);
      if (doc.readyState === 'complete') finish();
      else window.addEventListener('load', finish);
      setTimeout(finish, 2400);
    }
  } else {
    doc.body.classList.remove('is-loading');
  }

  /* ---------------- 顶栏 ---------------- */
  var navToggle = $('.nav-toggle'), menu = $('#menu');
  if (navToggle && menu) {
    navToggle.addEventListener('click', function () {
      var open = doc.body.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') doc.body.classList.remove('nav-open');
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') doc.body.classList.remove('nav-open');
    });
    doc.addEventListener('click', function (e) {
      if (!doc.body.classList.contains('nav-open')) return;
      if (menu.contains(e.target) || navToggle.contains(e.target)) return;
      doc.body.classList.remove('nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  }

  /* ---------------- 运行天数 / 年份 ---------------- */
  var sinceEl = $('[data-since]');
  if (sinceEl) {
    var since = new Date(sinceEl.getAttribute('data-since') + 'T00:00:00');
    var days = Math.floor((Date.now() - since.getTime()) / 86400000);
    sinceEl.textContent = days > 0 ? days : 1;
  }
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------------- 文章搜索 / 分类 ---------------- */
  function initListFilter() {
    var list = $('#post-list');
    if (!list) return;
    var items = $$('.post-item', list);
    var filterBar = $('#post-filters');
    var searchEl = $('#post-search');
    var countEl = $('#post-search-count');
    var emptyEl = $('#post-empty');
    var activeTag = '全部';
    var query = '';

    function apply() {
      var q = query.toLowerCase();
      var shown = 0;
      items.forEach(function (item) {
        var tag = item.getAttribute('data-tag') || '';
        var okTag = activeTag === '全部' || tag === activeTag;
        var okQ = !q || item.textContent.toLowerCase().indexOf(q) > -1;
        var ok = okTag && okQ;
        item.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      if (countEl) countEl.textContent = (q || activeTag !== '全部') ? shown + ' / ' + items.length : '';
      if (emptyEl) emptyEl.classList.toggle('is-on', shown === 0);
    }

    if (filterBar) {
      filterBar.addEventListener('click', function (e) {
        var b = e.target.closest('.filter');
        if (!b) return;
        activeTag = b.getAttribute('data-tag');
        $$('.filter', filterBar).forEach(function (x) { x.classList.toggle('is-active', x === b); });
        apply();
      });
    }
    var qp = '';
    try { qp = new URLSearchParams(location.search).get('q') || ''; } catch (e) {}
    if (qp && searchEl) { searchEl.value = qp; query = qp; }
    if (searchEl) searchEl.addEventListener('input', function () { query = this.value.trim(); apply(); });
    apply();
  }

  /* ---------------- 文章页：目录 + 进度 ---------------- */
  function initArticle() {
    var prose = $('.prose');
    if (!prose) return;
    var heads = $$('h2', prose);
    var tocHost = $('#toc');
    var tocPanel = $('#toc-panel');
    var readBar = $('#read-bar');

    if (tocHost && heads.length >= 2) {
      tocHost.innerHTML = heads.map(function (h, i) {
        h.id = 'sec-' + (i + 1);
        return '<a href="#sec-' + (i + 1) + '">' + h.textContent + '</a>';
      }).join('');
    } else if (tocPanel) {
      tocPanel.style.display = 'none';
    }

    function onScroll() {
      var h = doc.documentElement;
      var top = window.pageYOffset || h.scrollTop || 0;
      var max = h.scrollHeight - h.clientHeight;
      if (readBar) readBar.style.width = (max > 0 ? Math.min(1, top / max) : 0) * 100 + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    pageCleanups.push(function () { window.removeEventListener('scroll', onScroll); });
    onScroll();

    if (tocHost) {
      tocHost.addEventListener('click', function (e) {
        var a = e.target.closest('a');
        if (!a) return;
        e.preventDefault();
        var t = doc.querySelector(a.getAttribute('href'));
        if (!t) return;
        window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - 90, behavior: 'smooth' });
      });
    }
  }

  /* ---------------- 回顶 ---------------- */
  (function toTop() {
    var btn = $('#to-top');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    function upd() { btn.classList.toggle('is-on', window.pageYOffset > 480); }
    window.addEventListener('scroll', upd, { passive: true });
    upd();
  })();


  /* ---------------- 进站提示弹窗 ---------------- */
  (function notice() {
    var cfg = {};
    var dataEl = doc.getElementById('notice-data');
    if (dataEl) { try { cfg = JSON.parse(dataEl.textContent || '{}'); } catch (e) { cfg = {}; } }
    if (!cfg || !cfg.enabled) return;

    var KEY = 'luoyue.notice-off';
    function isOff() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

    var mask = null;
    var dismissed = false;
    function hide() {
      if (!mask) return;
      var m = mask;
      mask = null;
      if (m.__cleanups) m.__cleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
      m.classList.remove('is-on');
      setTimeout(function () { if (m.parentNode) m.remove(); }, 280);
    }
    function build() {
      mask = doc.createElement('div');
      mask.className = 'notice-mask';
      mask.setAttribute('role', 'dialog');
      mask.setAttribute('aria-modal', 'true');
      mask.setAttribute('aria-label', cfg.title || '站点提示');

      var body = String(cfg.body || '').split(String.fromCharCode(10)).filter(function (x) { return x.trim(); });
      var html = '<div class="notice-card">' +
        '<button class="notice-close" type="button" aria-label="关闭">×</button>' +
        '<h2>' + esc(cfg.title || '欢迎') + '</h2>' +
        '<div class="notice-body">' + body.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>' +
        '<div class="notice-actions">' +
          '<button class="notice-btn primary" type="button" data-notice="play">' + esc(cfg.playLabel || '边听边看') + '</button>' +
          '<button class="notice-btn" type="button" data-notice="quiet">' + esc(cfg.quietLabel || '安静阅读') + '</button>' +
        '</div>' +
        (cfg.remember ? '<label class="notice-remember"><input type="checkbox" data-notice="remember">' + esc(cfg.remember) + '</label>' : '') +
      '</div>';
      mask.innerHTML = html;
      doc.body.appendChild(mask);
      requestAnimationFrame(function () { mask && mask.classList.add('is-on'); });

      var remember = mask.querySelector('[data-notice="remember"]');

      function closeWith(playIt) {
        dismissed = true;
        if (remember && remember.checked) { try { localStorage.setItem(KEY, '1'); } catch (er) {} }
        if (playIt) {
          try { if (window.__luoyueMusic) window.__luoyueMusic.play(); } catch (er) {}
        } else {
          window.__luoyueQuiet = true;
          try { if (window.__luoyueMusic) window.__luoyueMusic.pause(); } catch (er) {}
        }
        hide();
      }

      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); closeWith(false); }
      }
      doc.addEventListener('keydown', onKey);
      var cleanups = mask.__cleanups = [];
      cleanups.push(function () { doc.removeEventListener('keydown', onKey); });

      function bind(sel, fn) {
        var el = mask.querySelector(sel);
        if (!el) return;
        el.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          fn();
        });
      }
      bind('[data-notice="play"]', function () { closeWith(true); });
      bind('[data-notice="quiet"]', function () { closeWith(false); });
      bind('.notice-close', function () { closeWith(false); });

      mask.addEventListener('click', function (e) {
        if (e.target === mask) closeWith(false);
      });
    }

    function show() {
      if (dismissed) return false;
      if (isOff()) return false;
      if (mask) return true;
      build();
      return true;
    }

    window.__luoyueNotice = { show: show, hide: hide, isOff: isOff };

    /* 从写作台「查看站点」进来时（?notice=1），无论能不能自动播放都先说明一次 */
    try {
      if (new URLSearchParams(location.search).get('notice') === '1') {
        setTimeout(function () { show(); }, 600);
      }
    } catch (e) {}
  })();

  /* ---------------- 音乐播放器 ---------------- */
  (function music() {
    var dock = $('#music-dock');
    if (!dock) return;
    var audio = $('#music-audio');
    var fab = $('#music-fab');
    var listEl = $('#music-list');
    var nowEl = $('#music-now');
    var playBtn = $('#music-play');
    var volEl = $('#music-vol');
    var volNum = $('#music-vol-num');
    var prevBtn = $('#music-prev');
    var nextBtn = $('#music-next');
    var listToggle = $('#music-list-toggle');
    if (!audio || !fab) return;

    var items = $$('.music-item', dock).map(function (b) {
      return { id: b.getAttribute('data-id'), src: b.getAttribute('data-src') || '', name: b.getAttribute('data-name') || b.textContent, el: b };
    });
    if (!items.length) return;

    var autoplay = dock.getAttribute('data-autoplay') !== '0';
    var idx = 0;

    /* 音量：上次的值 > 配置值 */
    var saved = null;
    try { saved = parseFloat(localStorage.getItem('luoyue.volume')); } catch (e) {}
    var vol = isNaN(saved) ? parseFloat(dock.getAttribute('data-volume') || '0.3') : saved;
    vol = Math.min(1, Math.max(0, vol));
    audio.volume = vol;
    if (volEl) volEl.value = Math.round(vol * 100);

    /* 这次会话上次听到哪 */
    var st = null;
    try { st = JSON.parse(sessionStorage.getItem('luoyue.music') || 'null'); } catch (e) {}
    if (st && st.id) {
      var hit = -1;
      items.forEach(function (it, i) {
        if (String(it.id) === String(st.id) || (it.src && it.src === st.id)) hit = i;
      });
      if (hit > -1) idx = hit;
    }
    /* 必须在读到 st 之后再判断，否则永远是 false */
    var userPaused = !!(st && st.paused);

    function src(i) {
      if (items[i].src) return items[i].src;
      return 'https://music.163.com/song/media/outer/url?id=' + encodeURIComponent(items[i].id) + '.mp3';
    }
    function mark() {
      items.forEach(function (it, i) { it.el.classList.toggle('is-on', i === idx); });
      if (nowEl) nowEl.textContent = items[idx].name;
    }
    function setPlaying(on) {
      if (on) {
        var tip0 = document.getElementById('music-hint');
        if (tip0 && tip0.parentNode) tip0.remove();
      }
      if (playBtn) {
        playBtn.textContent = on ? '❚❚' : '▶';
        playBtn.setAttribute('aria-label', on ? '暂停' : '播放');
      }
      fab.classList.toggle('is-playing', on);
    }
    function save() {
      try {
        var t = audio.currentTime || 0;
        /* 刚加载还没跳到位时，保留原来的续播点，别被 0 覆盖 */
        if (t < 1 && resumeAt > 1) t = resumeAt;
        sessionStorage.setItem('luoyue.music', JSON.stringify({
          id: items[idx].id || items[idx].src, time: t, playing: !audio.paused, paused: userPaused
        }));
      } catch (e) {}
    }

    /* 浏览器不让自动响：等第一次点击/按键再放 */
    var armed = false;
    function showHint() {
      try {
        if (document.getElementById('music-hint')) return;
        var tip = document.createElement('button');
        tip.type = 'button';
        tip.id = 'music-hint';
        tip.className = 'music-hint';
        tip.textContent = '▶ 听背景音乐';
        tip.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          play();
          if (tip.parentNode) tip.remove();
        });
        dock.appendChild(tip);
        setTimeout(function () { if (tip.parentNode) tip.remove(); }, 12000);
      } catch (e) {}
    }

    /* 开场页点「进入」时调用 */
    window.__luoyueMusic = {
      play: function () { if (audio.paused) play(); },
      pause: function () {
        if (audio.paused) return;
        userPaused = true;
        audio.pause();
        setPlaying(false);
        save();
      },
      isPlaying: function () { return !audio.paused; }
    };

    function showNoticeOrHint() {
      if (window.__luoyueNotice && window.__luoyueNotice.show()) return;
      showHint();
    }

    function armGesture() {
      if (armed || window.__luoyueQuiet) return;
      armed = true;
      fab.classList.add('is-armed');
      showNoticeOrHint();
      var kick = function () {
        armed = false;
        fab.classList.remove('is-armed');
        document.removeEventListener('pointerdown', kick);
        document.removeEventListener('keydown', kick);
        if (window.__luoyueQuiet) return;
        if (audio.paused) play();
      };
      document.addEventListener('pointerdown', kick, { once: true });
      document.addEventListener('keydown', kick, { once: true });
    }

    function play() {
      userPaused = false;
      audio.play().then(function () {
        setPlaying(true);
        seekToResume();
      }).catch(function () {
        setPlaying(false);
        /* 有一次自动重试：等资源可以播放时再试 */
        var retried = false;
        var retry = function () {
          if (retried || !audio.paused) return;
          retried = true;
          audio.play().then(function () { setPlaying(true); seekToResume(); }).catch(function () { armGesture(); });
        };
        audio.addEventListener('canplay', retry, { once: true });
        setTimeout(retry, 1500);
      });
    }

    var usedResume = false;
    function load(i, autoplayNow) {
      idx = i;
      mark();
      audio.src = src(i);
      try { audio.load(); } catch (e) {}
      var same = !!(st && st.time && (String(st.id) === String(items[i].id) || items[i].src === st.id));
      resumeAt = (!usedResume && same) ? st.time : 0;
      usedResume = true;
      if (autoplayNow) play();
    }

    /* 续播位置：元数据加载后、以及真正开始播放后各跳一次
       （浏览器拦截自动播放时，用户点一下才开始，此时元数据早已加载完） */
    var resumeAt = (st && st.time) ? st.time : 0;
    function seekToResume() {
      if (!resumeAt || resumeAt < 1) return;
      var dur = audio.duration;
      if (!isFinite(dur) || dur < 1) return;
      if (Math.abs(audio.currentTime - resumeAt) < 1.5) { resumeAt = 0; return; }
      try { audio.currentTime = Math.min(resumeAt, dur - 1); } catch (e) {}
      /* 只跳一次：之后暂停/继续都从当前位置走，不要反复弹回 */
      resumeAt = 0;
    }
    audio.addEventListener('loadedmetadata', seekToResume);
    audio.addEventListener('canplay', seekToResume);
    audio.addEventListener('playing', seekToResume);
    audio.addEventListener('play', function () { setPlaying(true); save(); });
    audio.addEventListener('pause', function () { setPlaying(false); save(); });
    audio.addEventListener('ended', function () { load((idx + 1) % items.length, true); });
    audio.addEventListener('error', function () {
      items[idx].el.classList.add('is-bad');
      var badUrl = audio.currentSrc || audio.src || '';
      if (window.console) console.warn('[music] 加载失败：', badUrl, audio.error);
      if (nowEl) nowEl.textContent = items[idx].name + '（这首放不了，可能是 VIP）';
      setPlaying(false);
      if (items.length > 1) {
        setTimeout(function () { load((idx + 1) % items.length, true); }, 1600);
      }
    });

    var bufferingTimer = null;
    audio.addEventListener('waiting', function () {
      bufferingTimer = setTimeout(function () {
        if (audio.paused) return;
        if (nowEl) nowEl.textContent = items[idx].name + '（缓冲中…）';
      }, 6000);
    });
    audio.addEventListener('playing', function () {
      if (bufferingTimer) { clearTimeout(bufferingTimer); bufferingTimer = null; }
      if (nowEl) nowEl.textContent = items[idx].name;
    });

    var lastSave = 0;
    audio.addEventListener('timeupdate', function () {
      var t = Date.now();
      if (t - lastSave > 2000) { lastSave = t; save(); }
    });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

    fab.addEventListener('click', function () {
      var open = dock.classList.toggle('is-open');
      fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var closeBtn = $('#music-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        dock.classList.remove('is-open');
        fab.setAttribute('aria-expanded', 'false');
      });
    }
    if (listToggle) {
      listToggle.addEventListener('click', function () { dock.classList.toggle('show-list'); });
    }
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('.music-item');
      if (!b) return;
      var i = items.findIndex(function (x) { return x.el === b; });
      if (i > -1) load(i, true);
    });
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (!audio.src) { load(idx, true); return; }
        if (audio.paused) play();
        else { userPaused = true; audio.pause(); setPlaying(false); save(); }
      });
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { load((idx - 1 + items.length) % items.length, true); });
    if (nextBtn) nextBtn.addEventListener('click', function () { load((idx + 1) % items.length, true); });
    if (volEl) {
      volEl.addEventListener('input', function () {
        vol = Number(this.value) / 100;
        audio.volume = vol;
        if (volNum) volNum.textContent = Math.round(vol * 100) + '%';
        try { localStorage.setItem('luoyue.volume', String(vol)); } catch (e) {}
      });
    }

    mark();
    setPlaying(false);

    /* 进站自动播放：上次在播就续上，否则看配置 */
    var resumePlaying = !!(st && st.playing);
    var respectPause = !!(st && st.paused);
    if (!respectPause && (autoplay || resumePlaying)) {
      var kickoff = function () {
        setTimeout(function () {
          load(idx, false);
          play();
        }, 300);
      };
      if (document.readyState === 'complete') kickoff();
      else window.addEventListener('load', kickoff, { once: true });

      setTimeout(function () {
        if (audio.paused && !window.__luoyueQuiet) showNoticeOrHint();
      }, 3200);
    }
  })();

  /* ---------------- 复制 ---------------- */
  (function copy() {
    function fallback(text, cb) {
      var ta = doc.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy'); cb(); } catch (e) {}
      ta.remove();
    }
    doc.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-copy]') : null;
      if (!el) return;
      var text = el.getAttribute('data-copy');
      function done() {
        var tip = doc.createElement('div');
        tip.className = 'copy-tip';
        tip.textContent = '已复制 ' + text;
        doc.body.appendChild(tip);
        requestAnimationFrame(function () { tip.classList.add('is-on'); });
        setTimeout(function () {
          tip.classList.remove('is-on');
          setTimeout(function () { tip.remove(); }, 300);
        }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallback(text, done); });
      } else {
        fallback(text, done);
      }
    });
  })();

  /* ---------------- 点击特效 ---------------- */
  (function clickFx() {
    var host = $('#click-fx');
    if (!host || reduce) return;
    var last = 0;
    doc.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var now = Date.now();
      if (now - last < 90) return;
      last = now;

      var ring = doc.createElement('span');
      ring.className = 'fx-ring';
      ring.style.left = e.clientX + 'px';
      ring.style.top = e.clientY + 'px';
      host.appendChild(ring);
      setTimeout(function () { ring.remove(); }, 620);

      for (var i = 0; i < 4; i++) {
        var p = doc.createElement('span');
        p.className = 'fx-petal';
        var ang = (Math.PI * 2 * i) / 4 + Math.random() * 0.6;
        var dist = 18 + Math.random() * 22;
        p.style.left = e.clientX + 'px';
        p.style.top = e.clientY + 'px';
        p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
        p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
        p.style.setProperty('--rot', (Math.random() * 260 - 130).toFixed(0) + 'deg');
        host.appendChild(p);
        (function (el) { setTimeout(function () { el.remove(); }, 760); })(p);
      }
    }, { passive: true });
  })();

  /* ---------------- 局部导航（SPA） ---------------- */
  function moveGlider() {
    var menu = $('#menu');
    if (!menu) return;
    var g = menu.querySelector('.nav-glider');
    if (!g) {
      g = doc.createElement('span');
      g.className = 'nav-glider';
      menu.insertBefore(g, menu.firstChild);
      doc.body.classList.add('nav-glider-ready');
    }
    var active = menu.querySelector('a[aria-current="page"]');
    if (!active || !active.offsetWidth) { g.style.opacity = 0; return; }
    var mr = menu.getBoundingClientRect();
    var ar = active.getBoundingClientRect();
    g.style.left = (ar.left - mr.left) + 'px';
    g.style.width = ar.width + 'px';
    g.style.opacity = 1;
  }
  window.addEventListener('resize', function () { moveGlider(); });

  function mountPage() {
    while (pageCleanups.length) { try { pageCleanups.pop()(); } catch (e) {} }
    initListFilter();
    initArticle();
    try { initBackNav(); } catch (e) {}
    try { initLightbox(); } catch (e) {}
    if (typeof prefetchHeroNight === 'function') prefetchHeroNight();
    if (root.getAttribute('data-theme') === 'dark' && typeof ensureHeroNight === 'function') ensureHeroNight();
    moveGlider();
  }

  (function spa() {
    if (!window.fetch || !window.history || !window.history.pushState) return;

    var barEl = doc.createElement('div');
    barEl.className = 'spa-bar';
    doc.body.appendChild(barEl);

    var cache = Object.create(null);
    var busy = false;

    function progress(on, done) {
      barEl.classList.toggle('is-on', !!on);
      barEl.classList.toggle('is-done', !!done);
      if (!on) {
        setTimeout(function () { barEl.classList.remove('is-done'); barEl.style.width = ''; }, 320);
      }
    }

    function samePage(url) {
      return url.pathname === location.pathname && url.search === location.search;
    }

    function internal(a) {
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;
      if (a.hasAttribute('data-no-spa')) return null;
      var raw = a.getAttribute('href');
      if (!raw || raw.charAt(0) === '#') return null;
      if (/^(mailto:|tel:|javascript:)/i.test(raw)) return null;
      var url;
      try { url = new URL(a.href, location.href); } catch (e) { return null; }
      if (url.origin !== location.origin) return null;
      return url;
    }

    function setCurrent(path) {
      $$('#menu a, .menu a').forEach(function (a) {
        var u;
        try { u = new URL(a.href, location.href); } catch (e) { return; }
        var on = u.pathname === path ||
          (u.pathname !== '/' && path.indexOf(u.pathname) === 0);
        if (on) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    }

    function swap(doc2, url) {
      var nextMain = doc2.querySelector('main#main');
      var curMain = doc.querySelector('main#main');
      if (!nextMain || !curMain) { location.href = url.href; return false; }

      if (doc2.title) doc.title = doc2.title;
      var pairs = [['meta[name="description"]', 'description'], ['meta[property="og:title"]', 'ogTitle'], ['meta[property="og:description"]', 'ogDesc']];
      pairs.forEach(function (p) {
        var from = doc2.querySelector(p[0]), to = doc.querySelector(p[0]);
        if (from && to) to.setAttribute('content', from.getAttribute('content') || '');
      });
      var canon = doc2.querySelector('link[rel="canonical"]');
      if (canon) {
        var mine = doc.querySelector('link[rel="canonical"]');
        if (mine) mine.setAttribute('href', canon.getAttribute('href') || '');
      }

      curMain.replaceWith(doc.importNode(nextMain, true));
      setCurrent(url.pathname);
      doc.body.classList.remove('nav-open');
      mountPage();
      if (!doc.startViewTransition || reduce) {
        var fresh = doc.querySelector('main#main');
        if (fresh) {
          fresh.classList.add('spa-enter');
          setTimeout(function () { fresh.classList.remove('spa-enter'); }, 500);
        }
      }
      moveGlider();
      return true;
    }

    function go(url, push) {
      var href = url.href;
      if (busy) return;
      busy = true;
      progress(true);

      var apply = function (html) {
        var doc2 = new DOMParser().parseFromString(html, 'text/html');
        var c = doc2.querySelector('link[rel="canonical"]');
        if (c) {
          var cp = '';
          try { cp = new URL(c.getAttribute('href'), location.origin).pathname; } catch (e) {}
          if (cp && cp !== url.pathname) {
            delete cache[href];
            busy = false;
            progress(false);
            location.href = href;
            return;
          }
        }
        var finished = false;
        var finish = function () {
          if (finished) return;
          finished = true;
          busy = false;
          progress(false, true);
        };
        var run = function () {
          if (!swap(doc2, url)) { finish(); return; }
          if (push) history.pushState({ spa: 1 }, '', url.pathname + url.search + url.hash);
          if (url.hash) {
            var t = doc.querySelector(url.hash);
            if (t) { t.scrollIntoView(); finish(); return; }
          }
          window.scrollTo(0, 0);
          finish();
        };
        var armed = false;
        var once = function () {
          if (armed) return;
          armed = true;
          run();
        };
        /* 换页不用 View Transition：它会先显示旧页面快照，容易看到“闪一下上一个页面” */
        once();
      };

      var cached = cache[href];
      if (cached) { apply(cached); return; }

      var ctrl = window.AbortController ? new AbortController() : null;
      fetch(href, { credentials: 'same-origin', signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          if (!/text\/html/.test(r.headers.get('content-type') || '')) throw new Error('not html');
          return r.text();
        })
        .then(function (html) {
          cache[href] = html;
          var keys = Object.keys(cache);
          if (keys.length > 12) delete cache[keys[0]];
          apply(html);
        })
        .catch(function () {
          busy = false;
          progress(false);
          location.href = href;
        });
    }

    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var url = internal(a);
      if (!url) return;
      if (a.getAttribute('href').charAt(0) === '#' ||
          (url.pathname === location.pathname && url.search === location.search && url.hash)) return;
      e.preventDefault();
      if (samePage(url)) { if (url.hash) doc.getElementById(url.hash.slice(1)).scrollIntoView(); return; }
      go(url, true);
    });

    /* 悬停预取，点击更快 */
    var hoverTimer = null;
    doc.addEventListener('mouseover', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var url = internal(a);
      if (!url || cache[url.href] || samePage(url)) return;
      var target = url;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () {
        if (!target) return;
        fetch(target.href, { credentials: 'same-origin' })
          .then(function (r) { return r.ok ? r.text() : ''; })
          .then(function (t) { if (t) cache[target.href] = t; })
          .catch(function () {});
      }, 120);
    }, { passive: true });

    window.addEventListener('popstate', function () {
      var url;
      try { url = new URL(location.href); } catch (e) { return; }
      if (!doc.querySelector('main#main')) return;
      go(url, false);
    });
  })();

  mountPage();
})();

/* =========================================================
   文章返回按钮 / 图片放大（独立于上面的作用域）
   ========================================================= */
var lightboxReady = false;
var lightboxEl = null;

function initLightbox() {
  if (lightboxReady) return;
  lightboxReady = true;
  var box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = '<img alt="">';
  document.body.appendChild(box);
  lightboxEl = box;
  var big = box.querySelector('img');
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-zoom]') : null;
    if (t) {
      big.src = t.getAttribute('src');
      box.classList.add('on');
      return;
    }
    if (e.target === box || e.target === big) box.classList.remove('on');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') box.classList.remove('on');
  });
}

function initBackNav() {
  var inline = document.querySelector('.back-inline');
  var floater = document.querySelector('.back-float');
  if (inline && floater) {
    var from = '';
    try { from = new URLSearchParams(location.search).get('from') || ''; } catch (e) {}
    var targets = {
      home: { href: '/', label: '返回首页' },
      archive: { href: '/archive/', label: '返回归档' },
      posts: { href: '/posts/', label: '返回文章列表' }
    };
    var target = targets[from] || targets.posts;
    inline.setAttribute('href', target.href);
    floater.setAttribute('href', target.href);
    inline.textContent = '← ' + target.label;
    floater.textContent = '← ' + target.label;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          floater.classList.toggle('is-on', !en.isIntersecting);
        });
      }, { threshold: 0 });
      io.observe(inline);
    } else {
      floater.classList.add('is-on');
    }
  }
}

/* =========================================================
   音乐：播放进度 + 音量弹层
   ========================================================= */
(function () {
  'use strict';
  var audio = document.getElementById('music-audio');
  if (!audio) return;
  var seek = document.getElementById('music-seek');
  var cur = document.getElementById('music-cur');
  var dur = document.getElementById('music-dur');
  var panel = document.querySelector('.music-panel');
  var volBtn = document.getElementById('music-vol-btn');
  if (!seek || !cur || !dur) return;

  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60);
    var sec = Math.floor(t % 60);
    return m + ':' + (sec < 10 ? '0' + sec : sec);
  }

  var dragging = false;
  audio.addEventListener('loadedmetadata', function () { dur.textContent = fmt(audio.duration); });
  audio.addEventListener('timeupdate', function () {
    if (!dragging) {
      seek.value = audio.duration ? Math.round((audio.currentTime / audio.duration) * 1000) : 0;
    }
    cur.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('ended', function () { cur.textContent = fmt(audio.duration); seek.value = 1000; });
  seek.addEventListener('input', function () {
    dragging = true;
    cur.textContent = fmt(audio.duration * (Number(seek.value) / 1000));
  });
  seek.addEventListener('change', function () {
    if (audio.duration) audio.currentTime = audio.duration * (Number(seek.value) / 1000);
    dragging = false;
  });

  if (panel && volBtn) {
    volBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('vol-open');
    });
    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target)) panel.classList.remove('vol-open');
    });
  }
})();
