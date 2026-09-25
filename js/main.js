/*
 * main.js
 * -------------------------------------------------------
 * Penghubung antara UI (index.html) dan logika kriptografi
 * (crypto.js). File ini TIDAK berisi logika enkripsi apa pun
 * — hanya mengatur alur: baca input user -> panggil crypto.js
 * -> tampilkan hasil ke UI.
 * -------------------------------------------------------
 */

let currentAlgorithm = "AES-GCM";
let currentMode = "text";
let selectedFile = null;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

// ============================================================
// TOGGLE ALGORITMA & MODE
// ============================================================

if (typeof document !== "undefined") {
  document.querySelectorAll(".algo-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".algo-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentAlgorithm = btn.dataset.algo;
    });
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode;
      const textPanel = document.getElementById("modeTextPanel");
      const filePanel = document.getElementById("modeFilePanel");
      if (textPanel) textPanel.style.display = currentMode === "text" ? "" : "none";
      if (filePanel) filePanel.style.display = currentMode === "file" ? "" : "none";
    });
  });
}

// ============================================================
// SERIALISASI HASIL ENKRIPSI (agar bisa disimpan sebagai teks/file)
// ============================================================

/** Konversi hasil enkripsi menjadi Uint8Array biner standar [algoByte, ivLen, salt, iv, ct]. */
function packageToBytes(result) {
  const salt = new Uint8Array(result.salt);   // 16 byte
  const iv = new Uint8Array(result.iv);       // 12 byte (GCM) atau 16 byte (CBC)
  const ct = new Uint8Array(result.ciphertext);

  const algoByte = result.algorithm === "AES-GCM" ? 1 : 2;
  const ivLen = iv.length;
  const totalLength = 2 + salt.length + iv.length + ct.length;
  const out = new Uint8Array(totalLength);

  out[0] = algoByte;
  out[1] = ivLen;
  out.set(salt, 2);
  out.set(iv, 2 + salt.length);
  out.set(ct, 2 + salt.length + iv.length);
  return out;
}

/** Gabungkan salt + iv + ciphertext jadi satu paket Base64 (JSON envelope). */
function packageToBase64(result) {
  const packet = {
    algo: result.algorithm,
    salt: bufferToBase64(result.salt),
    iv: bufferToBase64(result.iv),
    data: bufferToBase64(result.ciphertext),
  };
  return btoa(JSON.stringify(packet));
}

/** Gabungkan salt + iv + ciphertext jadi string Heksadesimal kompak. */
function packageToHex(result) {
  return bufferToHex(packageToBytes(result).buffer);
}

/** Parse teks cipherteks (otomatis mendeteksi format Base64 atau Heksadesimal). */
function unpackageFromText(rawText) {
  const text = (rawText || "").trim();
  if (!text) throw new Error("Cipherteks tidak boleh kosong.");

  // Deteksi 1: Format Hexadesimal murni (hanya karakter 0-9a-fA-F, panjang genap)
  const isHex = /^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0;
  if (isHex) {
    try {
      const buffer = hexToBuffer(text);
      const bytes = new Uint8Array(buffer);
      if (bytes.length >= 30) {
        const algoCode = bytes[0];
        if (algoCode === 1 || algoCode === 2) {
          const algorithm = algoCode === 1 ? "AES-GCM" : "AES-CBC";
          const ivLen = bytes[1];
          const expectedIvLen = algorithm === "AES-GCM" ? 12 : 16;
          if (ivLen === expectedIvLen && bytes.length >= 2 + 16 + ivLen) {
            const salt = bytes.slice(2, 18).buffer;
            const iv = bytes.slice(18, 18 + ivLen).buffer;
            const ciphertext = bytes.slice(18 + ivLen).buffer;
            return { algorithm, salt, iv, ciphertext };
          }
        }
      }
      // Opsi cadangan: Hex dari string JSON
      const jsonStr = new TextDecoder().decode(buffer);
      const packet = JSON.parse(jsonStr);
      if (packet.algo && packet.salt && packet.iv && packet.data) {
        return {
          algorithm: packet.algo,
          salt: base64ToBuffer(packet.salt),
          iv: base64ToBuffer(packet.iv),
          ciphertext: base64ToBuffer(packet.data),
        };
      }
    } catch (_) {}
  }

  // Deteksi 2: Format Base64 JSON
  try {
    const jsonStr = atob(text);
    const packet = JSON.parse(jsonStr);
    if (packet.algo && packet.salt && packet.iv && packet.data) {
      return {
        algorithm: packet.algo,
        salt: base64ToBuffer(packet.salt),
        iv: base64ToBuffer(packet.iv),
        ciphertext: base64ToBuffer(packet.data),
      };
    }
  } catch (_) {}

  // Deteksi 3: Base64 dari binary envelope [algo, ivLen, salt, iv, ct]
  try {
    const buf = base64ToBuffer(text);
    const bytes = new Uint8Array(buf);
    if (bytes.length >= 30 && (bytes[0] === 1 || bytes[0] === 2)) {
      const algorithm = bytes[0] === 1 ? "AES-GCM" : "AES-CBC";
      const ivLen = bytes[1];
      const expectedIvLen = algorithm === "AES-GCM" ? 12 : 16;
      // Validasi ketat: panjang IV harus sesuai mode, data harus cukup panjang
      if (ivLen === expectedIvLen && bytes.length >= 2 + 16 + ivLen) {
        const salt = bytes.slice(2, 18).buffer;
        const iv = bytes.slice(18, 18 + ivLen).buffer;
        const ciphertext = bytes.slice(18 + ivLen).buffer;
        return { algorithm, salt, iv, ciphertext };
      }
    }
  } catch (_) {}

  throw new Error("Format cipherteks tidak dikenali. Pastikan menempel string Base64 atau Heksadesimal yang valid.");
}

