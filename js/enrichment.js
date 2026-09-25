/*
 * enrichment.js
 * -------------------------------------------------------
 * Fitur pengayaan: Enkripsi citra dengan visualisasi
 * perbedaan mode ECB vs mode aman (GCM).
 *
 * Catatan: Web Crypto API tidak menyediakan AES-ECB secara
 * langsung, sehingga ECB disimulasikan dengan AES-CBC + IV nol
 * yang diterapkan per blok 16-byte secara independen — ini
 * secara matematis setara dengan ECB.
 * -------------------------------------------------------
 */

/** Enkripsi satu blok 16-byte dengan trik "CBC + IV nol" = ECB. */
async function encryptECBBlock(key, block16) {
  ensureWebCrypto();
  const zeroIV = new Uint8Array(16);
  const result = await crypto.subtle.encrypt({ name: "AES-CBC", iv: zeroIV }, key, block16);
  // Web Crypto otomatis menambah 1 blok padding; kita buang, ambil 16 byte pertama saja
  return new Uint8Array(result).slice(0, 16);
}

/** Enkripsi seluruh data gambar blok demi blok memakai simulasi ECB. */
async function encryptImageECB(key, rawBytes) {
  const blockSize = 16;
  const paddedLength = Math.ceil(rawBytes.length / blockSize) * blockSize;
  const padded = new Uint8Array(paddedLength);
  padded.set(rawBytes);

  const output = new Uint8Array(paddedLength);
  for (let i = 0; i < paddedLength; i += blockSize) {
    const block = padded.slice(i, i + blockSize);
    const encryptedBlock = await encryptECBBlock(key, block);
    output.set(encryptedBlock, i);
  }
  return output.slice(0, rawBytes.length);
}

/** Enkripsi seluruh data gambar sekaligus memakai AES-GCM (mode aman). */
async function encryptImageSecure(key, rawBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, rawBytes);
  // Buang authentication tag (16 byte terakhir) agar panjang sama dengan gambar asli
  return new Uint8Array(encrypted).slice(0, rawBytes.length);
}