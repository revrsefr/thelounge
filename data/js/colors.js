/**
 * IRC4Fun — Color Settings for The Lounge
 *
 * Adds a "Colors" section to the Settings page with toggles and
 * color pickers for the IRC4Fun theme.  Preferences are stored in
 * localStorage and applied as CSS variable overrides.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "irc4fun-color-settings";
  var SYNC_TAG = "IRC4FUN_COLORS";

  // ── Default values (match the irc4fun.css theme) ──────────────────
  var DEFAULTS = {
    coloredNicks:      true,
    nickBold:          false,
    timestampColor:    "#64748b",
    linkColor:         "#5aa5ff",
    joinColor:         "#4ade80",
    partColor:         "#f87171",
    quitColor:         "#f87171",
    actionColor:       "#fbbf24",
    noticeColor:       "#5aa5ff",
    highlightBg:       "#1c2d4a",
    highlightBorder:   "#0076f9",
    unreadMarker:      "#ef4444",
    dateMarker:        "#14b8a6",
    bgColor:           "#0f1115",
    windowBg:          "#1a1e25",
    sidebarBg:         "#0c0e12",
    textColor:         "#e4e7eb",
    mutedColor:        "#8a94a8",
    inputBg:           "#11141a",
    borderColor:       "#2a3545",
    accentColor:       "#0076f9",
  };

  // ── Load / Save ───────────────────────────────────────────────────
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        return Object.assign({}, DEFAULTS, saved);
      }
      // No localStorage — try to restore from server-synced userStyles.
      var fromServer = loadFromUserStyles();
      if (fromServer) return Object.assign({}, DEFAULTS, fromServer);
      return Object.assign({}, DEFAULTS);
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function save(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  // ── Server sync via userStyles ────────────────────────────────────
  // We embed a JSON comment block inside The Lounge's Custom CSS field
  // (userStyles), which syncs to the server automatically.  This lets
  // color choices travel between devices.

  /** Extract our color settings from the userStyles CSS string. */
  function parseTagFromCSS(css) {
    var re = new RegExp("/\\*\\s*" + SYNC_TAG + ":\\s*([\\s\\S]*?)\\s*\\*/");
    var m = css.match(re);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch (e) { return null; }
  }

  /** Read userStyles from the DOM (the live <style> element). */
  function loadFromUserStyles() {
    var el = document.getElementById("user-specified-css");
    if (!el) return null;
    return parseTagFromCSS(el.innerHTML || "");
  }

  /** Build a CSS string with our settings embedded as a comment. */
  function buildSyncCSS(existingCSS) {
    // Strip any old tag from existing CSS.
    var re = new RegExp("/\\*\\s*" + SYNC_TAG + ":[\\s\\S]*?\\*/\\s*");
    var clean = (existingCSS || "").replace(re, "").trim();
    var tag = "/* " + SYNC_TAG + ": " + JSON.stringify(settings) + " */";
    return clean ? tag + "\n" + clean : tag;
  }

  /** Push color settings into userStyles and trigger The Lounge's sync. */
  function syncToServer() {
    var textarea = document.querySelector('textarea[name="userStyles"]');
    if (!textarea) return false;

    var newCSS = buildSyncCSS(textarea.value);

    // Set the value via the native setter so Vue detects the change.
    var nativeSet = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, "value"
    ).set;
    nativeSet.call(textarea, newCSS);

    // Dispatch input + change events so Vue's v-model + onChange fire.
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  var settings = load();

  // ── Apply to DOM ──────────────────────────────────────────────────
  function applyAll() {
    var root = document.documentElement;

    // CSS variable overrides
    root.style.setProperty("--body-bg-color", settings.bgColor);
    root.style.setProperty("--body-color", settings.textColor);
    root.style.setProperty("--body-color-muted", settings.mutedColor);
    root.style.setProperty("--window-bg-color", settings.windowBg);
    root.style.setProperty("--link-color", settings.linkColor);
    root.style.setProperty("--highlight-bg-color", settings.highlightBg);
    root.style.setProperty("--highlight-border-color", settings.highlightBorder);
    root.style.setProperty("--unread-marker-color", settings.unreadMarker);
    root.style.setProperty("--date-marker-color", settings.dateMarker);
    root.style.setProperty("--button-color", settings.accentColor);
    root.style.setProperty("--upload-progressbar-color", settings.accentColor);

    // Build dynamic stylesheet for non-variable overrides
    var style = document.getElementById("irc4fun-color-overrides");
    if (!style) {
      style = document.createElement("style");
      style.id = "irc4fun-color-overrides";
      document.head.appendChild(style);
    }

    var css = "";

    // Colored nicks toggle
    if (!settings.coloredNicks) {
      css += "#chat .user[class*='color-'] { color: " + settings.textColor + " !important; }\n";
    }

    // Bold nicks
    if (settings.nickBold) {
      css += "#chat .msg .from .user { font-weight: 700 !important; }\n";
    }

    // Timestamps
    css += "#chat .time { color: " + settings.timestampColor + " !important; }\n";

    // Join / Part / Quit / Action / Notice
    css += "#chat .msg[data-type='join'] .content { color: " + settings.joinColor + " !important; }\n";
    css += "#chat .msg[data-type='part'] .content { color: " + settings.partColor + " !important; }\n";
    css += "#chat .msg[data-type='quit'] .content { color: " + settings.quitColor + " !important; }\n";
    css += "#chat .msg[data-type='action'] .content { color: " + settings.actionColor + " !important; }\n";
    css += "#chat .msg[data-type='notice'] .content { color: " + settings.noticeColor + " !important; }\n";

    // Sidebar / Input / Border
    css += "#sidebar { background: " + settings.sidebarBg + " !important; }\n";
    css += "#form { background-color: " + settings.inputBg + " !important; }\n";
    css += "#form { border-top-color: " + settings.borderColor + " !important; }\n";
    css += "#chat .content { border-left-color: " + settings.borderColor + " !important; }\n";
    css += "#chat .header { border-bottom-color: " + settings.borderColor + " !important; }\n";
    css += "#chat .userlist { border-left-color: " + settings.borderColor + " !important; }\n";

    // Accent color for buttons, badges, etc.
    css += ".btn { border-color: " + settings.accentColor + " !important; color: " + settings.accentColor + " !important; background: transparent !important; }\n";
    css += ".btn:hover, .btn:focus { background: " + settings.accentColor + " !important; color: #fff !important; }\n";
    css += ".irc4fun-sync-btn { color: #fff !important; }\n";
    css += ".irc4fun-sync-btn:hover, .irc4fun-sync-btn:focus { background: " + settings.accentColor + " !important; color: #fff !important; }\n";
    css += "#form #nick { color: " + settings.accentColor + " !important; }\n";

    style.textContent = css;
  }

  // ── Settings UI ───────────────────────────────────────────────────

  // Setting definitions: [key, label, type]
  var SETTING_GROUPS = [
    {
      title: "Nicknames",
      items: [
        ["coloredNicks", "Colored nicks", "toggle"],
        ["nickBold", "Bold nicks", "toggle"],
      ]
    },
    {
      title: "Messages",
      items: [
        ["timestampColor", "Timestamp", "color"],
        ["linkColor", "Links", "color"],
        ["joinColor", "Join messages", "color"],
        ["partColor", "Part messages", "color"],
        ["quitColor", "Quit messages", "color"],
        ["actionColor", "Action (/me)", "color"],
        ["noticeColor", "Notices", "color"],
      ]
    },
    {
      title: "Highlights & Markers",
      items: [
        ["highlightBg", "Highlight background", "color"],
        ["highlightBorder", "Highlight border", "color"],
        ["unreadMarker", "Unread marker", "color"],
        ["dateMarker", "Date marker", "color"],
      ]
    },
    {
      title: "Interface",
      items: [
        ["bgColor", "Page background", "color"],
        ["windowBg", "Chat background", "color"],
        ["sidebarBg", "Sidebar background", "color"],
        ["inputBg", "Input background", "color"],
        ["textColor", "Text color", "color"],
        ["mutedColor", "Muted text", "color"],
        ["borderColor", "Borders", "color"],
        ["accentColor", "Accent / buttons", "color"],
      ]
    },
  ];

  function buildUI() {
    // Find the settings container
    var settingsEl = document.getElementById("settings");
    if (!settingsEl) return false;

    // Don't inject twice
    if (document.getElementById("irc4fun-colors-section")) return true;

    // Insert inside the scrollable form/content area, not after it.
    // The Lounge settings page: #settings > .header + form (or direct children).
    // We need to append inside the form or the last scrollable child.
    var target = settingsEl.querySelector("form")
      || settingsEl.querySelector(".opt-list")
      || settingsEl.querySelector(".settings-content")
      || settingsEl;

    var section = document.createElement("div");
    section.id = "irc4fun-colors-section";
    section.style.cssText = "padding: 12px 16px; margin-top: 16px; border-top: 1px solid " + settings.borderColor + "; position: relative; z-index: 0; clear: both;";

    var heading = document.createElement("h2");
    heading.textContent = "Colors";
    heading.style.cssText = "color: " + settings.accentColor + "; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;";
    section.appendChild(heading);

    SETTING_GROUPS.forEach(function (group) {
      var gh = document.createElement("h3");
      gh.textContent = group.title;
      gh.style.cssText = "color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06);";
      section.appendChild(gh);

      group.items.forEach(function (item) {
        var key = item[0], label = item[1], type = item[2];
        var row = document.createElement("div");
        row.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 6px 0; gap: 12px;";

        var lbl = document.createElement("label");
        lbl.textContent = label;
        lbl.style.cssText = "color: #e4e7eb; font-size: 13px; white-space: nowrap;";
        row.appendChild(lbl);

        if (type === "toggle") {
          var toggleWrap = document.createElement("label");
          toggleWrap.style.cssText = "position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0;";

          var cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!settings[key];
          cb.style.cssText = "opacity: 0; width: 0; height: 0;";

          var slider = document.createElement("span");
          slider.style.cssText = "position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #2a3545; border-radius: 22px; transition: .2s;";

          var knob = document.createElement("span");
          knob.style.cssText = "position: absolute; content: ''; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: #fff; border-radius: 50%; transition: .2s;";
          if (cb.checked) {
            slider.style.backgroundColor = settings.accentColor;
            knob.style.transform = "translateX(18px)";
          }

          slider.appendChild(knob);
          toggleWrap.appendChild(cb);
          toggleWrap.appendChild(slider);

          cb.addEventListener("change", function () {
            settings[key] = cb.checked;
            slider.style.backgroundColor = cb.checked ? settings.accentColor : "#2a3545";
            knob.style.transform = cb.checked ? "translateX(18px)" : "translateX(0)";
            save(settings);
            applyAll();
          });

          row.appendChild(toggleWrap);

        } else if (type === "color") {
          var colorWrap = document.createElement("div");
          colorWrap.style.cssText = "display: flex; align-items: center; gap: 8px; flex-shrink: 0;";

          var swatch = document.createElement("input");
          swatch.type = "color";
          swatch.value = settings[key];
          swatch.style.cssText = "width: 32px; height: 24px; border: 1px solid #2a3545; border-radius: 4px; background: none; cursor: pointer; padding: 0;";

          var hex = document.createElement("input");
          hex.type = "text";
          hex.value = settings[key];
          hex.maxLength = 7;
          hex.style.cssText = "width: 72px; background: #14171e; border: 1px solid #2a3545; border-radius: 4px; color: #e4e7eb; font-size: 12px; font-family: monospace; padding: 3px 6px; text-align: center;";

          swatch.addEventListener("input", function () {
            settings[key] = swatch.value;
            hex.value = swatch.value;
            save(settings);
            applyAll();
          });

          hex.addEventListener("change", function () {
            var v = hex.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
              settings[key] = v;
              swatch.value = v;
              save(settings);
              applyAll();
            } else {
              hex.value = settings[key];
            }
          });

          colorWrap.appendChild(swatch);
          colorWrap.appendChild(hex);
          row.appendChild(colorWrap);
        }

        section.appendChild(row);
      });
    });

    // Sync button
    var btnRow = document.createElement("div");
    btnRow.style.cssText = "margin-top: 20px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 10px; justify-content: center;";

    var syncBtn = document.createElement("button");
    syncBtn.textContent = "Save & Sync";
    syncBtn.className = "btn irc4fun-sync-btn";
    syncBtn.style.cssText = "font-size: 13px; padding: 6px 16px; background: transparent; color: #fff; border: 1px solid " + settings.accentColor + "; cursor: pointer;";
    syncBtn.addEventListener("click", function () {
      save(settings);
      var ok = syncToServer();
      if (ok) {
        syncBtn.textContent = "\u2713 Synced!";
        syncBtn.style.background = "#0d9488";
        syncBtn.style.borderColor = "#0d9488";
        syncBtn.style.color = "#fff";
        setTimeout(function () {
          syncBtn.textContent = "Save & Sync";
          syncBtn.style.background = "transparent";
          syncBtn.style.borderColor = settings.accentColor;
          syncBtn.style.color = "#fff";
        }, 2000);
      } else {
        syncBtn.textContent = "\u2717 Open Settings first";
        setTimeout(function () { syncBtn.textContent = "Save & Sync"; }, 2000);
      }
    });
    btnRow.appendChild(syncBtn);

    // Reset button
    var resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset to Defaults";
    resetBtn.className = "btn";
    resetBtn.style.cssText = "font-size: 13px; padding: 6px 16px;";
    resetBtn.addEventListener("click", function () {
      settings = Object.assign({}, DEFAULTS);
      save(settings);
      applyAll();
      // Remove and rebuild UI to refresh all inputs
      var existing = document.getElementById("irc4fun-colors-section");
      if (existing) existing.remove();
      buildUI();
    });
    btnRow.appendChild(resetBtn);
    section.appendChild(btnRow);

    target.appendChild(section);
    return true;
  }

  // ── Watch for settings page ───────────────────────────────────────
  function tryInject() {
    buildUI();
  }

  function init() {
    // Apply colors immediately
    applyAll();

    var app = document.getElementById("app");
    if (!app) {
      setTimeout(init, 300);
      return;
    }

    // Watch for settings page appearing
    var observer = new MutationObserver(function () {
      if (document.getElementById("settings") && !document.getElementById("irc4fun-colors-section")) {
        // Small delay to let The Lounge finish rendering
        setTimeout(tryInject, 100);
      }
    });
    observer.observe(app, { childList: true, subtree: true });

    // Also try on hashchange (settings URL)
    window.addEventListener("hashchange", function () {
      setTimeout(tryInject, 200);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(init, 300);
    });
  } else {
    setTimeout(init, 300);
  }
})();
