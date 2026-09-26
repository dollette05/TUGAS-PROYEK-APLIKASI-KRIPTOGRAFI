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

## Halaman Web

| Halaman | Fungsi |
|---|---|
| `index.html` (Beranda) | Landing page: penjelasan cara kerja 3 langkah, perbedaan GCM vs CBC, dan navigasi ke semua fitur |
| `enkripsi.html` | Alat utama: enkripsi & dekripsi teks (Base64/Hex + tombol salin) dan berkas (`.enc` biner) |
| `testing.html` | Pengujian kuantitatif: 5 skenario wajib + 8 unit test logika inti |
| `enrichment.html` | Pengayaan edukatif: visualisasi citra mode ECB vs mode aman (AES-GCM) |

## Fitur

- Enkripsi & dekripsi teks maupun berkas dengan **AES-256-GCM** (algoritma utama) dan **AES-256-CBC** (pembanding)
- Kunci diturunkan dari kata sandi menggunakan **PBKDF2** (SHA-256, 100.000 iterasi) dengan salt acak CSPRNG
- IV/nonce acak dibangkitkan untuk setiap proses enkripsi (12 byte GCM, 16 byte CBC)
- Penolakan dekripsi otomatis jika kata sandi salah atau data telah diubah (*authenticated encryption tag failure* pada GCM)
- Validasi berkas `.enc` rusak/terpotong dengan pesan error yang jelas dan spesifik
- Batas ukuran berkas 50 MB agar browser tidak hang, plus panduan enkripsi banyak berkas via `.zip`
- Format keluaran fleksibel: representasi **Base64** dan **Heksadesimal** lengkap dengan tombol salin
- Deteksi format otomatis saat dekripsi teks (menerima masukan Base64 maupun Hex)
- Tombol lihat/tutup kata sandi di semua form (satu ikon per field)
- Halaman pengujian lengkap dengan 5 skenario wajib:
  1. Uji kebenaran dekripsi (10 data uji termasuk dokumen PDF & citra PNG nyata)
  2. Uji waktu enkripsi/dekripsi (1 KB, 1 MB, 10 MB) dengan indikator progress
  3. Uji Avalanche Effect akurat (salt & IV dinolkan untuk mengukur difusi murni AES)
  4. Uji entropi & histogram byte (GCM vs CBC pada plainteks yang sama)
  5. Perbandingan algoritma (AES-GCM vs AES-CBC beserta uji tampering)
- Fitur pengayaan edukatif: visualisasi citra mode ECB vs mode aman (AES-GCM) dengan downscale otomatis (maks 256px) dan kunci acak per proses
- 8 unit test fungsi inti dan serialisasi yang dapat dijalankan langsung di browser (`tests/unit-tests.html`)

## Struktur Proyek

```
TUGAS-PROYEK-APLIKASI-KRIPTOGRAFI/
├── index.html                 Beranda: hero, cara kerja, GCM vs CBC, navigasi fitur
├── enkripsi.html              Alat utama: enkripsi & dekripsi teks/berkas (Base64 & Hex)
├── testing.html               Halaman pengujian (5 skenario wajib pengujian kuantitatif)
├── enrichment.html            Halaman pengayaan edukasi: visualisasi pola ECB vs AES-GCM
├── css/
│   ├── tokens.css               Design tokens warna & tipografi (Dark/Light mode)
│   ├── base.css                 Reset, gaya dasar body, & struktur layout
│   ├── components.css           Komponen bersama (topbar, panel, tombol, form, dll.)
│   ├── responsive.css           Media queries & preferensi Reduced Motion
│   └── pages/
│       ├── beranda.css          Styling khusus halaman beranda (index.html)
│       ├── testing.css          Styling khusus halaman testing.html
│       └── enrichment.css       Styling khusus halaman enrichment.html
├── js/
│   ├── crypto.js                Logika inti kriptografi (AES-GCM, AES-CBC, PBKDF2, Hex/Base64)
│   ├── main.js                  Penghubung UI enkripsi ke kriptografi, serialisasi paket, & penanganan berkas
│   ├── testing.js               Logika 5 skenario pengujian wajib & pemuatan sampel berkas
│   ├── enrichment.js            Logika visualisasi enkripsi blok ECB vs mode aman GCM
│   ├── testing-app.js           Orkestrasi UI halaman testing (konfigurasi & render hasil uji)
│   ├── enrichment-app.js        Orkestrasi UI halaman enrichment (pemrosesan citra ke canvas)
│   └── ui.js                    Tema, toggle lihat password, & feedback tombol salin
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
2. Buka berkas `index.html` langsung di browser (Chrome, Firefox, Edge, atau Safari) untuk masuk ke **Beranda**, **atau** jalankan via web server statis lokal:
   ```bash
   npx serve .
   ```
   *Catatan:* Menjalankan lewat server lokal (seperti `npx serve`) direkomendasikan agar pengujian berkas nyata pada `testing.html` dapat memuat file PDF/PNG via `fetch` tanpa hambatan kebijakan CORS berkas lokal. Web Crypto API juga hanya aktif di konteks aman (HTTPS/`localhost`) — membuka via `file://` akan menampilkan pesan panduan, bukan error samar.
