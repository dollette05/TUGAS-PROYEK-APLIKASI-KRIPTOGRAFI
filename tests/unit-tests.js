/*
 * unit-tests.js
 * -------------------------------------------------------
 * Minimal 5 unit test untuk fungsi inti, sesuai Ketentuan
 * Teknis Umum pada dokumen tugas.
 *
 * Cara menjalankan:
 *   1. Buka file ini bersamaan dengan crypto.js dan testing.js
 *      di halaman HTML kosong (lihat unit-tests.html), ATAU
 *   2. Jalankan lewat Node.js jika lingkungan mendukung Web
 *      Crypto API (Node 19+ sudah menyediakan `crypto.webcrypto`).
 *
 * Setiap fungsi test() mengembalikan { name, pass, message }.
 * -------------------------------------------------------
 */

const testResults = [];

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion gagal");
}

async function test(name, fn) {
  try {
    await fn();
    testResults.push({ name, pass: true, message: "OK" });
  } catch (err) {
    testResults.push({ name, pass: false, message: err.message });
  }
}

// ============================================================
// UNIT TEST 1: Enkripsi menghasilkan cipherteks yang berbeda
// dari plainteks (memastikan fungsi encryptData benar-benar
// mengubah data, bukan sekadar menyalinnya).
// ============================================================
async function testEncryptionChangesData() {
  const plaintext = new TextEncoder().encode("data uji sederhana").buffer;
  const result = await encryptData(plaintext, "password123", "AES-GCM");
  const isDifferent = !buffersEqual(plaintext, result.ciphertext);
  assert(isDifferent, "Cipherteks seharusnya berbeda dari plainteks");
}

// ============================================================
// UNIT TEST 2: Dekripsi dengan password benar mengembalikan
// data asli secara utuh (round-trip correctness).
// ============================================================
async function testDecryptionRoundTrip() {
  const plaintext = new TextEncoder().encode("pesan rahasia 123").buffer;
  const encrypted = await encryptData(plaintext, "kunciAman!", "AES-GCM");
  const decrypted = await decryptData(encrypted, "kunciAman!", "AES-GCM");
  assert(buffersEqual(plaintext, decrypted), "Hasil dekripsi harus identik dengan plainteks asli");
}

// ============================================================
// UNIT TEST 3: Dekripsi dengan password SALAH harus ditolak
// (melempar error), bukan mengembalikan data yang salah diam-diam.
// ============================================================
async function testWrongPasswordRejected() {
  const plaintext = new TextEncoder().encode("data penting").buffer;
  const encrypted = await encryptData(plaintext, "passwordBenar", "AES-GCM");

  let threwError = false;
  try {
    await decryptData(encrypted, "passwordSalah", "AES-GCM");
  } catch (e) {
    threwError = true;
  }
  assert(threwError, "Dekripsi dengan password salah seharusnya gagal/melempar error");
}

// ============================================================
// UNIT TEST 4: Cipherteks yang diubah (tampering) harus
// terdeteksi dan ditolak saat dekripsi AES-GCM.
// ============================================================
async function testTamperedCiphertextRejected() {
  const plaintext = new TextEncoder().encode("dokumen asli").buffer;
  const encrypted = await encryptData(plaintext, "kunciSaya", "AES-GCM");

  // Ubah 1 byte pada cipherteks
  const tampered = new Uint8Array(encrypted.ciphertext.slice(0));
  tampered[0] ^= 0xff;

  let threwError = false;
  try {
    await decryptData({ ...encrypted, ciphertext: tampered.buffer }, "kunciSaya", "AES-GCM");
  } catch (e) {
    threwError = true;
  }
  assert(threwError, "Cipherteks yang diubah seharusnya gagal diverifikasi (GCM authentication tag)");
}

// ============================================================
// UNIT TEST 5: Setiap proses enkripsi menghasilkan salt & IV
// acak yang berbeda, meski plainteks dan password sama persis.
// ============================================================
async function testRandomSaltAndIV() {
  const plaintext = new TextEncoder().encode("data sama persis").buffer;
  const result1 = await encryptData(plaintext, "passwordSama", "AES-GCM");
  const result2 = await encryptData(plaintext, "passwordSama", "AES-GCM");

  const saltDifferent = !buffersEqual(result1.salt, result2.salt);
  const ivDifferent = !buffersEqual(result1.iv, result2.iv);
  const ciphertextDifferent = !buffersEqual(result1.ciphertext, result2.ciphertext);

  assert(saltDifferent, "Salt seharusnya berbeda setiap kali enkripsi");
  assert(ivDifferent, "IV seharusnya berbeda setiap kali enkripsi");
  assert(ciphertextDifferent, "Cipherteks seharusnya berbeda meski plainteks & password sama");
}

// ============================================================
// UNIT TEST 6 (tambahan): Fungsi entropi mengenali data acak
// sebagai lebih tinggi entropinya dibanding data berpola.
// ============================================================
async function testEntropyDistinguishesRandomness() {
  const patterned = new TextEncoder().encode("AAAAAAAAAAAAAAAAAAAA").buffer; // sangat berpola
  const random = randomBuffer(1024); // acak

  const entropyPatterned = calculateEntropy(patterned);
  const entropyRandom = calculateEntropy(random);

  assert(entropyRandom > entropyPatterned, "Data acak seharusnya memiliki entropi lebih tinggi daripada data berpola");
}

// ============================================================
// JALANKAN SEMUA TEST
// ============================================================
async function runAllUnitTests() {
  await test("1. Enkripsi mengubah data (bukan menyalin)", testEncryptionChangesData);
  await test("2. Dekripsi round-trip menghasilkan data identik", testDecryptionRoundTrip);
  await test("3. Password salah ditolak", testWrongPasswordRejected);
  await test("4. Cipherteks yang diubah (tampering) ditolak", testTamperedCiphertextRejected);
  await test("5. Salt & IV selalu acak setiap enkripsi", testRandomSaltAndIV);
  await test("6. Entropi membedakan data acak vs berpola", testEntropyDistinguishesRandomness);

  return testResults;
}

// Jika dijalankan di browser dengan elemen #unitTestOutput tersedia,
// tampilkan hasil secara otomatis.
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", async () => {
    const output = document.getElementById("unitTestOutput");
    if (!output) return;
    const results = await runAllUnitTests();
    output.innerHTML = results
      .map((r) => `<div style="color:${r.pass ? "#3ecf8e" : "#ff5d5d"}">${r.pass ? "✓" : "✗"} ${r.name} — ${r.message}</div>`)
      .join("");
  });
}
