/*
 * unit-tests.js
 * -------------------------------------------------------
 * Minimal 5 unit test untuk fungsi inti, sesuai Ketentuan
 * Teknis Umum pada dokumen tugas (sekarang diperluas jadi 8).
 *
 * Catatan Baseline Security Rules:
 * Password dummy seperti "password123", "kunciAman!", dll. yang
 * digunakan pada file ini secara eksklusif merupakan fixture
 * data pengujian unit lokal, bukan rahasia/kunci produksi.
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
// UNIT TEST 7: Serialisasi paket Base64 dan Heksadesimal
// bekerja dua arah (round-trip) dan dapat didekripsi dengan sempurna.
// ============================================================
async function testPackageRoundTripBase64AndHex() {
  const plaintext = new TextEncoder().encode("uji round-trip format b64 & hex 12345").buffer;
  const encrypted = await encryptData(plaintext, "passwordUjiFmt", "AES-GCM");

  // Uji Base64
  const b64 = packageToBase64(encrypted);
  const unpkgB64 = unpackageFromText(b64);
  const decB64 = await decryptData(unpkgB64, "passwordUjiFmt", unpkgB64.algorithm);
  assert(buffersEqual(plaintext, decB64), "Unpackage Base64 harus menghasilkan plaintext asli");

  // Uji Heksadesimal
  const hex = packageToHex(encrypted);
  const unpkgHex = unpackageFromText(hex);
  const decHex = await decryptData(unpkgHex, "passwordUjiFmt", unpkgHex.algorithm);
  assert(buffersEqual(plaintext, decHex), "Unpackage Heksadesimal harus menghasilkan plaintext asli");
}

// ============================================================
// UNIT TEST 8: Validasi berkas .enc rusak / tidak valid
// menolak berkas yang terlalu kecil atau korup dengan melempar error.
// ============================================================
async function testCorruptedEnvelopeRejected() {
  // 1. Berkas terlalu kecil (< 34 byte)
  const tooSmallBlob = new Blob([new Uint8Array([1, 12, 3, 4, 5])]);
  let threwTooSmall = false;
  try {
    await unpackageFromFile(tooSmallBlob);
  } catch (e) {
    threwTooSmall = true;
  }
  assert(threwTooSmall, "Berkas .enc terlalu kecil harus melempar error validasi");

  // 2. Pengenal algoritma tidak valid (misal byte 99)
  const invalidAlgoBytes = new Uint8Array(40);
  invalidAlgoBytes[0] = 99; // bukan 1 (GCM) dan bukan 2 (CBC)
  invalidAlgoBytes[1] = 12; // ivLen
  const invalidAlgoBlob = new Blob([invalidAlgoBytes]);
  let threwInvalidAlgo = false;
  try {
    await unpackageFromFile(invalidAlgoBlob);
  } catch (e) {
    threwInvalidAlgo = true;
  }
  assert(threwInvalidAlgo, "Pengenal algoritma yang tidak dikenal harus melempar error validasi");
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
  await test("7. Serialisasi round-trip Base64 dan Heksadesimal", testPackageRoundTripBase64AndHex);
  await test("8. Validasi berkas .enc rusak / korup ditolak", testCorruptedEnvelopeRejected);

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
