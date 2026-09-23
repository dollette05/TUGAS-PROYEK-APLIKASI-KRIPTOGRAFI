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

// Catatan keamanan: Password 'test-password-123' di file ini secara eksklusif
// digunakan sebagai data uji fixture (benchmark kuantitatif dan unit test),
// bukan merupakan secret / password produksi (memenuhi Baseline Security Rules).
const TEST_PASSWORD_FIXTURE = "test-password-123";

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

async function buildCorrectnessTestCases() {
  const enc = new TextEncoder();

  // Muat berkas nyata PNG dan PDF dari assets/sample-files dengan fallback aman
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

  const cases = [
    { name: "Teks Pendek (ASCII)", category: "Teks", data: enc.encode("Halo dunia kriptografi!").buffer },
    { name: "Teks Panjang (Lipsum)", category: "Teks", data: enc.encode("Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(60)).buffer },
    { name: "Teks Kosong (0 Byte)", category: "Teks", data: enc.encode("").buffer },
    { name: "Karakter Khusus & Emoji", category: "Teks (Unicode)", data: enc.encode("Data rahasia 🔒 penting! 日本語 • éàçü • @#$%^&*()").buffer },
    { name: "Citra Asli (sample-image.png)", category: "Citra (PNG)", data: pngData },
    { name: "Dokumen Asli (sample-document.pdf)", category: "Dokumen (PDF)", data: pdfData },
    { name: "Simulasi Biner 1 KB", category: "Biner", data: randomBuffer(1024) },
    { name: "Simulasi Berkas 10 KB", category: "Berkas Simulasi", data: randomBuffer(10240) },
    { name: "Simulasi Berkas 50 KB", category: "Berkas Simulasi", data: randomBuffer(51200) },
    { name: "Simulasi Berkas 100 KB", category: "Berkas Simulasi", data: randomBuffer(102400) },
  ];

  return cases;
}

async function runCorrectnessTest(algorithm, password = TEST_PASSWORD_FIXTURE) {
  const cases = await buildCorrectnessTestCases();
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

async function runSpeedTest(algorithm, password = TEST_PASSWORD_FIXTURE, onProgress = null) {
  const sizes = [
    { label: "1 KB", bytes: 1 * 1024 },
    { label: "1 MB", bytes: 1 * 1024 * 1024 },
    { label: "10 MB", bytes: 10 * 1024 * 1024 },
  ];
  const results = [];

  for (const { label, bytes } of sizes) {
    if (onProgress) onProgress(label);
    const data = randomBuffer(bytes);

    const t0 = performance.now();
    const encrypted = await encryptData(data, password, algorithm);
    const t1 = performance.now();
    await decryptData(encrypted, password, algorithm);
    const t2 = performance.now();

    results.push({
      label,
      encryptMs: t1 - t0,
      decryptMs: t2 - t1,
    });
  }
  return results;
}

// ============================================================
// 3. UJI AVALANCHE EFFECT (Metodologi Akurat: Salt & IV Tetap)
// ============================================================

async function runAvalancheTest(algorithm, password = TEST_PASSWORD_FIXTURE) {
  const originalData = randomBuffer(1024);

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

  return { plaintextAvalanche, keyAvalanche };
}

// ============================================================
// 4. UJI ENTROPI & HISTOGRAM
// ============================================================

async function runEntropyTest(algorithm, password = "test-password-123") {
  // Plaintext sengaja dibuat "tidak acak" (banyak pola berulang)
  // supaya kontras dengan cipherteks terlihat jelas.
  const plaintext = new TextEncoder().encode("AAAA BBBB CCCC ".repeat(200)).buffer;
  const encrypted = await encryptData(plaintext, password, algorithm);

  return {
    plaintextEntropy: calculateEntropy(plaintext),
    ciphertextEntropy: calculateEntropy(encrypted.ciphertext),
    plaintextHistogram: calculateHistogram(plaintext),
    ciphertextHistogram: calculateHistogram(encrypted.ciphertext),
  };
}

// ============================================================
// 5. PERBANDINGAN ALGORITMA (AES-GCM vs AES-CBC)
// ============================================================

async function runComparisonTest(password = "test-password-123") {
  const testData = randomBuffer(1 * 1024 * 1024); // 1 MB
  const algorithms = ["AES-GCM", "AES-CBC"];
  const results = {};

  for (const algo of algorithms) {
    const t0 = performance.now();
    const encrypted = await encryptData(testData, password, algo);
    const t1 = performance.now();
    await decryptData(encrypted, password, algo);
    const t2 = performance.now();

    // Uji ketahanan terhadap tampering: ubah 1 byte ciphertext, coba dekripsi
    const tampered = new Uint8Array(encrypted.ciphertext.slice(0));
    tampered[0] ^= 0xff;
    let detectsTampering = false;
    try {
      await decryptData({ ...encrypted, ciphertext: tampered.buffer }, password, algo);
    } catch (e) {
      detectsTampering = true;
    }

    results[algo] = {
      encryptMs: t1 - t0,
      decryptMs: t2 - t1,
      entropy: calculateEntropy(encrypted.ciphertext),
      detectsTampering,
    };
  }
  return results;
}
