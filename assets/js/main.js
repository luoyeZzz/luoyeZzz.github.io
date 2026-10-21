/* =========================================================
   樱日和 · 交互
   加载动画 / 昼夜主题 / 卡片渲染 / 花瓣 / 滚动显现
   ========================================================= */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esc(str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------------- 昼夜主题 ---------------- */
  var themeBtn = doc.querySelector("[data-theme-toggle]");

  var forcedTheme = null;
  try { forcedTheme = new URLSearchParams(location.search).get("theme"); } catch (e) {}

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (!forcedTheme) { try { localStorage.setItem("sb-theme", theme); } catch (e) {} }
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#15111A" : "#FBF5F0");
    if (themeBtn) {
      themeBtn.setAttribute("aria-label", theme === "dark" ? "切换到日间模式" : "切换到夜间模式");
    }
  }

  setTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");

  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });
  }

  /* ---------------- 文章卡片 ---------------- */
  function metaHTML(p) {
    return '<span class="card-meta">' +
      '<span class="card-tag">' + esc(p.tag) + '</span>' +
      '<span>' + esc(p.date) + '</span>' +
      '<span aria-hidden="true">·</span>' +
      '<span>' + esc(p.read) + ' min</span>' +
    '</span>';
  }

  function coverStyle(p) {
    return p && p.cover ? 'style="background-image:url(' + "'" + p.cover + "'" + ')"' : '';
  }

  function featureHTML(p) {
    return '<a class="feature-main" href="' + esc(p.file) + '">' +
      '<span class="feature-cover cover-' + (p.tone || 1) + '" ' + coverStyle(p) + '>' +
        '<span class="cover-word" lang="ja">' + esc(p.word) + '</span>' +
        '<img class="cover-flower" src="assets/img/flower.svg" alt="" aria-hidden="true">' +
      '</span>' +
      '<span class="feature-body">' +
        metaHTML(p) +
        '<span class="feature-title">' + esc(p.title) + '</span>' +
        '<span class="feature-excerpt">' + esc(p.excerpt) + '</span>' +
        '<span class="feature-foot"><span>阅读全文</span><span class="arrow" aria-hidden="true">→</span></span>' +
      '</span>' +
    '</a>';
  }

  function sideHTML(p) {
    return '<a class="side-item" href="' + esc(p.file) + '">' +
      '<span class="side-no" aria-hidden="true">' + esc(p.no) + '</span>' +
      '<span class="side-main">' +
        '<span class="side-title">' + esc(p.title) + '</span>' +
        '<span class="side-meta"><span>' + esc(p.date) + '</span><span>' + esc(p.tag) + '</span></span>' +
      '</span>' +
    '</a>';
  }

  var posts = window.POSTS || [];
  var statPosts = doc.getElementById("stat-posts");
  if (statPosts) statPosts.textContent = ("0" + posts.length).slice(-2);
  var featureSlot = doc.getElementById("feature-slot");
  var sideSlot = doc.getElementById("side-posts");

  if (featureSlot) {
    if (posts.length) {
      featureSlot.style.gridColumn = '';
      featureSlot.innerHTML = featureHTML(posts[0]);
    } else {
      featureSlot.style.gridColumn = '1 / -1';
      featureSlot.innerHTML = '<div class="empty-home"><b>还没有文章</b><br>' +
        '写下第一篇，这里就会出现。<br>' +
        '<a class="link-arrow" href="posts.html">去写一篇 →</a></div>';
    }
  }
  if (sideSlot) {
    sideSlot.innerHTML = posts.length > 1 ? posts.slice(1, 4).map(sideHTML).join("") : "";
  }

  /* ---------------- 加载动画 ---------------- */
  var loader = doc.getElementById("loader");
  var loaderBar = doc.getElementById("loaderBar");
  var loaderPct = doc.getElementById("loaderPct");
  var loaderStatus = doc.getElementById("loaderStatus");
  var pct = 0;
  var closed = false;

  function paintLoader() {
    if (loaderBar) loaderBar.style.width = pct + "%";
    if (loaderPct) loaderPct.textContent = Math.round(pct);
    if (loaderStatus) {
      loaderStatus.textContent = pct < 35 ? "connecting" : pct < 72 ? "loading assets" : "almost ready";
    }
  }

  function closeLoader() {
    if (closed) return;
    closed = true;
    if (loader) {
      loader.classList.add("is-done");
      window.setTimeout(function () {
        if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
      }, 900);
    }
    doc.body.classList.remove("is-loading");
  }

  var tick = window.setInterval(function () {
    pct = Math.min(94, pct + 6 + Math.random() * 9);
    paintLoader();
  }, 110);

  var startedAt = Date.now();
  var completed = false;

  function completeLoader() {
    if (completed) return;
    completed = true;
    window.clearInterval(tick);
    pct = 100;
    paintLoader();
    /* 至少让加载动画完整演一遍，别一闪而过 */
    var wait = Math.max(0, 1100 - (Date.now() - startedAt));
    window.setTimeout(closeLoader, wait + 320);
  }

  paintLoader();

  if (reduce) {
    completeLoader();
  } else if (doc.readyState === "complete") {
    completeLoader();
  } else {
    window.addEventListener("load", completeLoader);
  }

  /* 兜底：3.8 秒内一定放行 */
  window.setTimeout(completeLoader, 3800);

  /* ---------------- 花瓣 ---------------- */
  (function petals() {
    var host = doc.querySelector(".hero-petals");
    if (!host || reduce) return;
    var count = window.innerWidth < 640 ? 8 : 15;
    var html = "";
    for (var i = 0; i < count; i++) {
      var size = 9 + Math.random() * 11;
      var x = (Math.random() * 2 - 1) * 140;
      var dur = 13 + Math.random() * 12;
      var delay = Math.random() * 14;
      var rot = 220 + Math.random() * 420;
      var op = 0.4 + Math.random() * 0.45;
      html += '<span style="' +
        'left:' + (Math.random() * 100).toFixed(2) + '%;' +
        '--s:' + size.toFixed(1) + 'px;' +
        '--x:' + x.toFixed(0) + 'px;' +
        '--dur:' + dur.toFixed(1) + 's;' +
        '--delay:-' + delay.toFixed(1) + 's;' +
        '--r:' + rot.toFixed(0) + 'deg;' +
        '--op:' + op.toFixed(2) + ';">' +
      '</span>';
    }
    host.innerHTML = html;
  })();

  /* ---------------- 滚动显现 ---------------- */
  var revealEls = [].slice.call(doc.querySelectorAll("[data-reveal]"));
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* 兜底：2.2 秒后强制显示，避免动画未触发导致空白 */
  window.setTimeout(function () {
    [].forEach.call(doc.querySelectorAll("[data-reveal]:not(.is-in)"), function (el) {
      el.classList.add("is-in");
    });
  }, 2200);

  /* ---------------- 运行天数 ---------------- */
  var sinceEl = doc.querySelector("[data-since]");
  if (sinceEl) {
    var since = new Date(sinceEl.getAttribute("data-since") + "T00:00:00");
    var days = Math.floor((Date.now() - since.getTime()) / 86400000);
    sinceEl.textContent = days > 0 ? days : 1;
  }

  /* ---------------- 年份 ---------------- */
  var year = new Date().getFullYear();
  [].forEach.call(doc.querySelectorAll("[data-year]"), function (el) {
    el.textContent = year;
  });

  /* ---------------- 移动端菜单 ---------------- */
  var navToggle = doc.querySelector(".nav-toggle");
  var topnav = doc.getElementById("topnav");

  if (navToggle && topnav) {
    navToggle.addEventListener("click", function () {
      var open = doc.body.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    });
    topnav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        doc.body.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && doc.body.classList.contains("nav-open")) {
        doc.body.classList.remove("nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------------- 文章列表页 ---------------- */
  var list = doc.getElementById("post-list");
  if (list && posts.length) {
    var postCardHTML = function (p) {
      return '<a class="post-card" href="' + esc(p.file) + '">' +
        '<span class="post-cover cover-' + (p.tone || 1) + '" ' + coverStyle(p) + '>' +
          '<span class="cover-word" lang="ja">' + esc(p.word) + '</span>' +
          '<img class="cover-flower" src="assets/img/flower.svg" alt="" aria-hidden="true">' +
        '</span>' +
        '<span class="post-body">' +
          '<span class="card-meta">' +
            '<span class="card-tag">' + esc(p.tag) + '</span>' +
            '<span>' + esc(p.date) + '</span>' +
            '<span>' + esc(p.read) + ' min</span>' +
          '</span>' +
          '<span class="post-title">' + esc(p.title) + '</span>' +
          '<span class="post-excerpt">' + esc(p.excerpt) + '</span>' +
          '<span class="post-more">つづきを読む →</span>' +
        '</span>' +
      '</a>';
    };

    var filterBar = doc.getElementById("post-filters");
    var emptyTip = doc.getElementById("post-empty");
    var activeTag = "全部";
    var tagList = ["全部"].concat(posts.map(function (p) { return p.tag; }).filter(function (t, i, a) { return a.indexOf(t) === i; }));

    var searchEl = doc.getElementById("post-search");
    var countEl = doc.getElementById("post-search-count");
    var query = "";

    var renderList = function () {
      var q = query.toLowerCase();
      var shown = posts.filter(function (p) {
        if (activeTag !== "全部" && p.tag !== activeTag) return false;
        if (!q) return true;
        var hay = (p.title + " " + p.excerpt + " " + p.tag + " " + p.date + " " + (p.word || "")).toLowerCase();
        return hay.indexOf(q) > -1;
      });
      list.innerHTML = shown.map(postCardHTML).join("") ||
        '<div class="empty-home"><b>没有匹配的文章</b><br>换个关键词试试，或者清空筛选。<br><a class="link-arrow" href="posts.html">看全部 →</a></div>';
      if (emptyTip) emptyTip.classList.toggle("is-on", shown.length === 0);
      if (countEl) {
        countEl.textContent = (q || activeTag !== "全部")
          ? shown.length + " / " + posts.length + " 篇"
          : "";
      }
    };

    if (filterBar) {
      filterBar.innerHTML = tagList.map(function (t) {
        return '<button type="button" class="filter' + (t === activeTag ? " is-active" : "") +
          '" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
      }).join("");

      filterBar.addEventListener("click", function (e) {
        var target = e.target;
        while (target && target !== filterBar && !(target.className && target.className.indexOf("filter") > -1)) {
          target = target.parentNode;
        }
        if (!target || target === filterBar) return;
        activeTag = target.getAttribute("data-tag");
        [].forEach.call(filterBar.querySelectorAll(".filter"), function (b) {
          b.classList.toggle("is-active", b === target);
        });
        renderList();
      });
    }

    var qParam = new URLSearchParams(location.search).get('q');
    if (qParam && searchEl) { searchEl.value = qParam; query = qParam; }

    if (searchEl) {
      searchEl.addEventListener("input", function () {
        query = this.value.trim();
        renderList();
      });
    }

    renderList();
  } else if (list) {
    list.innerHTML = '<div class="empty-home"><b>还没有文章</b><br>' +
      '写下第一篇，这里就会出现。<br>' +
      '<a class="link-arrow" href="posts.html">去写一篇 →</a></div>';
    var fbEmpty = doc.getElementById("post-filters");
    if (fbEmpty) fbEmpty.innerHTML = '';
  }
})();

