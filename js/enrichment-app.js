/*
 * enrichment-app.js
 * -------------------------------------------------------
 * Orkestrasi UI halaman enrichment.html: memuat citra,
 * menjalankan enkripsi blok (fungsi inti berada di
 * enrichment.js + crypto.js), lalu merender perbandingan
 * visual ECB vs GCM ke canvas.
 * -------------------------------------------------------
 */

document.getElementById("btnProcess").addEventListener("click", async () => {
  const file = document.getElementById("imageInput").files[0];
  if (!file) return alert("Pilih gambar terlebih dahulu.");

  const btn = document.getElementById("btnProcess");
  const statusBox = document.getElementById("processStatus");

  // Validasi tipe & ukuran: hanya citra maks 10 MB (hasil akhir selalu
  // di-downscale ke 256px, jadi berkas raksasa tidak menambah kualitas).
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
  if (!file.type.startsWith("image/")) {
    statusBox.style.display = "";
    statusBox.className = "error-box";
    statusBox.textContent = "Berkas yang dipilih bukan gambar. Pilih file PNG, JPG, atau WEBP.";
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    statusBox.style.display = "";
    statusBox.className = "error-box";
    statusBox.textContent = "Ukuran gambar melebihi 10 MB. Kecilkan dulu lalu coba lagi.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Memproses citra...";
  statusBox.style.display = "";
  statusBox.className = "progress-box";
  statusBox.textContent = "Menyiapkan citra dan kunci kriptografi acak...";

  try {
    const img = await loadImage(file);
    
    // Downscale jika ukuran gambar melebihi 256px agar proses enkripsi blok tidak freeze
    const MAX_DIM = 256;
    let targetWidth = img.width;
    let targetHeight = img.height;
    if (targetWidth > MAX_DIM || targetHeight > MAX_DIM) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * MAX_DIM) / targetWidth);
        targetWidth = MAX_DIM;
      } else {
        targetWidth = Math.round((targetWidth * MAX_DIM) / targetHeight);
        targetHeight = MAX_DIM;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const rawBytes = new Uint8Array(imageData.data.buffer.slice(0));

    statusBox.textContent = `Memproses enkripsi citra (${targetWidth}x${targetHeight} piksel, ${(rawBytes.length / 1024).toFixed(1)} KB)...`;

    // Baseline Security Rules: Dilarang hardcode secret/password/salt.
    // Selalu bangkitkan password dan salt acak kriptografis (CSPRNG) per proses.
    const randomPwBytes = crypto.getRandomValues(new Uint8Array(16));
    const dynamicPassword = Array.from(randomPwBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const dynamicSalt = crypto.getRandomValues(new Uint8Array(16));

    const keyCBC = await deriveKey(dynamicPassword, dynamicSalt, "AES-CBC", 256);
    const keyGCM = await deriveKey(dynamicPassword, dynamicSalt, "AES-GCM", 256);

    const ecbBytes = await encryptImageECB(keyCBC, rawBytes);
    const secureBytes = await encryptImageSecure(keyGCM, rawBytes);

    drawResult("canvasOriginal", imageData, targetWidth, targetHeight);
    drawResult("canvasECB", makeImageData(ecbBytes, targetWidth, targetHeight), targetWidth, targetHeight);
    drawResult("canvasSecure", makeImageData(secureBytes, targetWidth, targetHeight), targetWidth, targetHeight);

    document.getElementById("resultGrid").style.display = "";
    statusBox.style.display = "none";
  } catch (err) {
    statusBox.textContent = "Gagal memproses citra: " + err.message;
    statusBox.className = "error-box";
  } finally {
    btn.disabled = false;
    btn.textContent = "Proses & Bandingkan Citra";
  }
});

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Berkas tidak dapat dibaca sebagai gambar."));
    img.src = URL.createObjectURL(file);
  });
}

function makeImageData(bytes, width, height) {
  // Paksa channel alpha selalu 255 agar gambar tidak tampak transparan
  for (let i = 3; i < bytes.length; i += 4) bytes[i] = 255;
  return new ImageData(new Uint8ClampedArray(bytes), width, height);
}

function drawResult(canvasId, imageData, width, height) {
  const canvas = document.getElementById(canvasId);
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(imageData, 0, 0);
}