3. Dari Beranda, klik **"Mulai Enkripsi"** untuk ke `enkripsi.html`, atau buka `testing.html` lalu klik **"Jalankan Semua Pengujian"** untuk melihat pengujian kuantitatif.
4. Untuk melihat visualisasi citra ECB, buka `enrichment.html`.
5. Untuk menjalankan unit test, buka `tests/unit-tests.html`.

Aplikasi ini juga dapat diakses secara daring melalui GitHub Pages di:  
🔗 **https://dollette05.github.io/TUGAS-PROYEK-APLIKASI-KRIPTOGRAFI/**

## Contoh Penggunaan

**Enkripsi teks:**
1. Buka `index.html`, klik "Mulai Enkripsi" (masuk ke `enkripsi.html`), pilih mode "Teks"
2. Ketik teks yang ingin dienkripsi dan masukkan kata sandi
3. Klik "Enkripsi" — hasil cipherteks (Base64/Hex) akan muncul dan dapat disalin

**Enkripsi berkas:**
1. Pilih mode "Berkas", seret atau pilih berkas (gambar/PDF/lainnya, maks. 50 MB)
2. Masukkan kata sandi, klik "Enkripsi & Unduh"
3. Berkas hasil enkripsi (`.enc`, format biner — jangan dibuka di Notepad) otomatis terunduh. Untuk banyak berkas, bungkus dulu jadi `.zip` lalu enkripsi file zip-nya

**Dekripsi:**
1. Masukkan cipherteks atau unggah berkas `.enc`
2. Pastikan mode algoritma sama dengan saat enkripsi (GCM ↔ GCM, CBC ↔ CBC), masukkan kata sandi yang sama, klik "Dekripsi"
3. Jika kata sandi salah atau data telah diubah, aplikasi akan menampilkan pesan penolakan (GCM menolak otomatis via auth tag)

## Algoritma yang Digunakan

- **AES-256-GCM** — algoritma utama, menyediakan enkripsi sekaligus verifikasi keutuhan data (authenticated encryption, auth tag 128-bit)
- **AES-256-CBC** — digunakan sebagai pembanding pada halaman pengujian untuk mengilustrasikan perbedaan mode operasi (CBC tidak memiliki verifikasi keutuhan data bawaan seperti GCM)
- **PBKDF2** (SHA-256, 100.000 iterasi) — key derivation dari kata sandi dengan salt acak 16 byte
- **ECB** — hanya disimulasikan (CBC + IV nol per blok) di `enrichment.html` sebagai visualisasi edukasi kelemahannya, tidak dipakai untuk data asli

## Catatan Penggunaan AI

Sebagian kode dan struktur proyek pada repositori ini disusun dengan bantuan asisten AI (Claude, Anthropic), khususnya pada penulisan boilerplate antarmuka dan kerangka fungsi pengujian. Logika kriptografi inti menggunakan Web Crypto API bawaan browser sesuai ketentuan tugas.

## Lisensi

Proyek ini dibuat untuk keperluan tugas akademik Mata Kuliah Keamanan Informasi, Universitas Siliwangi.
