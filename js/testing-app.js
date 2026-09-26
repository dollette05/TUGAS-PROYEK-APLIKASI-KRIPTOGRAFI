/*
 * testing-app.js
 * -------------------------------------------------------
 * Orkestrasi UI halaman testing.html:
 * mengatur konfigurasi pengujian, lalu menjalankan & merender
 * hasil 5 skenario pengujian (fungsi inti berada di testing.js,
 * sedangkan logika kriptografi inti ada di crypto.js).
 * -------------------------------------------------------
 */

// ============================================================
// KONFIGURASI PENGUJIAN — seluruh skenario memakai input di sini
// ============================================================
let currentTestSource = "random";   // random | text | file
let currentTestAlgorithm = "AES-GCM";

// Batas ukuran berkas untuk pengujian: 10 MB per berkas.
// Pengujian menjalankan enkripsi/dekripsi berkali-kali (5 skenario,
// komparasi 3 run), sehingga berkas raksasa akan menghang browser.
const MAX_TEST_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
let skippedOversizedFiles = [];

function esc(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// Toggle algoritma (AES-GCM / AES-CBC)
document.querySelectorAll("#testAlgorithmToggle .algo-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#testAlgorithmToggle .algo-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTestAlgorithm = btn.dataset.testAlgo;
    updateConfigStatus();
  });
});

// Toggle sumber data (Acak / Teks / Berkas)
document.querySelectorAll("#testSourceToggle .mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#testSourceToggle .mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentTestSource = btn.dataset.testSource;
    document.getElementById("testTextPanel").style.display = currentTestSource === "text" ? "" : "none";
    document.getElementById("testFilePanel").style.display = currentTestSource === "file" ? "" : "none";
    updateConfigStatus();
  });
});

document.getElementById("testTextData")?.addEventListener("input", updateConfigStatus);
document.getElementById("testFileData")?.addEventListener("change", updateConfigStatus);
document.getElementById("testIncludeSamples")?.addEventListener("change", updateConfigStatus);

/** Baca kata sandi dari panel konfigurasi (wajib diisi). */
function getTestPasswordOrThrow() {
  const password = document.getElementById("testPassword").value;
  if (!password) {
    throw new Error("Kata sandi uji belum diisi. Isi kolom “Kata Sandi Uji” pada panel Konfigurasi Pengujian.");
  }
  return password;
}

/** Ambil masukan asli pengguna (berkas / teks) menjadi daftar {name, category, data}. */
async function buildUserDataFromConfig() {
  const list = [];
  if (currentTestSource === "text") {
    const text = document.getElementById("testTextData").value;
    if (text) {
      list.push({
        name: "Teks Pengguna",
        category: "Teks (Masukan User)",
        data: new TextEncoder().encode(text).buffer,
      });
    }
  } else if (currentTestSource === "file") {
    const files = document.getElementById("testFileData").files;
    for (const f of files) {
      if (f.size > MAX_TEST_FILE_BYTES) {
        skippedOversizedFiles.push(f.name);
        continue;
      }
      list.push({
        name: f.name,
        category: categorizeFile(f),
        data: await f.arrayBuffer(),
      });
    }
  }
  return list;
}

/** Perbarui ringkasan status konfigurasi pada panel. */
function updateConfigStatus() {
  const status = document.getElementById("testConfigStatus");
  if (!status) return;
  const fileCount = currentTestSource === "file" ? document.getElementById("testFileData").files.length : 0;
  const textLen = currentTestSource === "text" ? document.getElementById("testTextData").value.length : 0;
  const algoName = getAlgorithmDisplayName(currentTestAlgorithm);
  const includeSamples = document.getElementById("testIncludeSamples").checked ? "sertakan contoh PNG/PDF" : "tanpa contoh";
  let srcDesc = "data acak/berpola standar";
  if (currentTestSource === "text") srcDesc = textLen ? `teks Anda (${textLen} karakter)` : "teks Anda (masih kosong)";
  if (currentTestSource === "file") srcDesc = fileCount ? `${fileCount} berkas Anda` : "berkas Anda (belum ada dipilih)";
  status.textContent = `Konfigurasi aktif: ${algoName} • Sumber: ${srcDesc} • ${includeSamples}`;
}

