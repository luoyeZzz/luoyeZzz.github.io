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

  /* ---------------- 主题 ---------------- */
  var themeBtn = $('[data-theme-toggle]');
  var forced = null;
  try { forced = new URLSearchParams(location.search).get('theme'); } catch (e) {}

  function applyTheme(t, save) {
    root.setAttribute('data-theme', t);
    if (save !== false && !forced) { try { localStorage.setItem('sb-theme', t); } catch (e) {} }
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#141017' : '#F5EDE6');
    if (themeBtn) themeBtn.setAttribute('aria-label', t === 'dark' ? '切换到白天' : '切换到夜间');
  }
  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);
  function switchTheme(next, x, y) {
    if (!document.startViewTransition || reduce) { applyTheme(next); return; }
    root.style.setProperty('--vt-x', x + 'px');
    root.style.setProperty('--vt-y', y + 'px');
    document.startViewTransition(function () { applyTheme(next); });
    setTimeout(function () {
      if (root.getAttribute('data-theme') !== next) applyTheme(next);
    }, 600);
  }
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
  (function listFilter() {
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
  })();

  /* ---------------- 文章页：目录 + 进度 ---------------- */
  (function article() {
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
  })();

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
      items.forEach(function (it, i) { if (it.id === String(st.id)) hit = i; });
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
      if (playBtn) {
        playBtn.textContent = on ? '❚❚' : '▶';
        playBtn.setAttribute('aria-label', on ? '暂停' : '播放');
      }
      fab.classList.toggle('is-playing', on);
    }
    function save() {
      try {
        sessionStorage.setItem('luoyue.music', JSON.stringify({
          id: items[idx].id, time: audio.currentTime || 0, playing: !audio.paused, paused: userPaused
        }));
      } catch (e) {}
    }

    /* 浏览器不让自动响：等第一次点击/按键再放 */
    var armed = false;
    function armGesture() {
      if (armed) return;
      armed = true;
      fab.classList.add('is-armed');
      var kick = function () {
        armed = false;
        fab.classList.remove('is-armed');
        document.removeEventListener('pointerdown', kick);
        document.removeEventListener('keydown', kick);
        if (audio.paused) play();
      };
      document.addEventListener('pointerdown', kick, { once: true });
      document.addEventListener('keydown', kick, { once: true });
    }

    function play() {
      userPaused = false;
      audio.play().then(function () {
        setPlaying(true);
      }).catch(function () {
        setPlaying(false);
        armGesture();
      });
    }

    function load(i, autoplayNow) {
      idx = i;
      mark();
      audio.src = src(i);
      if (autoplayNow) play();
    }

    audio.addEventListener('loadedmetadata', function () {
      if (st && st.id && String(st.id) === items[idx].id && st.time > 1) {
        try { audio.currentTime = st.time; } catch (e) {}
      }
    });
    audio.addEventListener('play', function () { setPlaying(true); save(); });
    audio.addEventListener('pause', function () { setPlaying(false); save(); });
    audio.addEventListener('ended', function () { load((idx + 1) % items.length, true); });
    audio.addEventListener('error', function () {
      items[idx].el.classList.add('is-bad');
      if (nowEl) nowEl.textContent = items[idx].name + '（这首放不了，可能是 VIP）';
      setPlaying(false);
      if (items.length > 1) {
        setTimeout(function () { load((idx + 1) % items.length, true); }, 1600);
      }
    });

    var lastSave = 0;
    audio.addEventListener('timeupdate', function () {
      var t = Date.now();
      if (t - lastSave > 2000) { lastSave = t; save(); }
    });
    window.addEventListener('pagehide', save);

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
      load(idx, false);
      play();
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
})();

/* =========================================================
   文章返回按钮 / 图片放大（独立于上面的作用域）
   ========================================================= */
(function () {
  'use strict';

  /* 返回按钮：滚动出视口后在左上角浮出 */
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

  /* 图片放大 */
  var box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = '<img alt="">';
  document.body.appendChild(box);
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
})();

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
