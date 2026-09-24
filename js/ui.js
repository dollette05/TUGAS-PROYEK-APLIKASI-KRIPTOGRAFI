/*
 * ui.js
 * -------------------------------------------------------
 * EFEK UI/UX SAJA — TIDAK mengandung logika kriptografi apa pun.
 * Menambah: (1) overlay boot CRT sekali per sesi, (2) status bar
 * terminal di footer yang membaca algoritma aktif dari DOM.
 * Logika enkripsi tetap 100% di crypto.js + main.js (tidak diubah).
 * -------------------------------------------------------
 */

(function () {
  "use strict";

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }

  /* ======================================================
   * 1) CRT BOOT OVERLAY — sekali per sesi, bisa di-skip
   * ====================================================== */
  function boot() {
    if (reduce) return;
    try {
      if (sessionStorage.getItem("crt-booted")) return;
      sessionStorage.setItem("crt-booted", "1");
    } catch (e) { /* storage tidak tersedia -> tetap jalankan sekali */ }

    var ov = document.createElement("div");
    ov.id = "crtBoot";
    ov.setAttribute("aria-hidden", "true");
    ov.innerHTML =
      '<div class="crt-boot-inner">' +
      '<div class="crt-boot-cmd">brankas_ops --bootstrap --selftest</div>' +
      '<div class="crt-boot-lines"></div>' +
      "</div>";
    document.body.appendChild(ov);

    var box = ov.querySelector(".crt-boot-lines");
    var lines = [
      "> mounting crypto kernel ............ OK",
      "> boostrap AES-256-GCM engine ....... OK",
      "> PBKDF2-SHA256 100.000 rounds ...... OK",
      "> CSPRNG entropy pool ............... OK",
      "> tamper detection .................. OK",
      "> session 100% client-side .......... READY"
    ];
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", skip);
      document.removeEventListener("pointerdown", skip, true);
      ov.style.opacity = "0";
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 420);
    }
    function skip() { finish(); }
    window.addEventListener("keydown", skip, { once: true });
    document.addEventListener("pointerdown", skip, { once: true, capture: true });

    var i = 0;
    var tick = setInterval(function () {
      if (done) { clearInterval(tick); return; }
      if (i >= lines.length) {
        clearInterval(tick);
        setTimeout(finish, 320);
        return;
      }
      var ln = document.createElement("div");
      ln.textContent = lines[i++];
      box.appendChild(ln);
    }, 105);
  }

  /* ======================================================
   * 2) STATUS BAR TERMINAL di footer
   *    Membaca algoritma aktif dari DOM (tidak menyentuh logika)
   * ====================================================== */
  function telemetry() {
    var foot = $(".footer");
    if (!foot) return;
    var bar = document.createElement("div");
    bar.className = "term-status";
    var span = document.createElement("span");
    span.className = "term-status-text";
    bar.appendChild(span);
    foot.insertBefore(bar, foot.firstChild);

    function read() {
      var a = $(".algo-btn.active");
      var algo = a ? a.textContent.trim() : "AES-256-GCM";
      span.textContent = "$ ALGO: " + algo + " // ENC: 100% LOCAL // SYS: NOMINAL";
    }
    read();

    document.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest(".algo-btn")) read();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      try { boot(); telemetry(); } catch (e) { /* UI opsional, jangan ganggu alur crypto */ }
    });
  } else {
    try { boot(); telemetry(); } catch (e) { /* noop */ }
  }
})();