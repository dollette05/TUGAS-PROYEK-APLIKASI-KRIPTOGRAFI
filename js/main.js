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

// ============================================================
// TOGGLE ALGORITMA & MODE
// ============================================================

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
    document.getElementById("modeTextPanel").style.display = currentMode === "text" ? "" : "none";
    document.getElementById("modeFilePanel").style.display = currentMode === "file" ? "" : "none";
  });
});

document.querySelectorAll(".pw-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === "password" ? "text" : "password";
  });
});

// ============================================================
// SERIALISASI HASIL ENKRIPSI (agar bisa disimpan sebagai teks/file)
// ============================================================

/** Gabungkan salt + iv + ciphertext jadi satu paket Base64 (untuk mode teks). */
function packageToBase64(result) {
  const packet = {
    algo: result.algorithm,
    salt: bufferToBase64(result.salt),
    iv: bufferToBase64(result.iv),
    data: bufferToBase64(result.ciphertext),
  };
  return btoa(JSON.stringify(packet));
}

function unpackageFromBase64(packedText) {
  const packet = JSON.parse(atob(packedText));
  return {
    algorithm: packet.algo,
    salt: base64ToBuffer(packet.salt),
    iv: base64ToBuffer(packet.iv),
    ciphertext: base64ToBuffer(packet.data),
  };
}

/** Gabungkan salt + iv + ciphertext jadi satu file biner (untuk mode berkas). */
function packageToBlob(result) {
  const salt = new Uint8Array(result.salt);   // 16 byte
  const iv = new Uint8Array(result.iv);       // 12 atau 16 byte tergantung algoritma
  const ct = new Uint8Array(result.ciphertext);

  const algoByte = new Uint8Array([result.algorithm === "AES-GCM" ? 1 : 2]);
  const ivLenByte = new Uint8Array([iv.length]);

  return new Blob([algoByte, ivLenByte, salt, iv, ct]);
}

async function unpackageFromFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const algorithm = bytes[0] === 1 ? "AES-GCM" : "AES-CBC";
  const ivLen = bytes[1];
  const salt = bytes.slice(2, 18).buffer;
  const iv = bytes.slice(18, 18 + ivLen).buffer;
  const ciphertext = bytes.slice(18 + ivLen).buffer;

  return { algorithm, salt, iv, ciphertext };
}

// ============================================================
// MODE TEKS
// ============================================================

document.getElementById("btnEncryptText").addEventListener("click", async () => {
  const text = document.getElementById("textInput").value;
  const password = document.getElementById("textPassword").value;
  hideTextError();

  if (!text || !password) return showTextError("Teks dan kata sandi wajib diisi.");

  try {
    const dataBuffer = new TextEncoder().encode(text).buffer;
    const result = await encryptData(dataBuffer, password, currentAlgorithm);
    const packed = packageToBase64(result);
    showTextResult(packed, result.algorithm);
  } catch (err) {
    showTextError(err.message);
  }
});

document.getElementById("btnDecryptText").addEventListener("click", async () => {
  const packedText = document.getElementById("textInput").value.trim();
  const password = document.getElementById("textPassword").value;
  hideTextError();

  if (!packedText || !password) return showTextError("Cipherteks dan kata sandi wajib diisi.");

  try {
    const payload = unpackageFromBase64(packedText);
    const plainBuffer = await decryptData(payload, password, payload.algorithm);
    const plainText = new TextDecoder().decode(plainBuffer);
    showTextResult(plainText, payload.algorithm);
  } catch (err) {
    showTextError("Dekripsi gagal: kata sandi salah, format tidak valid, atau data telah diubah.");
  }
});

function showTextResult(content, algorithm) {
  document.getElementById("textResultBox").style.display = "";
  document.getElementById("textResultBadge").textContent = getAlgorithmDisplayName(algorithm);
  document.getElementById("textResult").value = content;
}

function showTextError(msg) {
  const box = document.getElementById("textError");
  box.style.display = "";
  box.textContent = msg;
  document.getElementById("textResultBox").style.display = "none";
}

function hideTextError() {
  document.getElementById("textError").style.display = "none";
}

document.getElementById("btnCopyText").addEventListener("click", () => {
  const el = document.getElementById("textResult");
  el.select();
  navigator.clipboard.writeText(el.value);
});

// ============================================================
// MODE BERKAS
// ============================================================

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  if (e.dataTransfer.files.length) setSelectedFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files.length) setSelectedFile(fileInput.files[0]);
});

function setSelectedFile(file) {
  selectedFile = file;
  document.getElementById("dropzoneText").textContent =
    `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
}

document.getElementById("btnEncryptFile").addEventListener("click", async () => {
  const password = document.getElementById("filePassword").value;
  await handleFileOperation("encrypt", password);
});

document.getElementById("btnDecryptFile").addEventListener("click", async () => {
  const password = document.getElementById("filePassword").value;
  await handleFileOperation("decrypt", password);
});

async function handleFileOperation(operation, password) {
  hideFileMessages();

  if (!selectedFile) return showFileError("Pilih berkas terlebih dahulu.");
  if (!password) return showFileError("Kata sandi wajib diisi.");

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
