/**
 * Knowledge Tutor — Plugin runtime (CSS + mount)
 * Single source of truth for Creator preview and exported tutors.
 * Edit this file freely; keep it next to knowledge-creator-v2.html.
 */
(function (global) {
  "use strict";

  var CSS_ID = "kp-plugins-css";
  var CSS_TEXT = [
    ".kp{border:1px dashed var(--border,#334155);border-radius:12px;padding:14px;margin:12px 0;background:color-mix(in srgb,var(--card,#1e293b) 85%,transparent)}",
    ".kp-label{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#94a3b8);margin-bottom:10px}",
    ".kp-toggle,.kp-choice,.kp-check{display:inline-block;margin:4px 4px 0 0;padding:8px 12px;border-radius:8px;border:1px solid var(--border,#334155);background:transparent;color:inherit;cursor:pointer;font:inherit}",
    ".kp-toggle:hover,.kp-choice:hover{border-color:var(--accent,#38bdf8)}",
    ".kp-panel{margin-top:10px}",
    ".kp-panel[hidden]{display:none!important}",
    /* Reveal equation / hint text */
    ".kp-reveal-text{margin:8px 0 12px;padding:12px 14px;border-radius:10px;border:1px solid var(--border,#334155);background:color-mix(in srgb,var(--bg,#0f172a) 40%,var(--card,#1e293b));line-height:1.5}",
    /* Flip grids */
    ".kp-flip-grid{display:grid;gap:16px;margin-top:4px}",
    ".kp-flip-grid[data-layout=\"1\"]{grid-template-columns:1fr;max-width:360px}",
    ".kp-flip-grid[data-layout=\"2\"]{grid-template-columns:1fr 1fr}",
    ".kp-flip-grid[data-layout=\"4\"]{grid-template-columns:1fr 1fr}",
    ".kp-flip-grid[data-layout=\"6\"]{grid-template-columns:1fr 1fr}",
    ".kp-flip-grid[data-layout=\"1x1\"]{grid-template-columns:1fr;max-width:360px}",
    ".kp-flip-grid[data-layout=\"2x2\"],.kp-flip-grid[data-layout=\"3\"],.kp-flip-grid[data-layout=\"4x4\"],.kp-flip-grid[data-layout=\"6x6\"]{grid-template-columns:1fr 1fr}",
    "@media(max-width:520px){.kp-flip-grid[data-layout=\"2\"],.kp-flip-grid[data-layout=\"4\"],.kp-flip-grid[data-layout=\"6\"]{grid-template-columns:1fr}}",
    ".kp-flip-card{perspective:1200px;cursor:pointer;min-height:100px;outline:none}",
    ".kp-flip-card:focus-visible{outline:2px solid var(--accent,#38bdf8);outline-offset:3px;border-radius:14px}",
    ".kp-flip-inner{position:relative;transition:transform .45s cubic-bezier(.4,.2,.2,1),box-shadow .35s ease;transform-style:preserve-3d;min-height:110px;border-radius:14px;box-shadow:0 2px 4px rgba(0,0,0,.08),0 8px 20px rgba(0,0,0,.16),0 0 0 1px color-mix(in srgb,var(--border,#334155) 80%,transparent)}",
    ".kp-flip-card:hover .kp-flip-inner{box-shadow:0 6px 12px rgba(0,0,0,.12),0 18px 40px rgba(0,0,0,.22),0 0 0 1px var(--accent,#38bdf8);transform:translateY(-3px)}",
    ".kp-flip-card.flipped .kp-flip-inner{transform:rotateY(180deg);box-shadow:0 8px 16px rgba(0,0,0,.14),0 22px 48px rgba(0,0,0,.28)}",
    ".kp-flip-card.flipped:hover .kp-flip-inner{transform:rotateY(180deg) translateY(-3px)}",
    ".kp-face{backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:14px;padding:16px 14px;min-height:110px;background:var(--card,#1e293b);color:var(--text,#e2e8f0);display:flex;align-items:center;justify-content:center;text-align:center;font-size:.95rem;line-height:1.35}",
    ".kp-face.kp-front{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent,#38bdf8) 25%,transparent)}",
    ".kp-face.kp-back{position:absolute;inset:0;transform:rotateY(180deg);background:color-mix(in srgb,var(--accent,#38bdf8) 12%,var(--card,#1e293b));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent,#38bdf8) 40%,transparent)}",
    ".kp-flip{perspective:1200px;min-height:110px;cursor:pointer}",
    ".kp-flip > .kp-flip-inner{position:relative;transition:transform .45s cubic-bezier(.4,.2,.2,1),box-shadow .35s ease;transform-style:preserve-3d;min-height:110px;border-radius:14px;box-shadow:0 2px 4px rgba(0,0,0,.08),0 8px 20px rgba(0,0,0,.16)}",
    ".kp-flip.flipped > .kp-flip-inner{transform:rotateY(180deg)}",
    /* Folder-style tabs */
    ".kp-tabs-shell{margin-top:4px}",
    ".kp-tabs{display:flex;flex-wrap:wrap;gap:0;align-items:flex-end;border-bottom:2px solid var(--border,#334155);padding:0 4px 0 0;margin:0}",
    ".kp-tab{position:relative;bottom:-2px;margin:0 2px 0 0;padding:10px 16px 9px;border:2px solid var(--border,#334155);border-bottom:none;border-radius:10px 10px 0 0;background:color-mix(in srgb,var(--border,#334155) 35%,var(--card,#1e293b));color:var(--muted,#94a3b8);cursor:pointer;font:inherit;font-weight:600;font-size:.9rem;line-height:1.2;transition:background .15s,color .15s,box-shadow .15s}",
    ".kp-tab:hover{color:var(--text,#e2e8f0);background:color-mix(in srgb,var(--accent,#38bdf8) 12%,var(--card,#1e293b))}",
    ".kp-tab.on{background:var(--card,#1e293b);color:var(--text,#e2e8f0);border-color:var(--border,#334155);box-shadow:0 -2px 0 var(--accent,#38bdf8) inset;z-index:1}",
    ".kp-tabs-panels{border:2px solid var(--border,#334155);border-top:none;border-radius:0 0 12px 12px;background:var(--card,#1e293b);padding:16px 16px 18px;min-height:72px}",
    ".kp-tabs-panels > .kp-panel{margin:0}",
    ".kp-tabs-panels > .kp-panel[hidden]{display:none!important}",
    /* Stacked accordion with separators + open animation */
    ".kp-acc{display:flex;flex-direction:column;gap:0;margin-top:4px;border:1px solid var(--border,#334155);border-radius:12px;overflow:hidden}",
    ".kp-acc-item{border-bottom:1px solid var(--border,#334155);background:var(--card,#1e293b)}",
    ".kp-acc-item:last-child{border-bottom:none}",
    ".kp-acc-head{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;margin:0;border:none;background:transparent;color:var(--text,#e2e8f0);font:inherit;font-weight:600;text-align:left;cursor:pointer}",
    ".kp-acc-head:hover{background:color-mix(in srgb,var(--accent,#38bdf8) 10%,transparent)}",
    ".kp-acc-head::after{content:\"▸\";color:var(--muted,#94a3b8);transition:transform .25s ease;flex-shrink:0}",
    ".kp-acc-item.open .kp-acc-head::after{transform:rotate(90deg);color:var(--accent,#38bdf8)}",
    ".kp-acc-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s ease}",
    ".kp-acc-item.open .kp-acc-body{grid-template-rows:1fr}",
    ".kp-acc-body-inner{overflow:hidden;min-height:0}",
    ".kp-acc-body-inner > *{padding:0 16px 14px;margin:0}",
    ".kp-match{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
    ".kp-choice.picked{outline:2px solid var(--accent,#38bdf8)}",
    ".kp-choice.good{outline:2px solid var(--success,#4ade80)}",
    ".kp-choice.bad{outline:2px solid var(--danger,#f87171)}",
    ".kp-blank{display:inline-block;min-width:90px;margin:0 4px;padding:2px 6px;border:none;border-bottom:2px solid var(--accent,#38bdf8);background:transparent;color:inherit;font:inherit}",
    ".kp-status{margin-top:8px;font-size:.85rem;color:var(--muted,#94a3b8)}"
  ].join("\n");

  function injectCss() {
    if (typeof document === "undefined") return;
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = CSS_TEXT;
    (document.head || document.documentElement).appendChild(style);
  }

  var KP = global.KP || { registry: {}, register: function (p) { this.registry[p.id] = p; } };
  global.KP = KP;

  function mountFlip(el) {
    // Grid of cards
    var cards = el.querySelectorAll(".kp-flip-card");
    if (cards.length) {
      cards.forEach(function (card) {
        if (card.dataset.kpFlipWired) return;
        card.dataset.kpFlipWired = "1";
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", "Flip card");
        function toggle() {
          card.classList.toggle("flipped");
        }
        card.addEventListener("click", function (e) {
          e.preventDefault();
          toggle();
        });
        card.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        });
      });
      return;
    }
    // Legacy single .kp-flip root
    if (el.classList.contains("kp-flip") || el.querySelector(".kp-flip-inner")) {
      el.addEventListener("click", function () {
        el.classList.toggle("flipped");
      });
    }
  }

  KP.register({
    id: "interactives",
    name: "Interactives",
    mount: function (el, widget) {
      if (el.dataset.kpMounted) return;
      el.dataset.kpMounted = "1";
      widget = widget || el.getAttribute("data-widget");
      if (widget === "reveal") {
        var btn = el.querySelector(".kp-toggle");
        var panel = el.querySelector(".kp-panel");
        if (btn && panel) {
          btn.addEventListener("click", function () {
            var hide = !panel.hasAttribute("hidden");
            if (hide) panel.setAttribute("hidden", "");
            else panel.removeAttribute("hidden");
            btn.textContent = hide ? (btn.dataset.show || "Show") : (btn.dataset.hide || "Hide");
          });
        }
      }
      if (widget === "flip") {
        mountFlip(el);
      }
      if (widget === "tabs") {
        var tabs = [].slice.call(el.querySelectorAll(".kp-tab"));
        var panelRoot = el.querySelector(".kp-tabs-panels") || el;
        var panels = [].slice.call(panelRoot.querySelectorAll(":scope > .kp-panel, .kp-panel"));
        // Prefer direct children of panels shell
        var direct = el.querySelector(".kp-tabs-panels");
        if (direct) panels = [].slice.call(direct.children).filter(function (n) { return n.classList && n.classList.contains("kp-panel"); });
        function show(i) {
          tabs.forEach(function (t, n) { t.classList.toggle("on", n === i); });
          panels.forEach(function (p, n) {
            if (n === i) p.removeAttribute("hidden");
            else p.setAttribute("hidden", "");
          });
        }
        tabs.forEach(function (t, i) {
          t.addEventListener("click", function () { show(i); });
        });
        show(0);
      }
      if (widget === "accordion") {
        // New stacked items
        var items = [].slice.call(el.querySelectorAll(".kp-acc-item"));
        if (items.length) {
          items.forEach(function (item) {
            var head = item.querySelector(".kp-acc-head");
            if (!head || head.dataset.kpAccWired) return;
            head.dataset.kpAccWired = "1";
            head.addEventListener("click", function () {
              var was = item.classList.contains("open");
              // optional: close others for cleaner single-open
              items.forEach(function (x) { x.classList.remove("open"); });
              if (!was) item.classList.add("open");
            });
          });
        } else {
          // Legacy toggle + panel
          el.querySelectorAll(".kp-toggle").forEach(function (b) {
            b.addEventListener("click", function () {
              var panel = b.nextElementSibling;
              if (!panel) return;
              var open = !panel.hasAttribute("hidden");
              if (open) panel.setAttribute("hidden", "");
              else panel.removeAttribute("hidden");
            });
          });
        }
      }
    }
  });

  KP.register({
    id: "games",
    name: "Learning games",
    mount: function (el, widget) {
      if (el.dataset.kpMounted) return;
      el.dataset.kpMounted = "1";
      widget = widget || el.getAttribute("data-widget");
      function status() { return el.querySelector(".kp-status"); }
      if (widget === "order") {
        var items = [].slice.call(el.querySelectorAll(".kp-choice"));
        var next = 1;
        items.forEach(function (b) {
          b.addEventListener("click", function () {
            var n = parseInt(b.dataset.order, 10);
            if (n === next) {
              b.classList.add("good");
              b.disabled = true;
              next++;
              if (status()) status().textContent = next > items.length ? "Correct order!" : "Next...";
            } else {
              b.classList.add("bad");
              setTimeout(function () { b.classList.remove("bad"); }, 400);
              if (status()) status().textContent = "Not that one yet.";
            }
          });
        });
      }
      if (widget === "match") {
        var left = [].slice.call(el.querySelectorAll("[data-side=l]"));
        var right = [].slice.call(el.querySelectorAll("[data-side=r]"));
        var pick = null, found = 0, total = left.length;
        function clearPicked() {
          el.querySelectorAll(".picked").forEach(function (x) { x.classList.remove("picked"); });
        }
        function onPick(b) {
          if (b.classList.contains("good")) return;
          if (!pick) { clearPicked(); b.classList.add("picked"); pick = b; return; }
          if (pick === b) { pick = null; clearPicked(); return; }
          if (pick.dataset.pair === b.dataset.pair && pick !== b) {
            pick.classList.add("good"); b.classList.add("good"); found++;
            pick = null; clearPicked();
            if (status()) status().textContent = found >= total ? "All matched!" : (found + " matched");
          } else {
            b.classList.add("bad"); pick.classList.add("bad");
            var a = pick, c = b; pick = null; clearPicked();
            setTimeout(function () { a.classList.remove("bad"); c.classList.remove("bad"); }, 450);
            if (status()) status().textContent = "Not a pair.";
          }
        }
        left.concat(right).forEach(function (b) {
          b.addEventListener("click", function () { onPick(b); });
        });
      }
      if (widget === "blank") {
        var check = el.querySelector(".kp-check");
        if (!check) return;
        check.addEventListener("click", function () {
          var ok = 0, n = 0;
          el.querySelectorAll(".kp-blank").forEach(function (inp) {
            n++;
            var answers = (inp.dataset.answers || "").split("|").map(function (s) {
              return s.trim().toLowerCase();
            }).filter(Boolean);
            var val = (inp.value || "").trim().toLowerCase();
            var good = answers.indexOf(val) >= 0;
            inp.style.borderBottomColor = good ? "var(--success)" : "var(--danger)";
            if (good) ok++;
          });
          if (status()) status().textContent = ok + " / " + n + " correct";
        });
      }
    }
  });

  KP.mountAll = function (root) {
    if (!root) return;
    root.querySelectorAll("[data-kp]").forEach(function (el) {
      var plug = KP.registry[el.getAttribute("data-kp")];
      if (plug && plug.mount) plug.mount(el, el.getAttribute("data-widget"));
    });
  };

  /** Card counts for flip layouts */
  KP.FLIP_LAYOUTS = {
    "1": { count: 1, label: "1 — single card" },
    "2": { count: 2, label: "2 — side by side" },
    "4": { count: 4, label: "4 — 2×2 grid" },
    "6": { count: 6, label: "6 — 3 rows × 2 cols" }
  };

  injectCss();
  global.KP_PLUGINS_LOADED = true;
})(typeof window !== "undefined" ? window : this);
