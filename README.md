# Brankas Digital — Aplikasi Enkripsi Modern

Aplikasi web untuk mengenkripsi dan mendekripsi teks maupun berkas (gambar, PDF, dan format lainnya) menggunakan algoritma kriptografi modern **AES-256-GCM** dan **AES-256-CBC**. Seluruh proses berjalan sepenuhnya di sisi klien (browser) tanpa server maupun basis data — data yang diproses tidak pernah dikirim ke mana pun.

Tugas Proyek Aplikasi Kriptografi — Mata Kuliah Keamanan Informasi
Program Studi Informatika, Fakultas Teknik, Universitas Siliwangi

## Anggota Kelompok

| Nama | NPM |
|---|---|
| NAURA AULIA PUTRI | (247006111002) |
| ZASKIA JANUALITA DEVI | (247006111009) |
| ZALFA MALIKUL MULQI | (247006111117) |

## Fitur

- Enkripsi & dekripsi teks maupun berkas dengan **AES-256-GCM** (algoritma utama) dan **AES-256-CBC** (pembanding)
- Kunci diturunkan dari kata sandi menggunakan **PBKDF2** (SHA-256, 100.000 iterasi) dengan salt acak CSPRNG
- IV/nonce acak dibangkitkan untuk setiap proses enkripsi
- Penolakan dekripsi otomatis jika kata sandi salah atau data telah diubah (*authenticated encryption tag failure*)
- Validasi berkas `.enc` rusak/terpotong dengan pesan error yang jelas dan spesifik
- Format keluaran fleksibel: mendukung representasi **Base64** dan **Heksadesimal** lengkap dengan tombol salin
- Deteksi format otomatis saat dekripsi teks (dapat menerima masukan Base64 maupun Hex)
- Halaman pengujian lengkap dengan 5 skenario wajib:
  1. Uji kebenaran dekripsi (10 data uji termasuk dokumen PDF & citra PNG nyata)
  2. Uji waktu enkripsi/dekripsi (1 KB, 1 MB, 10 MB) dengan indikator progress
  3. Uji Avalanche Effect akurat (salt & IV tetap untuk mengukur difusi murni AES)
  4. Uji entropi & histogram byte (perbandingan plainteks vs cipherteks)
  5. Perbandingan algoritma (AES-GCM vs AES-CBC beserta uji tampering)
- Fitur pengayaan edukatif: visualisasi citra mode ECB vs mode aman (AES-GCM) dengan downscale otomatis dan kunci dinamis
- 8 unit test fungsi inti dan serialisasi yang dapat dijalankan langsung di browser

## Struktur Proyek

```
TUGAS-PROYEK-APLIKASI-KRIPTOGRAFI/
├── index.html                 Halaman utama: enkripsi & dekripsi teks/berkas (Base64 & Hex)
├── testing.html               Halaman pengujian (5 skenario wajib pengujian kuantitatif)
├── enrichment.html            Halaman pengayaan edukasi: visualisasi pola ECB vs AES-GCM
├── css/
│   ├── tokens.css               Design tokens warna & tipografi (Dark/Light mode)
│   ├── base.css                 Reset, gaya dasar body, & struktur layout
│   ├── components.css           Komponen bersama (topbar, panel, tombol, form, dll.)
│   ├── responsive.css           Media queries & preferensi Reduced Motion
│   └── pages/
│       ├── testing.css          Styling khusus halaman testing.html
│       └── enrichment.css       Styling khusus halaman enrichment.html
├── js/
│   ├── crypto.js                Logika inti kriptografi (AES-GCM, AES-CBC, PBKDF2, Hex/Base64)
│   ├── main.js                  Penghubung UI ke kriptografi, serialisasi paket, & penanganan berkas
│   ├── testing.js               Logika 5 skenario pengujian wajib & pemuatan sampel berkas
│   ├── enrichment.js            Logika visualisasi enkripsi blok ECB vs mode aman GCM
│   ├── testing-app.js           Orkestrasi UI halaman testing (konfigurasi & render hasil uji)
│   └── enrichment-app.js        Orkestrasi UI halaman enrichment (pemrosesan citra ke canvas)
├── tests/
│   ├── unit-tests.html        Runner unit test berbasis browser
│   └── unit-tests.js          8 unit test untuk fungsi inti & validasi integritas
└── assets/sample-files/
    ├── sample-image.png       Berkas citra PNG asli untuk pengujian dekripsi
    └── sample-document.pdf    Berkas dokumen PDF asli untuk pengujian dekripsi
```

## Cara Menjalankan

Aplikasi ini tidak memerlukan instalasi, server backend, atau dependensi eksternal apa pun karena seluruh logika kriptografi berjalan di browser menggunakan **Web Crypto API** bawaan.

1. Unduh atau clone repositori ini:
   ```bash
   git clone https://github.com/dollette05/TUGAS-PROYEK-APLIKASI-KRIPTOGRAFI.git
   ```
2. Buka berkas `index.html` langsung di browser (Chrome, Firefox, Edge, atau Safari), **atau** jalankan via web server statis lokal:
   ```bash
   npx serve .
   ```
   *Catatan:* Menjalankan lewat server lokal (seperti `npx serve`) direkomendasikan agar pengujian berkas nyata pada `testing.html` dapat memuat file PDF/PNG via `fetch` tanpa hambatan kebijakan CORS berkas lokal.
3. Untuk melihat pengujian kuantitatif, buka `testing.html` lalu klik **"Jalankan Semua Pengujian"**.
4. Untuk melihat visualisasi citra ECB, buka `enrichment.html`.
5. Untuk menjalankan unit test, buka `tests/unit-tests.html`.

Aplikasi ini juga dapat diakses secara daring melalui GitHub Pages di:  
🔗 **https://dollette05.github.io/TUGAS-PROYEK-APLIKASI-KRIPTOGRAFI/**

## Contoh Penggunaan

**Enkripsi teks:**
1. Buka `index.html`, pilih mode "Teks"
2. Ketik teks yang ingin dienkripsi dan masukkan kata sandi
3. Klik "Enkripsi" — hasil cipherteks (Base64) akan muncul dan dapat disalin

**Enkripsi berkas:**
1. Pilih mode "Berkas", seret atau pilih berkas (gambar/PDF/lainnya)
2. Masukkan kata sandi, klik "Enkripsi & Unduh"
3. Berkas hasil enkripsi (`.enc`) otomatis terunduh

**Dekripsi:**
1. Masukkan cipherteks atau unggah berkas `.enc`
2. Masukkan kata sandi yang sama, klik "Dekripsi"
3. Jika kata sandi salah atau data telah diubah, aplikasi akan menampilkan pesan penolakan

## Algoritma yang Digunakan

- **AES-256-GCM** — algoritma utama, menyediakan enkripsi sekaligus verifikasi keutuhan data (authenticated encryption)
- **AES-256-CBC** — digunakan sebagai pembanding pada halaman pengujian untuk mengilustrasikan perbedaan mode operasi (CBC tidak memiliki verifikasi keutuhan data bawaan seperti GCM)
- **PBKDF2** (SHA-256, 100.000 iterasi) — key derivation dari kata sandi

## Catatan Penggunaan AI

Sebagian kode dan struktur proyek pada repositori ini disusun dengan bantuan asisten AI (Claude, Anthropic), khususnya pada penulisan boilerplate antarmuka dan kerangka fungsi pengujian. Logika kriptografi inti menggunakan Web Crypto API bawaan browser sesuai ketentuan tugas.

## Lisensi

Proyek ini dibuat untuk keperluan tugas akademik Mata Kuliah Keamanan Informasi, Universitas Siliwangi.
