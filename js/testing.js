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

// ============================================================
// 1. UJI KEBENARAN DEKRIPSI (minimal 10 data uji)
// ============================================================

function buildCorrectnessTestCases() {
  const enc = new TextEncoder();
  const cases = [
    { name: "Teks pendek", data: enc.encode("Halo dunia").buffer },
    { name: "Teks panjang", data: enc.encode("Lorem ipsum dolor sit amet ".repeat(100)).buffer },
    { name: "Teks kosong", data: enc.encode("").buffer },
    { name: "Karakter unicode/emoji", data: enc.encode("Data rahasia 🔒 penting!").buffer },
    { name: "Angka sebagai teks", data: enc.encode("3141592653589793").buffer },
  ];
  [512, 2048, 10240, 51200, 102400].forEach((size, i) => {
    cases.push({ name: `Berkas simulasi #${i + 1} (${(size / 1024).toFixed(1)} KB)`, data: randomBuffer(size) });
  });
  return cases;
}

async function runCorrectnessTest(algorithm, password = "test-password-123") {
  const cases = buildCorrectnessTestCases();
  const results = [];

  for (const { name, data } of cases) {
    let ok = false;
    try {
      const encrypted = await encryptData(data, password, algorithm);
      const decrypted = await decryptData(encrypted, password, algorithm);
      ok = buffersEqual(data, decrypted);
    } catch (e) {
      ok = false;
    }
    results.push({ name, size: data.byteLength, pass: ok });
  }
  return results;
}

// ============================================================
// 2. UJI WAKTU ENKRIPSI/DEKRIPSI (1 KB, 1 MB, 10 MB)
// ============================================================

async function runSpeedTest(algorithm, password = "test-password-123") {
  const sizes = [
    { label: "1 KB", bytes: 1 * 1024 },
    { label: "1 MB", bytes: 1 * 1024 * 1024 },
    { label: "10 MB", bytes: 10 * 1024 * 1024 },
  ];
  const results = [];

  for (const { label, bytes } of sizes) {
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
// 3. UJI AVALANCHE EFFECT
// ============================================================

async function runAvalancheTest(algorithm, password = "test-password-123") {
  const originalData = randomBuffer(1024);

  // Kasus A: ubah 1 bit pada PLAINTEXT, kunci tetap sama
  const flippedPlaintext = flipOneBit(originalData, 0, 0);
  const encA1 = await encryptData(originalData, password, algorithm);
  const encA2 = await encryptData(flippedPlaintext, password, algorithm);
  const plaintextAvalanche = calculateBitDifference(encA1.ciphertext, encA2.ciphertext);

  // Kasus B: plaintext sama, ubah 1 karakter pada KUNCI/PASSWORD
  const password2 = password.slice(0, -1) + (password.slice(-1) === "3" ? "4" : "3");
  const encB1 = await encryptData(originalData, password, algorithm);
  const encB2 = await encryptData(originalData, password2, algorithm);
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
