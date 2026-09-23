# Brankas Digital — Aplikasi Enkripsi Modern

Aplikasi web untuk mengenkripsi dan mendekripsi teks maupun berkas (gambar, PDF, dan format lainnya) menggunakan algoritma kriptografi modern **AES-256-GCM** dan **AES-256-CBC**. Seluruh proses berjalan sepenuhnya di sisi klien (browser) tanpa server maupun basis data — data yang diproses tidak pernah dikirim ke mana pun.

Tugas Proyek Aplikasi Kriptografi — Mata Kuliah Keamanan Informasi
Program Studi Informatika, Fakultas Teknik, Universitas Siliwangi

## Anggota Kelompok

| Nama | NPM |
|---|---|
| (nama anggota 1) | (NPM anggota 1) |
| (nama anggota 2) | (NPM anggota 2) |
| (nama anggota 3) | (NPM anggota 3) |

## Fitur

- Enkripsi & dekripsi teks maupun berkas dengan AES-256-GCM (algoritma utama) dan AES-256-CBC (pembanding)
- Kunci diturunkan dari kata sandi menggunakan PBKDF2 (100.000 iterasi) dengan salt acak
- IV/nonce acak dibangkitkan untuk setiap proses enkripsi
- Penolakan dekripsi otomatis jika kata sandi salah atau data telah diubah (verifikasi tag GCM)
- Cipherteks dapat ditampilkan dan disalin dalam format Base64
- Halaman pengujian dengan 5 skenario wajib: uji kebenaran, uji kecepatan, avalanche effect, entropi & histogram, serta perbandingan algoritma

## Struktur Proyek

```
kripto-enkripsi-modern/
├── index.html              Halaman utama: enkripsi & dekripsi teks/berkas
├── testing.html             Halaman pengujian (5 skenario wajib)
├── css/style.css             Styling aplikasi
├── js/
│   ├── crypto.js             Logika inti AES-256-GCM & AES-256-CBC
│   ├── testing.js            Logika 5 pengujian wajib
│   └── main.js               Penghubung UI ke logika kriptografi
├── tests/
│   ├── unit-tests.html       Halaman untuk menjalankan unit test
│   └── unit-tests.js         6 unit test untuk fungsi inti
└── assets/sample-files/      Contoh berkas untuk pengujian
```

## Cara Menjalankan

Aplikasi ini tidak memerlukan instalasi, server, atau dependency apa pun karena seluruh logika kriptografi menggunakan **Web Crypto API** bawaan browser.

1. Unduh atau clone repositori ini
   ```
   git clone <url-repositori-ini>
   ```
2. Buka file `index.html` langsung di browser (Chrome, Firefox, Edge, atau Safari versi terbaru), **atau** jalankan lewat server statis lokal, misalnya:
   ```
   npx serve .
   ```
3. Untuk melihat hasil pengujian, buka `testing.html` lalu klik tombol **"Jalankan Semua Pengujian"**.
4. Untuk melihat hasil unit test, buka `tests/unit-tests.html`.

Aplikasi juga dapat diakses secara daring melalui GitHub Pages di: **(tautan GitHub Pages akan ditambahkan di sini)**

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