function showConfigError(msg) {
  const box = document.getElementById("testConfigError");
  box.style.display = msg ? "" : "none";
  box.textContent = msg || "";
}

// ============================================================
// JALANKAN SEMUA PENGUJIAN
// ============================================================
document.getElementById("btnRunAll").addEventListener("click", async () => {
  const btn = document.getElementById("btnRunAll");
  showConfigError("");

  let password;
  let userData = [];
  try {
    password = getTestPasswordOrThrow();
    skippedOversizedFiles = [];
    userData = await buildUserDataFromConfig();

    // Saran bila pengguna memilih sumber data sendiri tetapi belum mengisinya.
    if (currentTestSource === "text" && !document.getElementById("testTextData").value) {
      showConfigError("Anda memilih “Teks Saya” tetapi kolom teks masih kosong — pengujian tetap memakai data bawaan.");
    } else if (currentTestSource === "file" && document.getElementById("testFileData").files.length === 0) {
      showConfigError("Anda memilih “Berkas Saya” tetapi belum ada berkas dipilih — pengujian tetap memakai data bawaan.");
    } else if (skippedOversizedFiles.length) {
      showConfigError(`Melewati ${skippedOversizedFiles.length} berkas melebihi 10 MB (${skippedOversizedFiles.join(", ")}) agar browser tidak hang.`);
    }
  } catch (err) {
    showConfigError(err.message);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Sedang Menjalankan Pengujian...";

  try {
    await runAndShowCorrectness(password, userData);
    await runAndShowSpeed(password, userData);
    await runAndShowAvalanche(password, userData);
    await runAndShowEntropy(password, userData);
    await runAndShowComparison(password, userData);
  } catch (err) {
    showConfigError("Gagal menjalankan pengujian: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Jalankan Ulang Semua Pengujian";
  }
});

async function runAndShowCorrectness(password, userData) {
  const includeSamples = document.getElementById("testIncludeSamples").checked;
  const results = await runCorrectnessTest(currentTestAlgorithm, password, {
    userData,
    includeSamples,
    fillToCount: 10,
  });
  const body = document.getElementById("correctnessBody");
  body.innerHTML = "";

  if (results.length === 0) {
    // Tidak ada data apapun untuk diuji: tampilkan baris informasi, jangan crash
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--text-muted); padding: 20px 0;">
      Tidak ada data uji. Aktifkan centang "Sertakan berkas contoh" atau pilih sumber data (Teks/Berkas) terlebih dahulu.
    </td>`;
    body.appendChild(tr);
    document.getElementById("correctnessTable").style.display = "";
    return;
  }

  results.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><strong>${esc(r.name)}</strong></td>
      <td><span class="badge">${esc(r.category || "Berkas")}</span></td>
      <td>${formatBytes(r.size)}</td>
      <td class="${r.pass ? "pass" : "fail"}">${r.pass ? "✓ LULUS" : "✕ GAGAL"}</td>`;
    body.appendChild(tr);
  });
  document.getElementById("correctnessTable").style.display = "";
}

