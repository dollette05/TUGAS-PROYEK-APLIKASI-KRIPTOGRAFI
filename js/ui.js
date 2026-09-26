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
      initCopyFeedback();
      initFooterStatus();
    });
  } else {
    initTheme();
    initPasswordToggles();
    initCopyFeedback();
    initFooterStatus();
  }
})();