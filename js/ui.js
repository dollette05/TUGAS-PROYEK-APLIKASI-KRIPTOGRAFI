/*
 * ui.js
 * -------------------------------------------------------
 * Modul UI & UX Terpadu:
 * 1. Pengaturan Tema (Dark Mode / Light Mode) dengan persistensi localStorage
 * 2. Visual Password Toggle (Show/Hide) dengan sinkronisasi ikon SVG
 * 3. Feedback Salin Kunci/Cipherteks ke Clipboard
 * 4. Telemetri Status Keamanan Lokal
 * -------------------------------------------------------
 */

(function () {
  "use strict";

  // ======================================================
  // 1. MANAJEMEN TEMA (DARK / LIGHT MODE)
  // ======================================================
  var THEME_KEY = "brankas-theme";

  function getPreferredTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* Silently ignore storage quota or privacy mode errors */
    }
    updateThemeToggleIcon(theme);
  }

  function updateThemeToggleIcon(theme) {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;
    btn.setAttribute("aria-label", theme === "dark" ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap");
    btn.setAttribute("title", theme === "dark" ? "Mode Terang" : "Mode Gelap");
  }

  function initTheme() {
    var current = getPreferredTheme();
    applyTheme(current);

    var btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var now = document.documentElement.getAttribute("data-theme") || "dark";
        var next = now === "dark" ? "light" : "dark";
        applyTheme(next);
      });
    }

    // Dengarkan perubahan preferensi OS jika user belum memilih secara manual
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function (e) {
        if (!localStorage.getItem(THEME_KEY)) {
          applyTheme(e.matches ? "light" : "dark");
        }
      });
    }
  }

  // ======================================================
  // 2. TOGGLE VISIBILITAS KATA SANDI (Show/Hide)
  // ======================================================
  function initPasswordToggles() {
    document.querySelectorAll(".pw-toggle").forEach(function (btn) {
      var targetId = btn.getAttribute("data-target");
      var input = targetId ? document.getElementById(targetId) : null;

      function updateIcon(isText) {
        if (isText) {
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>`;
          btn.setAttribute("aria-label", "Sembunyikan kata sandi");
        } else {
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>`;
          btn.setAttribute("aria-label", "Tampilkan kata sandi");
        }
      }

      updateIcon(input && input.type === "text");

      btn.addEventListener("click", function () {
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
        updateIcon(input.type === "text");
      });
    });
  }

  // ======================================================
  // 2b. METER KEKUATAN KATA SANDI (murni hitungan lokal ringan)
  // ======================================================
  function scorePassword(pw) {
    if (!pw) return -1;
    var lenPts = pw.length >= 16 ? 3 : pw.length >= 12 ? 2 : pw.length >= 8 ? 1 : 0;
    var variety = 0;
    if (/[a-z]/.test(pw)) variety++;
    if (/[A-Z]/.test(pw)) variety++;
    if (/[0-9]/.test(pw)) variety++;
    if (/[^a-zA-Z0-9]/.test(pw)) variety++;
    return lenPts + variety; // 0-7
  }

  function initPasswordMeters() {
    document.querySelectorAll(".pw-meter").forEach(function (meter) {
      var input = document.getElementById(meter.getAttribute("data-for"));
      var bar = meter.querySelector(".pw-meter-bar span");
      var label = meter.querySelector(".pw-meter-label");
      if (!input || !bar || !label) return;

      var bands = [
        { max: 2, text: "Lemah", color: "var(--danger)" },
        { max: 4, text: "Cukup", color: "var(--warning)" },
        { max: 6, text: "Kuat", color: "var(--success)" },
        { max: 7, text: "Sangat kuat", color: "var(--primary)" },
      ];

      function render() {
        var score = scorePassword(input.value);
        if (score < 0) {
          bar.style.width = "0%";
          label.textContent = "";
          return;
        }
        var band = bands[0];
        for (var i = 0; i < bands.length; i++) {
          if (score <= bands[i].max) { band = bands[i]; break; }
          band = bands[i];
        }
        bar.style.width = Math.round((score / 7) * 100) + "%";
        bar.style.background = band.color;
        bar.style.boxShadow = "none";
        label.textContent = band.text;
        label.style.color = band.color;
      }

      input.addEventListener("input", render);
      render();
    });
  }

  // ======================================================
  // 2c. PIL GESER SEGMENTED CONTROL (GCM/CBC, Teks/Berkas, dll.)
  // Hanya menggerakkan indikator; state aktif tetap diatur
  // oleh handler masing-masing halaman (main.js / testing-app.js).
  // ======================================================
  function initSegmented() {
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.querySelectorAll(".algo-toggle, .mode-toggle").forEach(function (bar) {
      var thumb = bar.querySelector(".seg-thumb");
      if (!thumb) return;
      var btns = Array.prototype.slice.call(bar.querySelectorAll(".algo-btn, .mode-btn"));
      if (!btns.length) return;
      var placed = false;

      function place(active) {
        // Tanpa animasi: posisi awal & mode hemat-gerak
        if (window.gsap && !reduceMotion) {
          gsap.set(thumb, { x: active.offsetLeft, y: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight });
        } else {
          thumb.style.width = active.offsetWidth + "px";
          thumb.style.height = active.offsetHeight + "px";
          thumb.style.transform = "translate(" + active.offsetLeft + "px," + active.offsetTop + "px)";
        }
        placed = true;
      }

      function move() {
        var active = bar.querySelector(".algo-btn.active, .mode-btn.active") || btns[0];
        if (!placed || reduceMotion) {
          place(active);
          return;
        }
        if (window.gsap) {
          // Luncuran halus tanpa mental (expo.out), tween lama dimatikan
          // agar klik cepat beruntun tidak menumpuk & berguncang.
          gsap.to(thumb, {
            x: active.offsetLeft,
            y: active.offsetTop,
            width: active.offsetWidth,
            height: active.offsetHeight,
            duration: 0.35,
            ease: "expo.out",
            overwrite: "auto",
          });
        } else {
          // Fallback saat CDN tidak terjangkau (mis. offline): transisi CSS.
          thumb.style.width = active.offsetWidth + "px";
          thumb.style.height = active.offsetHeight + "px";
          thumb.style.transform = "translate(" + active.offsetLeft + "px," + active.offsetTop + "px)";
        }
      }

      btns.forEach(function (b) {
        b.addEventListener("click", function () {
          requestAnimationFrame(move);
        });
      });
      window.addEventListener("resize", move);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(move);
      }
      move();
    });
  }

  // ======================================================
  // 3. COPY BUTTON FEEDBACK ANIMATION
  // ======================================================
  function initCopyFeedback() {
    var copyBtn = document.getElementById("btnCopyText");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--success);">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="color:var(--success);">Tersalin!</span>
        `;
        copyBtn.style.borderColor = "var(--success)";
        setTimeout(function () {
          copyBtn.innerHTML = originalHTML;
          copyBtn.style.borderColor = "";
        }, 1800);
      });
    }
  }

  // ======================================================
  // 4. FOOTER SECURITY BADGE & TELEMETRI
  // ======================================================
  function initFooterStatus() {
    var footer = document.querySelector(".footer");
    if (!footer) return;

    if (footer.querySelector(".footer-meta")) return;

    var meta = document.createElement("div");
    meta.className = "footer-meta";
    meta.innerHTML = `
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      <span>WebCrypto API — Standar Kriptografi W3C (100% Client-Side)</span>
    `;
    footer.insertBefore(meta, footer.firstChild);
  }

  // Jalankan saat DOM siap
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initTheme();
      initPasswordToggles();
      initPasswordMeters();
      initSegmented();
      initCopyFeedback();
      initFooterStatus();
    });
  } else {
    initTheme();
    initPasswordToggles();
    initPasswordMeters();
    initSegmented();
    initCopyFeedback();
    initFooterStatus();
  }
})();