/** Kompatibilitas mundur: unpackageFromBase64 mengarahkan ke unpackageFromText. */
function unpackageFromBase64(packedText) {
  return unpackageFromText(packedText);
}

/**
 * Penegasan mode (Baseline Security):
 * Setiap cipherteks hanya boleh didekripsi dengan algoritma yang SAMA
 * dengan mode yang dipilih user (GCM hanya untuk GCM, CBC hanya untuk CBC).
 * Jika tidak cocok, lempar error dengan panduan perbaikan.
 */
function ensureAlgorithmMatch(payloadAlgorithm) {
  if (payloadAlgorithm !== currentAlgorithm) {
    throw new Error(
      "Cipherteks ini dibuat dengan " + getAlgorithmDisplayName(payloadAlgorithm) +
      ", tetapi mode yang sedang aktif adalah " + getAlgorithmDisplayName(currentAlgorithm) +
      ". Ganti mode algoritma ke " + getAlgorithmDisplayName(payloadAlgorithm) +
      " terlebih dahulu — mode tidak bisa saling menggantikan."
    );
  }
}

/** Gabungkan salt + iv + ciphertext jadi satu file biner (untuk mode berkas). */
function packageToBlob(result) {
  return new Blob([packageToBytes(result)]);
}

/** Baca file .enc dengan validasi integritas header yang ketat. */
async function unpackageFromFile(file) {
  if (!file) throw new Error("Berkas tidak dipilih.");
  if (file.size < 34) {
    throw new Error("Format berkas .enc rusak atau tidak valid: ukuran berkas terlalu kecil.");
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const algoCode = bytes[0];
  if (algoCode !== 1 && algoCode !== 2) {
    throw new Error("Format berkas .enc rusak: pengenal algoritma tidak valid (harus 1 untuk GCM atau 2 untuk CBC).");
  }
  const algorithm = algoCode === 1 ? "AES-GCM" : "AES-CBC";

  const ivLen = bytes[1];
  const expectedIvLen = algorithm === "AES-GCM" ? 12 : 16;
  if (ivLen !== expectedIvLen) {
    throw new Error(`Format berkas .enc rusak: panjang IV (${ivLen} byte) tidak sesuai untuk ${algorithm}.`);
  }

  const minExpectedLength = 2 + 16 + ivLen + (algorithm === "AES-GCM" ? 16 : 1);
  if (bytes.length < minExpectedLength) {
    throw new Error("Format berkas .enc rusak atau terpotong: data cipherteks tidak lengkap.");
  }

  const salt = bytes.slice(2, 18).buffer;
  const iv = bytes.slice(18, 18 + ivLen).buffer;
  const ciphertext = bytes.slice(18 + ivLen).buffer;

  return { algorithm, salt, iv, ciphertext };
}

// ============================================================
// MODE TEKS
// ============================================================

let currentCipherBase64 = "";
let currentCipherHex = "";
let currentFormat = "base64";

if (typeof document !== "undefined") {
  document.getElementById("btnEncryptText")?.addEventListener("click", async () => {
    const text = document.getElementById("textInput").value;
    const password = document.getElementById("textPassword").value;
    hideTextError();

    if (!text || !password) return showTextError("Teks dan kata sandi wajib diisi.");

    try {
      const dataBuffer = new TextEncoder().encode(text).buffer;
      const result = await encryptData(dataBuffer, password, currentAlgorithm);
      
      currentCipherBase64 = packageToBase64(result);
      currentCipherHex = packageToHex(result);

      showEncryptedTextResult(result.algorithm);
    } catch (err) {
      showTextError(err.message);
    }
  });

  document.getElementById("btnDecryptText")?.addEventListener("click", async () => {
    const packedText = document.getElementById("textInput").value.trim();
    const password = document.getElementById("textPassword").value;
    hideTextError();

    if (!packedText || !password) return showTextError("Cipherteks dan kata sandi wajib diisi.");

    try {
      const payload = unpackageFromText(packedText);
      ensureAlgorithmMatch(payload.algorithm);
      const plainBuffer = await decryptData(payload, password, payload.algorithm);
      const plainText = new TextDecoder().decode(plainBuffer);
      showDecryptedTextResult(plainText, payload.algorithm);
    } catch (err) {
      showTextError(err.message || "Dekripsi gagal: kata sandi salah, format tidak valid, atau data telah diubah.");
    }
  });
}

function showEncryptedTextResult(algorithm) {
  document.getElementById("textResultBox").style.display = "";
  document.getElementById("textResultBadge").textContent = getAlgorithmDisplayName(algorithm);
  document.getElementById("formatToggle").style.display = "inline-flex";

  setFormat(currentFormat);
}

function showDecryptedTextResult(plainText, algorithm) {
  document.getElementById("textResultBox").style.display = "";
  document.getElementById("textResultBadge").textContent = getAlgorithmDisplayName(algorithm) + " (Plainteks)";
  document.getElementById("formatToggle").style.display = "none";
  document.getElementById("textResult").value = plainText;
}

function setFormat(fmt) {
  currentFormat = fmt;
  const btnB64 = document.getElementById("btnFmtBase64");
  const btnHex = document.getElementById("btnFmtHex");

  if (fmt === "base64") {
    btnB64.classList.add("active");
    btnHex.classList.remove("active");
    document.getElementById("textResult").value = currentCipherBase64;
  } else {
    btnHex.classList.add("active");
    btnB64.classList.remove("active");
    document.getElementById("textResult").value = currentCipherHex;
  }
}

if (typeof document !== "undefined") {
  document.getElementById("btnFmtBase64")?.addEventListener("click", () => setFormat("base64"));
  document.getElementById("btnFmtHex")?.addEventListener("click", () => setFormat("hex"));
}

function showTextError(msg) {
  const box = document.getElementById("textError");
  if (box) {
    box.style.display = "";
    box.textContent = msg;
  }
  const resultBox = document.getElementById("textResultBox");
  if (resultBox) resultBox.style.display = "none";
}

function hideTextError() {
  const box = document.getElementById("textError");
  if (box) box.style.display = "none";
}

if (typeof document !== "undefined") {
  document.getElementById("btnCopyText")?.addEventListener("click", () => {
    const el = document.getElementById("textResult");
    const btn = document.getElementById("btnCopyText");
    if (el) el.select();
    if (el) navigator.clipboard.writeText(el.value);

    if (btn) {
      const prevText = btn.textContent;
      btn.textContent = "Tersalin!";
      setTimeout(() => { btn.textContent = prevText; }, 1500);
    }
  });

  // ============================================================
  // MODE BERKAS
  // ============================================================

  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");

  dropzone?.addEventListener("click", () => fileInput?.click());
  dropzone?.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  dropzone?.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length) setSelectedFile(e.dataTransfer.files[0]);
  });
  fileInput?.addEventListener("change", () => {
    if (fileInput.files.length) setSelectedFile(fileInput.files[0]);
  });

  document.getElementById("btnEncryptFile")?.addEventListener("click", async () => {
    const password = document.getElementById("filePassword")?.value;
    await handleFileOperation("encrypt", password);
  });

  document.getElementById("btnDecryptFile")?.addEventListener("click", async () => {
    const password = document.getElementById("filePassword")?.value;
    await handleFileOperation("decrypt", password);
  });
}

