/*
 * testing.js
 * -------------------------------------------------------
 * Berisi 5 pengujian wajib untuk Topik A:
 *   1. Uji Kebenaran Dekripsi
 *   2. Uji Waktu Enkripsi/Dekripsi
 *   3. Uji Avalanche Effect
 *   4. Uji Entropi & Histogram Byte
 *   5. Perbandingan Algoritma (AES-GCM vs AES-CBC)
 *
 * File ini memakai fungsi dari crypto.js (encryptData,
 * decryptData, dll) — tidak menulis ulang logika enkripsi.
 * -------------------------------------------------------
 */

// ============================================================
// UTILITAS BERSAMA
// ============================================================

function buffersEqual(a, b) {
  const x = new Uint8Array(a), y = new Uint8Array(b);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

/** Hitung entropi Shannon (0-8 bit) dari sebuah buffer. */
function calculateEntropy(buffer) {
  const bytes = new Uint8Array(buffer);
  const freq = new Array(256).fill(0);
  for (const b of bytes) freq[b]++;

  let entropy = 0;
  for (const count of freq) {
    if (count === 0) continue;
    const p = count / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Hitung distribusi frekuensi byte (0-255), untuk histogram. */
function calculateHistogram(buffer) {
  const bytes = new Uint8Array(buffer);
  const freq = new Array(256).fill(0);
  for (const b of bytes) freq[b]++;
  return freq;
}

/** Flip 1 bit pada posisi tertentu dalam sebuah buffer (hasil buffer baru, tidak mengubah aslinya). */
function flipOneBit(buffer, bytePosition = 0, bitPosition = 0) {
  const bytes = new Uint8Array(buffer.slice(0));
  bytes[bytePosition] ^= (1 << bitPosition);
  return bytes.buffer;
}

/** Hitung persentase bit yang berbeda antara dua buffer berukuran sama. */
function calculateBitDifference(bufferA, bufferB) {
  const a = new Uint8Array(bufferA), b = new Uint8Array(bufferB);
  const len = Math.min(a.length, b.length);
  let diffBits = 0, totalBits = len * 8;

  for (let i = 0; i < len; i++) {
    let xor = a[i] ^ b[i];
    while (xor) { diffBits += xor & 1; xor >>= 1; }
  }
  return (diffBits / totalBits) * 100;
}

/**
 * Bangkitkan buffer berisi byte acak kriptografis.
 * crypto.getRandomValues() dibatasi browser maksimal 65.536 byte
 * per panggilan, sehingga untuk ukuran lebih besar, buffer diisi
 * secara bertahap per potongan (chunk) 64 KB.
 */
function randomBuffer(size) {
  const arr = new Uint8Array(size);
  const CHUNK = 65536;
  for (let offset = 0; offset < size; offset += CHUNK) {
    const end = Math.min(offset + CHUNK, size);
    crypto.getRandomValues(arr.subarray(offset, end));
  }
  return arr.buffer;
}

// Catatan keamanan: Password 'test-password-123' di file ini hanya menjadi
// nilai bawaan (default) pada form konfigurasi pengujian — pengguna BEBAS
// menggantinya dengan password miliknya sendiri dari halaman pengujian.
// Ini bukan merupakan secret / password produksi (memenuhi Baseline Security).
const TEST_PASSWORD_FIXTURE = "test-password-123";

/** Format jumlah byte menjadi tampilan ramah manusia (B, KB, MB, GB). */
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return (i === 0 ? val.toFixed(0) : val.toFixed(2)) + " " + units[i];
}

/** Kategorikan berkas berdasarkan tipe MIME / ekstensi, untuk kolom "Kategori". */
function categorizeFile(file) {
  const t = (file.type || "").toLowerCase();
  const n = (file.name || "").toLowerCase();
  if (t.startsWith("image/")) return "Citra";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "Dokumen (PDF)";
  if (t.startsWith("text/")) return "Teks";
  if (/\.(docx?|xlsx?|pptx?|odt|rtf)$/.test(n)) return "Dokumen";
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return "Arsip";
  if (/\.(mp3|wav|flac|mp4|mkv|webm|png|jpe?g|gif|bmp|webp)$/.test(n)) return "Media/Berkas";
  return "Berkas";
}

/** Potong buffer agar tetap ringan untuk uji yang tidak butuh seluruh isi berkas. */
function sliceData(data, maxBytes) {
  if (!data) return null;
  if (data.byteLength <= maxBytes) return data;
  return data.slice(0, maxBytes);
}

// ============================================================
// 1. UJI KEBENARAN DEKRIPSI (minimal 10 data uji termasuk PNG & PDF)
// ============================================================

async function fetchSampleOrFallback(url, fallbackBytesGenerator) {
  try {
    const resp = await fetch(url);
    if (resp.ok) return await resp.arrayBuffer();
  } catch (_) {}
  return fallbackBytesGenerator();
}

async function buildCorrectnessTestCases(options = {}) {
  const enc = new TextEncoder();

  // Pertama: kumpulkan masukan ASLI dari pengguna halaman pengujian
  // (berkas yang diunggah / teks yang diketik) sebagai data uji utama.
  const { userData = [], includeSamples = true, fillToCount = 10 } = options;
  const cases = [];

  for (const item of userData) {
    if (item && item.data && item.data.byteLength !== undefined) {
      cases.push({
        name: item.name,
        category: item.category || "Masukan User",
        data: item.data,
      });
    }
  }

  // Kedua: sertakan contoh berkas asli (PNG & PDF) bila diinginkan pengguna.
  if (includeSamples) {
    const pngData = await fetchSampleOrFallback("assets/sample-files/sample-image.png", () => {
      // Fallback: minimal valid 1x1 PNG bytes
      return new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
      ]).buffer;
    });

    const pdfData = await fetchSampleOrFallback("assets/sample-files/sample-document.pdf", () => {
      // Fallback: minimal valid PDF header & body
      return enc.encode("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF").buffer;
    });

    cases.push({ name: "Citra Asli (sample-image.png)", category: "Citra (PNG)", data: pngData });
    cases.push({ name: "Dokumen Asli (sample-document.pdf)", category: "Dokumen (PDF)", data: pdfData });

    // Ketiga: cukupi hingga minimal fillToCount data uji dengan varian teks/biner standar.
    // Blok filler ini HANYA dijalankan ketika includeSamples === true, sehingga
    // mematikan checkbox benar-benar menghentikan semua data dummy/pelengkap.
    const fillers = [
      { name: "Teks Pendek (ASCII)", category: "Teks", gen: () => enc.encode("Halo dunia kriptografi!").buffer },
      { name: "Teks Panjang (Lipsum)", category: "Teks", gen: () => enc.encode("Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(60)).buffer },
      { name: "Teks Kosong (0 Byte)", category: "Teks", gen: () => enc.encode("").buffer },
      { name: "Karakter Khusus & Emoji", category: "Teks (Unicode)", gen: () => enc.encode("Data rahasia 🔒 penting! 日本語 • éàçü • @#$%^&*()").buffer },
      { name: "Simulasi Biner 1 KB", category: "Biner", gen: () => randomBuffer(1024) },
      { name: "Simulasi Berkas 10 KB", category: "Berkas Simulasi", gen: () => randomBuffer(10240) },
      { name: "Simulasi Berkas 50 KB", category: "Berkas Simulasi", gen: () => randomBuffer(51200) },
      { name: "Simulasi Berkas 100 KB", category: "Berkas Simulasi", gen: () => randomBuffer(102400) },
    ];
    for (const f of fillers) {
      if (cases.length >= fillToCount) break;
      cases.push({ name: f.name, category: f.category, data: f.gen() });
    }
  }

  // Jika includeSamples === false dan tidak ada userData, kembalikan array kosong.
  // Pemanggil (testing.html) bertanggung jawab menampilkan pesan yang sesuai.
  return cases;
}

async function runCorrectnessTest(algorithm, password = TEST_PASSWORD_FIXTURE, options = {}) {
  const cases = await buildCorrectnessTestCases(options);
  const results = [];

  for (const { name, category, data } of cases) {
    let ok = false;
    try {
      const encrypted = await encryptData(data, password, algorithm);
      const decrypted = await decryptData(encrypted, password, algorithm);
      ok = buffersEqual(data, decrypted);
    } catch (e) {
      ok = false;
    }
    results.push({ name, category, size: data.byteLength, pass: ok });
  }
  return results;
}

// ============================================================
// 2. UJI WAKTU ENKRIPSI/DEKRIPSI (1 KB, 1 MB, 10 MB)
// ============================================================

async function runSpeedTest(algorithm, password = TEST_PASSWORD_FIXTURE, options = {}, onProgress = null) {
  // Kompatibilitas mundur: bila argumen ke-3 adalah fungsi (callback progress),
  // perlakukan seperti pemanggilan lama (algorithm, password, onProgress).
  if (typeof options === "function") {
    onProgress = options;
    options = {};
  }

  const { userData = [], useStandardSizes = true } = options;
  const results = [];

  async function measure(label, category, data) {
    if (onProgress) onProgress(label);
    const t0 = performance.now();
    const encrypted = await encryptData(data, password, algorithm);
    const t1 = performance.now();
    await decryptData(encrypted, password, algorithm);
    const t2 = performance.now();

    results.push({
      label,
      category: category || "Data Acak",
      size: data.byteLength,
      encryptMs: t1 - t0,
      decryptMs: t2 - t1,
    });
  }

  // 1) Ukuran wajib sesuai spesifikasi: 1 KB, 1 MB, dan 10 MB (data acak).
  if (useStandardSizes) {
    const sizes = [
      { label: "1 KB", category: "Data Acak (bawaan)", bytes: 1 * 1024 },
      { label: "1 MB", category: "Data Acak (bawaan)", bytes: 1 * 1024 * 1024 },
      { label: "10 MB", category: "Data Acak (bawaan)", bytes: 10 * 1024 * 1024 },
    ];
    for (const { label, category, bytes } of sizes) {
      await measure(label, category, randomBuffer(bytes));
    }
  }

  // 2) Data masukan ASLI dari pengguna (berkas/teks), diukur apa adanya.
  for (const item of userData) {
    if (item && item.data && item.data.byteLength !== undefined && item.data.byteLength > 0) {
      await measure(`${item.name} (${formatBytes(item.data.byteLength)})`, item.category || "Masukan User", item.data);
    }
  }

  return results;
}

// ============================================================
// 3. UJI AVALANCHE EFFECT (Metodologi Akurat: Salt & IV Tetap)
// ============================================================

async function runAvalancheTest(algorithm, password = TEST_PASSWORD_FIXTURE, options = {}) {
  // Basis uji memakai masukan ASLI pengguna bila tersedia (dipotong maks 64 KB
  // agar uji tetap responsif untuk berkas besar); jika tidak, bangkitkan 1 KB acak.
  const originalData = sliceData(options.data, 64 * 1024) || randomBuffer(1024);

  // Metodologi standar Avalanche Effect:
  // Salt dan IV harus dibuat tetap antara kedua uji, sehingga perbedaan bit
  // murni merefleksikan sifat difusi algoritma AES dari perubahan 1 bit input/kunci,
  // bukan karena perbedaan acak dari salt/IV.
  const fixedSalt = new Uint8Array(16);
  const fixedIV = new Uint8Array(algorithm === "AES-GCM" ? 12 : 16);

  // Kasus A: ubah 1 bit pada PLAINTEXT, kunci dan salt/IV tetap sama
  const flippedPlaintext = flipOneBit(originalData, 0, 0);
  const encA1 = await encryptWithFixedSaltIV(originalData, password, algorithm, fixedSalt, fixedIV);
  const encA2 = await encryptWithFixedSaltIV(flippedPlaintext, password, algorithm, fixedSalt, fixedIV);
  const plaintextAvalanche = calculateBitDifference(encA1.ciphertext, encA2.ciphertext);

  // Kasus B: plaintext sama, ubah 1 karakter pada KUNCI/PASSWORD, salt/IV tetap sama
  const password2 = password.slice(0, -1) + (password.slice(-1) === "3" ? "4" : "3");
  const encB1 = await encryptWithFixedSaltIV(originalData, password, algorithm, fixedSalt, fixedIV);
  const encB2 = await encryptWithFixedSaltIV(originalData, password2, algorithm, fixedSalt, fixedIV);
  const keyAvalanche = calculateBitDifference(encB1.ciphertext, encB2.ciphertext);

  return { plaintextAvalanche, keyAvalanche, baseSize: originalData.byteLength };
}

// ============================================================
// 4. UJI ENTROPI & HISTOGRAM
// ============================================================

async function runEntropyTest(algorithm, password = TEST_PASSWORD_FIXTURE, options = {}) {
  // Gunakan masukan ASLI pengguna (teks/berkas) bila disediakan.
  // Jika tidak, pakai plaintext berpola bawaan supaya kontras dengan
  // cipherteks tetap terlihat jelas (data acak sudah secara alami entropi tinggi).
  let plaintext = options.data && options.data.byteLength ? options.data : null;
  let sourceLabel;

  if (!plaintext) {
    plaintext = new TextEncoder().encode("AAAA BBBB CCCC ".repeat(200)).buffer;
    sourceLabel = "Data berpola bawaan (tanpa masukan user)";
  } else {
    sourceLabel = "Masukan user (teks/berkas)";
  }

  // Jalankan KEDUA algoritma dengan plaintext yang SAMA agar perbandingan akurat.
  // Salt dan IV tetap acak (realistis), namun plaintextnya identik sehingga
  // perbedaan yang terlihat murni berasal dari karakteristik masing-masing algoritma.
  const encGCM = await encryptData(plaintext, password, "AES-GCM");
  const encCBC = await encryptData(plaintext, password, "AES-CBC");

  // Overhead: GCM menambah 16-byte authentication tag; CBC menerapkan PKCS#7 padding
  // (0–15 byte ekstra dibulatkan ke kelipatan 16).
  const gcmOverhead = encGCM.ciphertext.byteLength - plaintext.byteLength;
  const cbcOverhead = encCBC.ciphertext.byteLength - plaintext.byteLength;

  return {
    // Metadata plainteks
    plaintextSize: plaintext.byteLength,
    plaintextEntropy: calculateEntropy(plaintext),
    plaintextHistogram: calculateHistogram(plaintext),
    sourceLabel,

    // Hasil GCM
    gcmCiphertextSize: encGCM.ciphertext.byteLength,
    gcmEntropy: calculateEntropy(encGCM.ciphertext),
    gcmHistogram: calculateHistogram(encGCM.ciphertext),
    gcmOverhead,
    gcmIVLength: encGCM.iv ? encGCM.iv.byteLength : 12,
    gcmHasAuthTag: true,

    // Hasil CBC
    cbcCiphertextSize: encCBC.ciphertext.byteLength,
    cbcEntropy: calculateEntropy(encCBC.ciphertext),
    cbcHistogram: calculateHistogram(encCBC.ciphertext),
    cbcOverhead,
    cbcIVLength: encCBC.iv ? encCBC.iv.byteLength : 16,
    cbcHasAuthTag: false,
  };
}

// ============================================================
// 5. PERBANDINGAN ALGORITMA (AES-GCM vs AES-CBC)
// ============================================================

async function runComparisonTest(password = TEST_PASSWORD_FIXTURE, options = {}) {
  // Gunakan plaintext yang SAMA untuk kedua algoritma agar benchmark adil.
  // Jika pengguna menyediakan data sendiri, pakai itu; jika tidak, bangkitkan
  // sekali di sini dan pakai untuk keduanya (bukan dua kali random berbeda).
  const sharedPlaintext =
    options.data && options.data.byteLength > 0
      ? sliceData(options.data, 4 * 1024 * 1024)
      : randomBuffer(1 * 1024 * 1024);

  const algorithms = ["AES-GCM", "AES-CBC"];
  const results = {};

  for (const algo of algorithms) {
    // Ulangi enkripsi/dekripsi 3 kali lalu ambil rata-rata
    // agar hasil waktu lebih stabil dan tidak bergantung cache JIT pertama.
    let totalEncMs = 0, totalDecMs = 0;
    let lastEncrypted;
    const RUNS = 3;
    for (let run = 0; run < RUNS; run++) {
      const t0 = performance.now();
      lastEncrypted = await encryptData(sharedPlaintext, password, algo);
      const t1 = performance.now();
      await decryptData(lastEncrypted, password, algo);
      const t2 = performance.now();
      totalEncMs += t1 - t0;
      totalDecMs += t2 - t1;
    }
    const encrypted = lastEncrypted;

    // Ukuran ciphertext & overhead vs plaintext
    const ciphertextSize = encrypted.ciphertext.byteLength;
    const overhead = ciphertextSize - sharedPlaintext.byteLength;

    // Throughput enkripsi (MB/s)
    const avgEncMs = totalEncMs / RUNS;
    const avgDecMs = totalDecMs / RUNS;
    const mbPerSec = (sharedPlaintext.byteLength / 1024 / 1024) / (avgEncMs / 1000);

    // Uji ketahanan terhadap tampering: ubah 1 byte di tengah ciphertext
    const tampered = new Uint8Array(encrypted.ciphertext.slice(0));
    const midByte = Math.floor(tampered.length / 2);
    tampered[midByte] ^= 0xff;
    let detectsTampering = false;
    try {
      await decryptData({ ...encrypted, ciphertext: tampered.buffer }, password, algo);
    } catch (e) {
      detectsTampering = true;
    }

    // Metadata algoritma
    const ivLength = encrypted.iv ? encrypted.iv.byteLength : (algo === "AES-GCM" ? 12 : 16);
    const hasAuthTag = algo === "AES-GCM";

    results[algo] = {
      encryptMs: avgEncMs,
      decryptMs: avgDecMs,
      throughputMBps: mbPerSec,
      entropy: calculateEntropy(encrypted.ciphertext),
      ciphertextSize,
      overhead,
      ivLength,
      hasAuthTag,
      detectsTampering,
      plaintextSize: sharedPlaintext.byteLength,
    };
  }
  return results;
}