async function runAndShowSpeed(password, userData) {
  const speedProgress = document.getElementById("speedProgress");
  speedProgress.style.display = "";
  speedProgress.textContent = "Menyiapkan pengujian kecepatan...";

  const results = await runSpeedTest(currentTestAlgorithm, password, { userData }, (label) => {
    speedProgress.textContent = `Sedang mengukur kecepatan enkripsi & dekripsi untuk ${label}...`;
  });

  speedProgress.style.display = "none";
  const body = document.getElementById("speedBody");
  body.innerHTML = "";
  results.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><strong>${esc(r.label)}</strong></td>
      <td>${esc(r.category || "-")}</td>
      <td><code>${r.encryptMs.toFixed(2)} ms</code></td>
      <td><code>${r.decryptMs.toFixed(2)} ms</code></td>`;
    body.appendChild(tr);
  });
  document.getElementById("speedTable").style.display = "";
}

async function runAndShowAvalanche(password, userData) {
  const data = userData.length ? userData[0].data : null;
  const rGCM = await runAvalancheTest("AES-GCM", password, { data });
  const rCBC = await runAvalancheTest("AES-CBC", password, { data });

  document.getElementById("avaPlainCBC").textContent = rCBC.plaintextAvalanche.toFixed(2) + "%";
  document.getElementById("avaPlain").textContent = rGCM.plaintextAvalanche.toFixed(2) + "%";
  document.getElementById("avaKey").textContent = rGCM.keyAvalanche.toFixed(2) + "%";
  document.getElementById("avaBase").textContent = formatBytes(rGCM.baseSize);
  document.getElementById("avalancheResult").style.display = "";
}

function renderHistogram(containerId, freq) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const max = Math.max(...freq, 1);
  for (let i = 0; i < 64; i++) {
    const group = freq.slice(i * 4, i * 4 + 4).reduce((a, b) => a + b, 0);
    const bar = document.createElement("div");
    bar.className = "hist-bar";
    bar.style.height = Math.max(2, (group / (max * 4)) * 60) + "px";
    container.appendChild(bar);
  }
}

async function runAndShowEntropy(password, userData) {
  // Uji 4 kini selalu menjalankan KEDUA algoritma dengan plaintext yang sama
  // sehingga perbandingan nyata terlihat (ukuran ciphertext, overhead, entropi).
  const r = await runEntropyTest(currentTestAlgorithm, password, {
    data: userData.length ? userData[0].data : null,
  });

  const container = document.getElementById("entropyResult");
  container.innerHTML = `
    <div class="metric-row"><span class="metric-label">Entropi Plainteks</span><span id="entPlain">${r.plaintextEntropy.toFixed(3)} bit</span></div>
    <div class="metric-row"><span class="metric-label">Sumber Data</span><span id="entSource">${esc(r.sourceLabel)}</span></div>
    <div class="metric-row"><span class="metric-label">Ukuran Plainteks</span><span>${formatBytes(r.plaintextSize)}</span></div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px;">
      <div class="compare-col" style="padding:14px; border-radius:10px; background:var(--surface2);">
        <h4 style="margin:0 0 10px; font-size:0.9rem; color:var(--primary);">AES-256-GCM</h4>
        <div class="metric-row"><span class="metric-label">Entropi Cipherteks</span><span class="pass">${r.gcmEntropy.toFixed(4)} bit</span></div>
        <div class="metric-row"><span class="metric-label">Ukuran Cipherteks</span><span><code>${formatBytes(r.gcmCiphertextSize)}</code></span></div>
        <div class="metric-row"><span class="metric-label">Overhead</span><span style="color:var(--primary);">+${r.gcmOverhead} byte (Auth Tag)</span></div>
        <div class="metric-row"><span class="metric-label">Panjang IV</span><span><code>${r.gcmIVLength} byte</code></span></div>
        <div class="metric-row"><span class="metric-label">Auth Tag Bawaan</span><span class="pass">✓ Ada (128-bit)</span></div>
        <div class="hist-label" style="margin-top:10px;">Histogram Cipherteks GCM</div>
        <div class="hist-bars" id="histCipherGCM"></div>
      </div>
      <div class="compare-col" style="padding:14px; border-radius:10px; background:var(--surface2);">
        <h4 style="margin:0 0 10px; font-size:0.9rem; color:var(--accent);">AES-256-CBC</h4>
        <div class="metric-row"><span class="metric-label">Entropi Cipherteks</span><span class="pass">${r.cbcEntropy.toFixed(4)} bit</span></div>
        <div class="metric-row"><span class="metric-label">Ukuran Cipherteks</span><span><code>${formatBytes(r.cbcCiphertextSize)}</code></span></div>
        <div class="metric-row"><span class="metric-label">Overhead</span><span style="color:var(--accent);">+${r.cbcOverhead} byte (PKCS#7 Padding)</span></div>
        <div class="metric-row"><span class="metric-label">Panjang IV</span><span><code>${r.cbcIVLength} byte</code></span></div>
        <div class="metric-row"><span class="metric-label">Auth Tag Bawaan</span><span class="fail">✕ Tidak Ada</span></div>
        <div class="hist-label" style="margin-top:10px;">Histogram Cipherteks CBC</div>
        <div class="hist-bars" id="histCipherCBC"></div>
      </div>
    </div>

    <div class="hist-label" style="margin-top:18px;">Histogram Plainteks (byte 0–255)</div>
    <div class="hist-bars" id="histPlainEnt"></div>
    <p class="hint" style="margin-top:10px;">
      💡 <strong>Analisis:</strong> Kedua algoritma menghasilkan entropi cipherteks ~7.99 bit (mendekati acak sempurna).
      Perbedaan nyata ada pada <strong>overhead</strong>: GCM menambah <em>16 byte auth tag</em> di ujung ciphertext (tanpa padding),
      sedangkan CBC menerapkan <em>PKCS#7 padding</em> (1–16 byte) untuk membulatkan ke kelipatan 16 byte.
    </p>
  `;

  // Render histogram
  renderHistogram("histCipherGCM", r.gcmHistogram);
  renderHistogram("histCipherCBC", r.cbcHistogram);
  renderHistogram("histPlainEnt", r.plaintextHistogram);

  container.style.display = "";
}

async function runAndShowComparison(password, userData) {
  const results = await runComparisonTest(password, {
    data: userData.length ? userData[0].data : null,
  });
  const container = document.getElementById("comparisonResult");
  container.innerHTML = "";
  for (const [algo, r] of Object.entries(results)) {
    const col = document.createElement("div");
    col.className = "compare-col";
    col.innerHTML = `
      <h4>${getAlgorithmDisplayName(algo)}</h4>
      <div class="metric-row"><span class="metric-label">Waktu enkripsi (rata-rata 3×)</span><span><code>${r.encryptMs.toFixed(2)} ms</code></span></div>
      <div class="metric-row"><span class="metric-label">Waktu dekripsi (rata-rata 3×)</span><span><code>${r.decryptMs.toFixed(2)} ms</code></span></div>
      <div class="metric-row"><span class="metric-label">Throughput enkripsi</span><span><code>${r.throughputMBps.toFixed(1)} MB/s</code></span></div>
      <div class="metric-row"><span class="metric-label">Entropi cipherteks</span><span><code>${r.entropy.toFixed(4)} bit</code></span></div>
      <div class="metric-row"><span class="metric-label">Ukuran plainteks</span><span><code>${formatBytes(r.plaintextSize)}</code></span></div>
      <div class="metric-row"><span class="metric-label">Ukuran cipherteks</span><span><code>${formatBytes(r.ciphertextSize)}</code></span></div>
      <div class="metric-row"><span class="metric-label">Overhead</span><span><code>+${r.overhead} byte</code></span></div>
      <div class="metric-row"><span class="metric-label">Panjang IV</span><span><code>${r.ivLength} byte</code></span></div>
      <div class="metric-row"><span class="metric-label">Auth Tag Bawaan</span><span class="${r.hasAuthTag ? 'pass' : 'fail'}">${r.hasAuthTag ? '✓ Ada (128-bit GCM)' : '✕ Tidak Ada (perlu HMAC eksternal)'}</span></div>
      <div class="metric-row"><span class="metric-label">Deteksi tampering</span><span class="${r.detectsTampering ? 'pass' : 'fail'}">${r.detectsTampering ? '✓ Terdeteksi (Aman)' : '✕ Tidak Terdeteksi (rentan)'}</span></div>
    `;
    container.appendChild(col);
  }
  container.style.display = "";
}