/**
 * IRC4Fun — Avatars for The Lounge
 *
 * Injects avatar images into the nicklist, chat messages, and whois output.
 * Fetches from the IRC4Fun accounts API via nginx proxy.
 *
 * API:  GET /api/get_avatar/?account=<nick>
 *       → { "avatar_url": "/media/avatars/…" | null }
 */

(function () {
  "use strict";

  // ── Config ──────────────────────────────────────────────────────────
  var API_PATH = "/api/get_avatar/";
  // Avatar images are proxied through the same origin via nginx.
  var AVATAR_ORIGIN = "";
  var NEGATIVE_TTL = 5 * 60 * 1000; // 5 min
  var SCAN_INTERVAL = 1500;
  // Max concurrent API requests to avoid flooding.
  var MAX_CONCURRENT = 3;
  // ────────────────────────────────────────────────────────────────────

  var SERVICE_NICKS = [
    "chanserv", "nickserv", "memoserv", "operserv", "hostserv",
    "botserv", "saslserv", "global", "helpserv", "statserv",
    "alis", "gameserv", "groupserv", "infoserv", "reportserv"
  ];
  var serviceSet = {};
  SERVICE_NICKS.forEach(function (n) { serviceSet[n] = true; });

  /** nick (lowercase) → { url: string|null, ts: number } */
  var cache = {};

  /** Queue of { nick, key } waiting to be fetched. */
  var queue = [];
  var activeCount = 0;

  // ── Helpers ─────────────────────────────────────────────────────────

  function isServiceNick(nick) {
    return serviceSet[nick.toLowerCase()] === true;
  }

  function createAvatarEl(nick, url) {
    var wrap = document.createElement("span");
    wrap.className = "tl-avatar";
    wrap.setAttribute("data-nick", nick);

    var img = document.createElement("img");
    img.className = "tl-avatar-img";
    img.src = url.startsWith("/") ? AVATAR_ORIGIN + url : url;
    img.alt = nick;
    img.loading = "lazy";
    img.onerror = function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    };
    wrap.appendChild(img);
    return wrap;
  }

  // ── Inject into DOM ─────────────────────────────────────────────────

  /** Detect where a .user element lives to apply context-specific sizing. */
  function getContext(el) {
    if (el.closest(".userlist")) return "nicklist";
    if (el.closest(".from"))     return "msg";
    // Whois: the .user is inside <p> inside the content area of a whois msg,
    // NOT inside the <dl class="whois"> — it's a sibling of that <dl>.
    var msg = el.closest(".msg");
    if (msg && msg.getAttribute("data-type") === "whois") return "whois";
    return "other";
  }

  function injectAllForNick(nick, url) {
    var selector = "#chat .user[data-name=\"" + CSS.escape(nick) + "\"]";
    var els = document.querySelectorAll(selector);
    for (var i = 0; i < els.length; i++) {
      injectAvatar(els[i], nick, url);
    }
  }

  function injectAvatar(userEl, nick, url) {
    var ctx = getContext(userEl);
    if (ctx === "other") return; // don't touch settings/connect forms

    // For messages, inject into the .from wrapper so the avatar sits
    // outside the clickable .user span (keeps the layout clean).
    // For whois, inject into the parent <p> that wraps the Username component.
    var target;
    if (ctx === "msg") {
      target = userEl.closest(".from") || userEl;
    } else if (ctx === "whois") {
      target = userEl.parentElement || userEl;
    } else {
      target = userEl;
    }

    // Remove any stale avatar from a recycled element.
    var old = target.querySelector(".tl-avatar");
    if (old) {
      var oldNick = old.getAttribute("data-nick");
      if (oldNick === nick) return; // already correct
      old.parentNode.removeChild(old);
    }
    var avatar = createAvatarEl(nick, url);
    // Add context class for CSS sizing.
    if (ctx === "msg")   avatar.classList.add("tl-avatar-msg");
    if (ctx === "whois") avatar.classList.add("tl-avatar-whois");
    target.insertBefore(avatar, target.firstChild);
  }

  // ── Fetch queue ─────────────────────────────────────────────────────

  function enqueue(nick) {
    var key = nick.toLowerCase();
    // Don't enqueue duplicates or cached nicks.
    if (cache[key]) return;
    // Check if already in queue.
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].key === key) return;
    }
    queue.push({ nick: nick, key: key });
    drainQueue();
  }

  function drainQueue() {
    while (activeCount < MAX_CONCURRENT && queue.length > 0) {
      var item = queue.shift();
      doFetch(item.nick, item.key);
    }
  }

  function doFetch(nick, key) {
    activeCount++;

    var apiUrl = API_PATH + "?account=" + encodeURIComponent(nick);
    fetch(apiUrl)
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        var url = (data && data.avatar_url) ? data.avatar_url : null;

        // Skip default/static avatars.
        if (url && url.indexOf("/static/") === 0) {
          url = null;
        }

        cache[key] = { url: url, ts: Date.now() };

        if (url) {
          injectAllForNick(nick, url);
        }
      })
      .catch(function () {
        cache[key] = { url: null, ts: Date.now() };
      })
      .finally(function () {
        activeCount--;
        drainQueue();
      });
  }

  // ── Scanning ────────────────────────────────────────────────────────

  function processUserElement(el) {
    var nick = el.getAttribute("data-name");
    if (!nick) return;

    // Skip services.
    if (isServiceNick(nick)) return;

    var ctx = getContext(el);
    if (ctx === "other") return;

    var key = nick.toLowerCase();
    var cached = cache[key];

    // Check the injection target for existing avatar.
    var container;
    if (ctx === "msg") {
      container = el.closest(".from") || el;
    } else if (ctx === "whois") {
      container = el.parentElement || el;
    } else {
      container = el;
    }
    var existing = container.querySelector(".tl-avatar");
    if (existing) {
      var existingNick = existing.getAttribute("data-nick");
      if (existingNick === nick) return; // correct avatar already shown
      // Wrong avatar — remove it.
      existing.parentNode.removeChild(existing);
    }

    if (cached) {
      if (cached.url) {
        // Positive cache hit — inject immediately.
        injectAvatar(el, nick, cached.url);
        return;
      }
      // Negative cache hit — skip until expired.
      if (Date.now() - cached.ts < NEGATIVE_TTL) {
        return;
      }
      // Expired negative — remove from cache so it gets re-fetched.
      delete cache[key];
    }

    // Enqueue for fetching.
    enqueue(nick);
  }

  function scanAll() {
    // Scan ALL .user elements in the chat area — getContext() filters
    // them into nicklist / msg / whois / other automatically.
    var all = document.querySelectorAll("#chat .user[data-name]");
    for (var i = 0; i < all.length; i++) {
      processUserElement(all[i]);
    }
  }

  // Leading + trailing edge throttle: run scanAll immediately on first
  // mutation (leading edge), then once more after mutations settle
  // (trailing edge).  This covers both the initial DOM swap and any
  // elements Vue renders slightly later.
  var throttleTimer = null;
  var trailingTimer = null;
  var THROTTLE_MS = 120;
  var TRAILING_MS = 250;

  var observer = new MutationObserver(function () {
    // Leading edge — fire immediately on first mutation in the window.
    if (!throttleTimer) {
      scanAll();
      throttleTimer = setTimeout(function () {
        throttleTimer = null;
      }, THROTTLE_MS);
    }
    // Trailing edge — always reschedule so we catch late renders.
    clearTimeout(trailingTimer);
    trailingTimer = setTimeout(scanAll, TRAILING_MS);
  });

  // Detect channel / window switches via sidebar clicks and hash changes.
  function onNavigate() {
    // Small delay to let Vue finish rendering the new view.
    setTimeout(scanAll, 80);
    setTimeout(scanAll, 300);
  }

  function init() {
    var app = document.getElementById("app");
    if (!app) {
      setTimeout(init, 250);
      return;
    }

    observer.observe(app, { childList: true, subtree: true });

    // Navigation-aware scanning.
    window.addEventListener("hashchange", onNavigate);

    // Catch sidebar clicks (channels, PMs, etc.).
    var sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.addEventListener("click", function () {
        setTimeout(scanAll, 100);
        setTimeout(scanAll, 400);
      });
    }

    scanAll();
    setInterval(scanAll, SCAN_INTERVAL);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }
})();

/**
 * IRC4Fun — Logo replacement
 *
 * Swaps all The Lounge logo images with irc4fun-logo.png.
 */
(function () {
  "use strict";
  var LOGO_SRC = "img/irc4fun-logo.png";

  function replaceLogo(img) {
    if (img.src.indexOf(LOGO_SRC) !== -1) return;
    img.src = LOGO_SRC;
    img.style.objectFit = "contain";
  }

  function scanLogos() {
    document.querySelectorAll("img.logo, img.logo-inverted").forEach(replaceLogo);
  }

  var obs = new MutationObserver(scanLogos);
  function initLogos() {
    var app = document.getElementById("app");
    if (!app) { setTimeout(initLogos, 250); return; }
    obs.observe(app, { childList: true, subtree: true });
    scanLogos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(initLogos, 300); });
  } else {
    setTimeout(initLogos, 300);
  }
})();
