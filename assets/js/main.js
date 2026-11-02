/* =========================================================
   洛月 · 前台交互
   加载动画 / 昼夜主题 / 搜索筛选 / 目录 / 音效动画 / 音乐
   ========================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- 昼夜主题 ---------------- */
  var themeBtn = doc.querySelector('[data-theme-toggle]');
  var forcedTheme = null;
  try { forcedTheme = new URLSearchParams(location.search).get('theme'); } catch (e) {}

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (theme) doc.body.setAttribute('data-theme', theme);
    if (!forcedTheme) { try { localStorage.setItem('sb-theme', theme); } catch (e) {} }
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#15111A' : '#FBF5F0');
    if (themeBtn) themeBtn.setAttribute('aria-label', theme === 'dark' ? '切换到日间模式' : '切换到夜间模式');
  }
  setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---------------- 加载动画 ---------------- */
  var loader = doc.getElementById('loader');
  var loaderBar = doc.getElementById('loaderBar');
  var loaderPct = doc.getElementById('loaderPct');
  var loaderStatus = doc.getElementById('loaderStatus');
  var pct = 0, closed = false, startedAt = Date.now(), completed = false;

  function paint() {
    if (loaderBar) loaderBar.style.width = pct + '%';
    if (loaderPct) loaderPct.textContent = Math.round(pct);
    if (loaderStatus) {
      loaderStatus.textContent = pct < 35 ? 'connecting' : pct < 72 ? 'loading assets' : 'almost ready';
    }
  }
  function closeLoader() {
    if (closed) return;
    closed = true;
    if (loader) {
      loader.classList.add('is-done');
      window.setTimeout(function () {
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
      }, 700);
    }
    doc.body.classList.remove('is-loading');
  }
  function completeLoader() {
    if (completed) return;
    completed = true;
    if (tick) window.clearInterval(tick);
    pct = 100; paint();
    var wait = Math.max(0, 520 - (Date.now() - startedAt));
    window.setTimeout(closeLoader, wait + 120);
  }
  var tick = null;
  if (loader) {
    paint();
    if (reduce) {
      completeLoader();
    } else {
      tick = window.setInterval(function () {
        pct = Math.min(94, pct + 7 + Math.random() * 10);
        paint();
      }, 100);
      if (doc.readyState === 'complete') completeLoader();
      else window.addEventListener('load', completeLoader);
      window.setTimeout(completeLoader, 2600);
    }
  } else {
    doc.body.classList.remove('is-loading');
  }

  /* ---------------- 花瓣 ---------------- */
  (function petals() {
    var host = doc.querySelector('.hero-petals');
    if (!host || reduce) return;
    var count = window.innerWidth < 640 ? 8 : 15;
    var html = '';
    for (var i = 0; i < count; i++) {
      var size = 9 + Math.random() * 11;
      html += '<span style="left:' + (Math.random() * 100).toFixed(2) + '%;' +
        '--s:' + size.toFixed(1) + 'px;' +
        '--x:' + ((Math.random() * 2 - 1) * 140).toFixed(0) + 'px;' +
        '--dur:' + (13 + Math.random() * 12).toFixed(1) + 's;' +
        '--delay:-' + (Math.random() * 14).toFixed(1) + 's;' +
        '--r:' + (220 + Math.random() * 420).toFixed(0) + 'deg;' +
        '--op:' + (0.4 + Math.random() * 0.45).toFixed(2) + ';"></span>';
    }
    host.innerHTML = html;
  })();

  /* ---------------- 滚动显现 ---------------- */
  var revealEls = [].slice.call(doc.querySelectorAll('[data-reveal]'));
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }
  window.setTimeout(function () {
    [].forEach.call(doc.querySelectorAll('[data-reveal]:not(.is-in)'), function (el) { el.classList.add('is-in'); });
  }, 2400);

  /* ---------------- 运行天数 / 年份 ---------------- */
  var sinceEl = doc.querySelector('[data-since]');
  if (sinceEl) {
    var since = new Date(sinceEl.getAttribute('data-since') + 'T00:00:00');
    var days = Math.floor((Date.now() - since.getTime()) / 86400000);
    sinceEl.textContent = days > 0 ? days : 1;
  }
  var year = new Date().getFullYear();
  [].forEach.call(doc.querySelectorAll('[data-year]'), function (el) { el.textContent = year; });

  /* ---------------- 移动端菜单 ---------------- */
  var navToggle = doc.querySelector('.nav-toggle');
  var topnav = doc.getElementById('topnav');
  if (navToggle && topnav) {
    navToggle.addEventListener('click', function () {
      var open = doc.body.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    });
    topnav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        doc.body.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && doc.body.classList.contains('nav-open')) {
        doc.body.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------------- 文章列表：搜索 + 分类 ---------------- */
  var list = doc.getElementById('post-list');
  if (list) {
    var cards = [].slice.call(list.querySelectorAll('.post-card'));
    var filterBar = doc.getElementById('post-filters');
    var searchEl = doc.getElementById('post-search');
    var countEl = doc.getElementById('post-search-count');
    var emptyTip = doc.getElementById('post-empty');
    var activeTag = '全部';
    var query = '';

    function apply() {
      var q = query.toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var tag = card.getAttribute('data-tag') || '';
        var hay = card.textContent.toLowerCase();
        var ok = (activeTag === '全部' || tag === activeTag) && (!q || hay.indexOf(q) > -1);
        card.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      if (countEl) {
        countEl.textContent = (q || activeTag !== '全部') ? shown + ' / ' + cards.length + ' 篇' : '';
      }
      if (emptyTip) emptyTip.classList.toggle('is-on', shown === 0);
    }

    if (filterBar) {
      filterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter');
        if (!btn) return;
        activeTag = btn.getAttribute('data-tag');
        [].forEach.call(filterBar.querySelectorAll('.filter'), function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        apply();
      });
    }

    var qParam = '';
    try { qParam = new URLSearchParams(location.search).get('q') || ''; } catch (e) {}
    if (qParam && searchEl) { searchEl.value = qParam; query = qParam; }
    if (searchEl) {
      searchEl.addEventListener('input', function () { query = this.value.trim(); apply(); });
    }
    apply();
  }

  /* ---------------- 文章页：进度 / 目录 / 回顶 ---------------- */
  var prose = doc.querySelector('.prose');
  if (prose) {
    var bar = doc.createElement('div');
    bar.className = 'read-progress';
    doc.body.appendChild(bar);

    var topBtn = doc.createElement('button');
    topBtn.type = 'button';
    topBtn.className = 'to-top';
    topBtn.setAttribute('aria-label', '回到顶部');
    topBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>';
    topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    doc.body.appendChild(topBtn);

    function onScroll() {
      var h = doc.documentElement;
      var top = window.pageYOffset || h.scrollTop || 0;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, max > 0 ? top / max : 0)) + ')';
      topBtn.classList.toggle('is-on', top > 600);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var heads = prose.querySelectorAll('h2');
    if (heads.length >= 3) {
      var nav = doc.createElement('nav');
      nav.className = 'toc';
      nav.setAttribute('aria-label', '文章目录');
      var html = '<p class="toc-title">目录</p><ol>';
      for (var i = 0; i < heads.length; i++) {
        var id = 'sec-' + (i + 1);
        heads[i].setAttribute('id', id);
        html += '<li><a href="#' + id + '">' + esc(heads[i].textContent) + '</a></li>';
      }
      html += '</ol>';
      nav.innerHTML = html;
      nav.addEventListener('click', function (e) {
        var a = e.target.closest('a');
        if (!a) return;
        e.preventDefault();
        var target = doc.querySelector(a.getAttribute('href'));
        if (!target) return;
        var y = target.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top: y, behavior: 'smooth' });
      });
      var cover = doc.querySelector('.article-cover');
      if (cover && cover.parentNode) cover.parentNode.insertBefore(nav, cover.nextSibling);
      else prose.parentNode.insertBefore(nav, prose);
    }
  }

  /* ---------------- 点击特效 ---------------- */
  (function clickFx() {
    var host = doc.getElementById('click-fx');
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
      window.setTimeout(function () { ring.remove(); }, 620);

      var n = 4;
      for (var i = 0; i < n; i++) {
        var p = doc.createElement('span');
        p.className = 'fx-petal';
        var ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
        var dist = 18 + Math.random() * 22;
        p.style.left = e.clientX + 'px';
        p.style.top = e.clientY + 'px';
        p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
        p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
        p.style.setProperty('--rot', (Math.random() * 260 - 130).toFixed(0) + 'deg');
        host.appendChild(p);
        (function (el) { window.setTimeout(function () { el.remove(); }, 760); })(p);
      }
    }, { passive: true });
  })();

  /* ---------------- 音乐播放器 ---------------- */
  (function music() {
    var dock = doc.getElementById('music-dock');
    if (!dock) return;
    var fab = doc.getElementById('music-fab');
    var panel = doc.getElementById('music-panel');
    var frame = doc.getElementById('music-frame');
    if (!fab || !panel || !frame) return;

    fab.addEventListener('click', function () {
      var open = dock.classList.toggle('is-open');
      fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    panel.addEventListener('click', function (e) {
      var item = e.target.closest('.music-item');
      if (!item) return;
      [].forEach.call(panel.querySelectorAll('.music-item'), function (b) {
        b.classList.toggle('is-on', b === item);
      });
      frame.src = 'https://music.163.com/outchain/player?type=2&id=' + encodeURIComponent(item.getAttribute('data-id')) + '&auto=0&height=66';
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dock.classList.contains('is-open')) {
        dock.classList.remove('is-open');
        fab.setAttribute('aria-expanded', 'false');
      }
    });
  })();

  /* ---------------- 复制（邮箱等） ---------------- */
  (function copy() {
    function fallback(str, cb) {
      var ta = doc.createElement('textarea');
      ta.value = str; ta.style.position = 'fixed'; ta.style.opacity = '0';
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
})();
