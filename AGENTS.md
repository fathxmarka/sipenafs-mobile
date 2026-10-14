# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Rules

- **ATURAN WAJIB & SANGAT KETAT**:
  Setiap penambahan atau perubahan fitur WAJIB diperiksa dan diuji secara teliti untuk memastikan TIDAK ADA BUGS CODE atau runtime error (termasuk validasi null-safety, pencegahan `TypeError: Cannot read properties of undefined`) SEBELUM melakukan `git commit` dan `git push`!

- **ATURAN WAJIB RILIS APK (sipenafs-mobile)**:
  Setiap kali melakukan push ke GitHub branch main untuk sipenafs-mobile, WAJIB otomatis melakukan bump version di `app.json`, build APK release, serta membuat GitHub Release (tag `vX.X.X`) dan mengupload asset APK-nya agar notifikasi update otomatis terpicu di aplikasi Android pengguna!