/* ---------------- 文章页：进度条 / 目录 / 回顶 / 阅读时长 ---------------- */
(function () {
  var doc = document;
  var titleEl = doc.querySelector('.article-title');
  var prose = doc.querySelector('.prose');
  if (!titleEl || !prose) return;

  /* 进度条 */
  var bar = doc.createElement('div');
  bar.className = 'read-progress';
  doc.body.appendChild(bar);

  /* 回顶 */
  var topBtn = doc.createElement('button');
  topBtn.type = 'button';
  topBtn.className = 'to-top';
  topBtn.setAttribute('aria-label', '回到顶部');
  topBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>';
  topBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  doc.body.appendChild(topBtn);

  function onScroll() {
    var h = doc.documentElement;
    var top = window.pageYOffset || h.scrollTop || 0;
    var max = h.scrollHeight - h.clientHeight;
    var p = max > 0 ? top / max : 0;
    bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)) + ')';
    topBtn.classList.toggle('is-on', top > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* 目录 */
  var heads = prose.querySelectorAll('h2');
  if (heads.length >= 3) {
    var nav = doc.createElement('nav');
    nav.className = 'toc';
    nav.setAttribute('aria-label', '文章目录');
    var html = '<p class="toc-title">目录</p><ol>';
    for (var i = 0; i < heads.length; i++) {
      var id = 'sec-' + (i + 1);
      heads[i].setAttribute('id', id);
      html += '<li><a href="#' + id + '">' + heads[i].textContent + '</a></li>';
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
    if (cover && cover.parentNode) {
      cover.parentNode.insertBefore(nav, cover.nextSibling);
    } else {
      prose.parentNode.insertBefore(nav, prose);
    }
  }

  /* 自动阅读时长：按正文长度估算，400 字/分钟 */
  var plain = (prose.textContent || '').replace(/\s+/g, '');
  var mins = Math.max(1, Math.round(plain.length / 400));
  var kicker = doc.querySelector('.article-kicker');
  if (kicker) {
    var spans = kicker.querySelectorAll('span');
    if (spans.length >= 3) {
      spans[2].textContent = mins + ' min';
    }
  }
})();

/* ---------------- 台词收藏页 ---------------- */
(function () {
  var host = document.getElementById('quote-list');
  if (!host) return;
  var list = window.QUOTES || [];
  var empty = document.getElementById('quote-empty');
  var esc2 = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  if (!list.length) {
    host.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }
  host.innerHTML = list.map(function (q) {
    return '<figure class="quote-card">' +
      '<blockquote>' + esc2(q.text) + '</blockquote>' +
      (q.from ? '<figcaption>' + esc2(q.from) + '</figcaption>' : '') +
      '</figure>';
  }).join('');
})();

/* ---------------- 点击复制（邮箱等） ---------------- */
(function () {
  function fallbackCopy(str, cb) {
    var ta = document.createElement('textarea');
    ta.value = str; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) {}
    ta.remove();
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-copy]') : null;
    if (!el) return;
    var text = el.getAttribute('data-copy');
    function done() {
      var tip = document.createElement('div');
      tip.className = 'copy-tip';
      tip.textContent = '已复制 ' + text;
      document.body.appendChild(tip);
      requestAnimationFrame(function () { tip.classList.add('is-on'); });
      setTimeout(function () {
        tip.classList.remove('is-on');
        setTimeout(function () { tip.remove(); }, 300);
      }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  });
})();
