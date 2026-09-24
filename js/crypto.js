/*
 * crypto.js
 * -------------------------------------------------------
 * Logika inti kriptografi: AES-256-GCM (algoritma utama) &
 * AES-256-CBC (algoritma pembanding).
 * Semua enkripsi/dekripsi berjalan di browser (client-side)
 * menggunakan Web Crypto API bawaan browser — tidak ada
 * data yang dikirim ke server mana pun.
 *
 * Struktur file (dibagi per section agar mudah dijelaskan):
 *   1. Fungsi Umum      -> deriveKey, konversi Base64 & Hex
 *   2. AES-256-GCM      -> encryptAES, decryptAES
 *   3. AES-256-CBC      -> encryptAEScbc, decryptAEScbc
 *   4. Fungsi Terpadu   -> encryptData/decryptData (dipakai UI)
 * -------------------------------------------------------
 */

// ============================================================
// 1. FUNGSI UMUM
// ============================================================

/**
 * Menurunkan kunci kriptografis dari password memakai PBKDF2.
 * Salt acak wajib berbeda setiap kali enkripsi agar kunci yang
 * dihasilkan juga selalu berbeda meski password sama.
 */
async function deriveKey(password, salt, algorithmName, keyLength = 256) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: algorithmName, length: keyLength },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Ubah ArrayBuffer menjadi string Base64, untuk ditampilkan/disalin. */
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Ubah string Base64 kembali menjadi ArrayBuffer. */
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Ubah ArrayBuffer menjadi string heksadesimal. */
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Ubah string heksadesimal kembali menjadi ArrayBuffer. */
function hexToBuffer(hex) {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Format heksadesimal tidak valid: panjang karakter harus genap.");
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

// ============================================================
// 2. AES-256-GCM
// ============================================================
// Catatan: Web Crypto API belum mendukung ChaCha20-Poly1305
// secara native di semua browser, sehingga AES-256-GCM
// menjadi algoritma utama yang didukung penuh secara native.

async function encryptAES(dataBuffer, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 byte = standar IV untuk GCM

  const key = await deriveKey(password, salt, "AES-GCM", 256);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, dataBuffer);

  return { algorithm: "AES-GCM", salt, iv, ciphertext };
}

async function decryptAES({ salt, iv, ciphertext }, password) {
  // Penegasan mode (Baseline Security): AES-GCM MURNI hanya bisa didekripsi
  // jika IV tepat 12 byte (standar GCM). Jika data dari mode lain (mis. CBC
  // dengan IV 16 byte) dipaksa masuk ke sini, langsung ditolak.
  if (!iv || iv.byteLength !== 12) {
    throw new Error("Dekripsi AES-GCM ditolak: IV harus tepat 12 byte (format GCM).");
  }
  const key = await deriveKey(password, salt, "AES-GCM", 256);
  try {
    // Jika password salah ATAU ciphertext diubah walau 1 byte,
    // baris di bawah ini akan otomatis melempar error —
    // ini karena GCM menyertakan authentication tag bawaan.
    return await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  } catch (err) {
    throw new Error("Dekripsi gagal: kata sandi salah atau data telah diubah.");
  }
}

// ============================================================
// 3. AES-256-CBC (algoritma/mode pembanding)
// ============================================================
// Dipakai khusus untuk pengujian "Perbandingan minimal dua
// algoritma atau mode modern" — PDF tugas menyebut eksplisit
// pasangan "AES-CBC dan AES-GCM" sebagai contoh yang sah.
//
// Catatan keamanan: AES-CBC TIDAK memiliki authentication tag
// bawaan seperti GCM, sehingga secara sengaja dipakai di sini
// hanya sebagai pembanding, bukan sebagai fitur keamanan utama
// (fitur utama tetap AES-256-GCM pada section 2).

async function encryptAEScbc(dataBuffer, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(16)); // 16 byte = ukuran blok AES untuk CBC

  const key = await deriveKey(password, salt, "AES-CBC", 256);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, dataBuffer);

  return { algorithm: "AES-CBC", salt, iv, ciphertext };
}

async function decryptAEScbc({ salt, iv, ciphertext }, password) {
  // Penegasan mode (Baseline Security): AES-CBC MURNI hanya bisa didekripsi
  // jika IV tepat 16 byte (ukuran blok AES). Jika data dari mode lain (mis.
  // GCM dengan IV 12 byte) dipaksa masuk ke sini, langsung ditolak.
  if (!iv || iv.byteLength !== 16) {
    throw new Error("Dekripsi AES-CBC ditolak: IV harus tepat 16 byte (format CBC).");
  }
  const key = await deriveKey(password, salt, "AES-CBC", 256);
  try {
    // Catatan: berbeda dari GCM, CBC tidak memverifikasi
    // integritas data — dekripsi tetap "berhasil" secara
    // matematis walau ciphertext diubah, hasilnya cuma jadi
    // data acak yang tidak valid. Ini justru jadi bahan
    // analisis menarik saat membandingkan dengan GCM di laporan.
    return await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
  } catch (err) {
    throw new Error("Dekripsi gagal: kata sandi salah atau ukuran data tidak valid.");
  }
}

// ============================================================
// 4. FUNGSI TERPADU (dipanggil dari main.js / UI)
// ============================================================

/** Nama lengkap algoritma untuk ditampilkan di UI (badge, laporan, dll). */
function getAlgorithmDisplayName(algorithm) {
  if (algorithm === "AES-GCM") return "AES-256-GCM";
  if (algorithm === "AES-CBC") return "AES-256-CBC";
  return algorithm;
}

/**
 * Enkripsi data dengan algoritma pilihan.
 * @param {ArrayBuffer} dataBuffer - data mentah (teks atau file)
 * @param {string} password
 * @param {"AES-GCM"|"AES-CBC"} algorithm
 */
async function encryptData(dataBuffer, password, algorithm) {
  if (algorithm === "AES-GCM") return encryptAES(dataBuffer, password);
  if (algorithm === "AES-CBC") return encryptAEScbc(dataBuffer, password);
  throw new Error("Algoritma tidak dikenali: " + algorithm);
}

/**
 * Dekripsi data dengan algoritma yang sesuai dengan hasil enkripsi.
 */
async function decryptData(payload, password, algorithm) {
  if (algorithm === "AES-GCM") return decryptAES(payload, password);
  if (algorithm === "AES-CBC") return decryptAEScbc(payload, password);
  throw new Error("Algoritma tidak dikenali: " + algorithm);
}

/**
 * Enkripsi dengan salt dan IV yang ditentukan secara eksplisit.
 * Khusus digunakan pada uji Avalanche Effect agar perbedaan
 * bit cipherteks murni merefleksikan efek perubahan 1 bit pada
 * plainteks atau kunci, bukan karena salt/IV acak yang berbeda.
 */
async function encryptWithFixedSaltIV(dataBuffer, password, algorithm, salt, iv) {
  const key = await deriveKey(password, salt, algorithm, 256);
  const ciphertext = await crypto.subtle.encrypt({ name: algorithm, iv }, key, dataBuffer);
  return { algorithm, salt, iv, ciphertext };
}