function setSelectedFile(file) {
  selectedFile = file;
  const dropzoneText = document.getElementById("dropzoneText");
  if (dropzoneText) {
    dropzoneText.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  }
}

async function handleFileOperation(operation, password) {
  hideFileMessages();

  if (!selectedFile) return showFileError("Pilih berkas terlebih dahulu.");
  if (!password) return showFileError("Kata sandi wajib diisi.");

  if (selectedFile.size > MAX_FILE_BYTES) {
    return showFileError(
      `Berkas terlalu besar (>${MAX_FILE_BYTES / (1024 * 1024)} MB). Batasi ukuran agar browser tidak hang, lalu coba lagi.`
    );
  }

  document.getElementById("fileProgress").style.display = "";

  try {
    let outputBlob, outputName;

    if (operation === "encrypt") {
      const dataBuffer = await selectedFile.arrayBuffer();
      const result = await encryptData(dataBuffer, password, currentAlgorithm);
      outputBlob = packageToBlob(result);
      outputName = selectedFile.name + ".enc";
    } else {
      const payload = await unpackageFromFile(selectedFile);
      ensureAlgorithmMatch(payload.algorithm);
      const plainBuffer = await decryptData(payload, password, payload.algorithm);
      outputBlob = new Blob([plainBuffer]);
      outputName = selectedFile.name.replace(/\.enc$/, "") || "hasil_dekripsi";
    }

    downloadBlob(outputBlob, outputName);
    showFileSuccess(`Berhasil! Berkas "${outputName}" telah diunduh.`);
  } catch (err) {
    showFileError(err.message || "Operasi gagal: kata sandi salah atau berkas telah diubah.");
  } finally {
    document.getElementById("fileProgress").style.display = "none";
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showFileError(msg) {
  const box = document.getElementById("fileError");
  box.style.display = "";
  box.textContent = msg;
}

function showFileSuccess(msg) {
  const box = document.getElementById("fileSuccess");
  box.style.display = "";
  box.textContent = msg;
}

function hideFileMessages() {
  document.getElementById("fileError").style.display = "none";
  document.getElementById("fileSuccess").style.display = "none";
}
