# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Rules

- **ATURAN WAJIB & SANGAT KETAT**:
  Setiap penambahan atau perubahan fitur WAJIB diperiksa dan diuji secara teliti untuk memastikan TIDAK ADA BUGS CODE atau runtime error (termasuk validasi null-safety, pencegahan `TypeError: Cannot read properties of undefined`) SEBELUM melakukan `git commit` dan `git push`!

- **ATURAN DEPLOYMENT WEBHOOK (3 SEKOLAH)**:
  Sistem server SIPENAFS (VPS `103.87.66.200` untuk SMAN 1 Dukupuntang, SMAN 4 Kota Cirebon, dan SMAN 2 Kota Cirebon) sudah menggunakan integrasi **aaPanel WebHook**. Setiap deploy/pembaruan dijalankan secara otomatis melalui WebHook (pull update, prisma db push, build frontend, dan reload PM2 cluster).

- **ATURAN RILIS UPDATE OTOMATIS ANDROID (sipenafs-mobile)**:
  Setiap kali ada perbaikan, penambahan fitur, atau bugfix pada project Android (`sipenafs-mobile`), WAJIB otomatis melakukan bump version di `app.json` dan `package.json`, compile APK release (`gradlew assembleRelease`), dan mempublikasikan GitHub Release via `node scripts/release.js` agar sistem **In-App Auto-Update** di aplikasi Android pengguna langsung mendeteksi rilis baru dan mengunduh pembaruan secara otomatis!
