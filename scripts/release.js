const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
const version = appJson.expo.version;
const tagName = `v${version}`;
const releaseName = `SIPENAFS Mobile v${version}`;

function getGithubToken() {
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
    if (process.env.GH_TOKEN) return process.env.GH_TOKEN.trim();

    const envFiles = [
        path.join(__dirname, '../.env.local'),
        path.join(__dirname, '../.env.release'),
        path.join(__dirname, '../.env')
    ];
    for (const f of envFiles) {
        if (fs.existsSync(f)) {
            const content = fs.readFileSync(f, 'utf8');
            const match = content.match(/GITHUB_TOKEN\s*=\s*["']?([^"'\r\n]+)/);
            if (match && match[1]) return match[1].trim();
        }
    }

    try {
        const { execSync } = require('child_process');
        const token = execSync('git config --get github.token', { encoding: 'utf8' }).trim();
        if (token) return token;
    } catch (e) {}

    return null;
}

const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'fathxmarka/sipenafs-mobile';
const GITHUB_TOKEN = getGithubToken();

if (!GITHUB_TOKEN) {
    console.error('ERROR: GITHUB_TOKEN tidak ditemukan. Harap set di .env.local atau environment variable.');
    process.exit(1);
}

const releaseNotes = `PANDUAN & LINK DOWNLOAD APK SIPENAFS MOBILE

Pilih link unduh di bawah ini sesuai dengan kondisi perangkat Anda:

1. Link Download Utama (UNIVERSAL - Rekomendasi Semua HP)
Kompatibel untuk SEMUA tipe HP Android (HP Modern 64-bit maupun HP Jadul 32-bit).
Gunakan link ini jika Anda tidak yakin dengan spesifikasi HP Anda agar dijamin 100% langsung terpasang tanpa kendala.

Download SIPENAFS Universal APK (Semua HP): https://github.com/${GITHUB_REPO}/releases/download/${tagName}/sipenafs-mobile-universal.apk
Link alternatif: https://github.com/${GITHUB_REPO}/releases/download/${tagName}/sipenafs-mobile.apk

2. Khusus HP Jadul / Entry-Level (32-Bit / armeabi-v7a)
Ukuran Lebih Ringan (~51 MB), dikhususkan untuk ponsel lama atau spek entry-level berarsitektur 32-bit:
https://github.com/${GITHUB_REPO}/releases/download/${tagName}/sipenafs-mobile-32bit.apk

3. Khusus HP Modern (64-Bit / arm64-v8a)
Ukuran Ringan & Performa Maksimal (~59 MB), dikhususkan untuk ponsel keluaran terbaru berarsitektur 64-bit:
https://github.com/${GITHUB_REPO}/releases/download/${tagName}/sipenafs-mobile-64bit.apk

Tautan Permanen Versi Terbaru:
- Universal: https://github.com/${GITHUB_REPO}/releases/latest/download/sipenafs-mobile.apk
- Khusus 32-Bit: https://github.com/${GITHUB_REPO}/releases/latest/download/sipenafs-mobile-32bit.apk
- Khusus 64-Bit: https://github.com/${GITHUB_REPO}/releases/latest/download/sipenafs-mobile-64bit.apk

Apa yang Baru di Versi ${version}:
• Peningkatan Penulisan Harakat Bahasa Arab di Jawaban Esai CBT Siswa:
  - Panel khusus Harakat lengkap dengan label jelas (Fathah, Kasrah, Dammah, Fathatain, Kasratain, Dammatain, Sukun, Tasydid, Alif Mad, Maddah) plus tombol cepat Tasydid+Harakat (1-tap), tombol Hapus Harakat, Huruf Hijaiyah, Lafadz اللّٰه, dan Angka Arab (٠-٩).
  - Otomatis mengaktifkan tab "Arab & Harakat", arah baca RTL, font lebih besar & lega (anti-terpotong), non-autocorrect untuk teks Arab, serta normalisasi urutan Unicode Tasydid+Vokal agar harakat tidak bertumpuk di Android.
  - Pratinjau langsung (Live Preview) tulisan Arab berharakat di bawah kolom esai dan dukungan ketuk harakat 1x tanpa menutup keyboard HP.
• Peningkatan keamanan hak akses pengguna (RBAC) serta sinkronisasi penuh data master sekolah di seluruh modul Android.
• Fitur Pengumuman Terpadu & Sasaran Kelas Dinamis:
  - Pengumuman resmi dari Pimpinan / Admin / TU / Operator kini langsung muncul di kartu Notifikasi Terbaru Beranda, Menu Notifikasi (tab Pengumuman), dan dapat diklik untuk membaca rincian pengumuman penuh.
  - Pengelola (Admin, Kepsek, Wakasek, TU, Operator) kini memiliki tab "Pengumuman" khusus di modul Kurikulum & Jadwal (disembunyikan dari Guru biasa & Siswa) dengan filter sasaran dinamis: Semua Civitas, Guru & Staf, atau Siswa/Orang Tua (Semua Kelas vs Kelas Tertentu) plus opsi kirim via WhatsApp Broadcast.
• Pengurutan Soal Acak & Submit Andal (PG, PGK Kompleks, Esai):
  - Soal Pilihan Ganda (PG & PGK) selalu diacak di bagian awal, dan soal Esai selalu ditempatkan di urutan terakhir (tidak pernah menyisip di tengah soal PG).
  - Pemisahan grup "Pilihan Ganda & PGK" vs "Esai / Uraian" di Daftar Nomor Soal Android.
  - Normalisasi otomatis payload jawaban PG, PGK (multi-jawaban), dan Esai (teks + lampiran foto) saat submit, indikator proses kirim, dan status hasil "Menunggu Koreksi Esai Guru" yang akurat.
• Dukungan Penuh Soal PG Multi Jawaban (PGK / Pilihan Ganda Kompleks) untuk Siswa & Guru:
  - Normalisasi tipe soal (PGK, pgk, PG Kompleks, PG_KOMPLEKS) dan pemulihan jawaban tersimpan baik format string maupun object dari server.
  - Indikator badge "PG MULTI JAWABAN" serta status pilihan aktif ("Terpilih: A, C") dan penghapusan otomatis status terjawab jika semua opsi di-uncheck.
  - Guru kini dapat membuat dan mengedit soal bertipe PG Tunggal, PGK (Multi Jawaban), maupun Esai langsung dari aplikasi Android (baik di Ujian maupun Bank Soal).
• Dukungan Penuh Rumus Sains & Multibahasa CBT (Matematika, Fisika, Kimia, Biologi, Arab, Mandarin):
  - Rendering KaTeX Offline Hybrid untuk rumus bertingkat (pecahan, akar, integral, matriks, reaksi kimia) langsung di layar ujian Android tanpa koneksi internet luar.
  - Deteksi otomatis arah baca RTL (Right-to-Left) & line-height lega untuk Bahasa Arab berharakat serta Bahasa Mandarin/CJK agar tidak terpotong.
• Panel Simbol Ilmiah & Mini Keyboard Arab pada Jawaban Esai:
  - Toolbar simbol Matematika, Pangkat/Subscript Kimia & Biologi, Yunani, Kalkulus, Template Rumus LaTeX + Live Preview, serta Keyboard Hijaiyah + Harakat untuk menjawab soal esai langsung dari aplikasi.
• Perbaikan Tampilan PG Jawaban Bergambar & Gambar Soal di Android:
  - Mengatasi bug layout flexbox yang menjepit gambar opsi PG/PGK, normalisasi URL gambar & opsi Array, menampilkan gambar soal (image_url dan inline img), serta tombol Perbesar (Zoom Overlay anti-pelanggaran).
• Validasi Pengaturan Ujian CBT (Kunci Selesai Ujian Lebih Awal):
  - Tombol "Selesai Ujian" di layar ujian dan drawer nomor soal terkunci otomatis jika pengajar menonaktifkan "Izinkan Selesai Ujian Lebih Awal".
  - Menampilkan sisa waktu tunggu dinamis pada tombol ("Terkunci (Xm lagi)") serta pesan notifikasi informatif jika siswa mencoba menyelesaikan ujian sebelum batas waktu minimal tercapai.
• Peningkatan Dukungan Multi-Rombel CBT:
  - Siswa dari seluruh rombel/kelas yang terdaftar dalam multi-rombel kini dapat mengakses ujian secara serentak dan akurat.
  - Catatan: Jika pada HP Anda sebelumnya terpasang versi aplikasi dengan kunci penandatanganan berbeda, harap copot pemasangan (uninstall) versi lama terlebih dahulu sebelum memasang file APK ini.
• Peningkatan Stabilitas Sesi & Auto-Logout Bersih:
  - Deteksi sesi kadaluarsa (401) otomatis mengarahkan ke halaman login secara bersih dan ramah pengguna.
  - Multi-perangkat untuk Staf (Admin, Operator, Guru): Login di Web tidak akan menendang sesi di HP Android.
  - Peningkatan durasi sesi login hingga 1 tahun.
• Sinkronisasi Real-Time KPI Cards Dashboard Pimpinan & Operator:
  - Jumlah siswa, guru, dan kelas terikat langsung ke data server tanpa keterlambatan.
• Pembersihan & Sinkronisasi Real-Data E-Voting & Kalender Pendidikan:
  - Menghapus seluruh data mockup/dummy hardcoded pada modul E-Voting dan Kalender Pendidikan.
  - Tampilan E-Voting & TPS kini 100% membaca data real dari server atau menampilkan empty state yang rapi jika belum ada agenda pemilihan aktif.
  - Kalender Pendidikan kini 100% membaca agenda resmi dari server atau menampilkan status agenda belum dijadwalkan secara bersih tanpa data rekayasa/dummy.
• Peningkatan Stabilitas & Null-Safety pada E-Voting dan Kalender Akademik.
• Peningkatan Fitur Pencarian Lengkap di Seluruh Modul Android & Web.
• Sistem Rilis Aman (Draft-First Release): Notifikasi update di aplikasi hanya muncul SETELAH semua berkas APK 100% selesai diunggah ke GitHub. Tidak ada error "Problem parsing the package" karena unduhan belum siap.
• Optimalisasi Biometrik Wajah Anti-False Alarm: Ambang batas jarak pencocokan wajah disesuaikan (0.74) dan toleransi sudut menunduk saat menatap layar HP ditingkatkan agar siswa tidak terkena peringatan keliru saat posisi kepala menunduk wajar.
• Proctoring Dinamis Sesuai Pengaturan Ujian: Pengawasan kamera AI dan kunci tab/layar sepenuhnya mengikuti pengaturan masing-masing ujian (tidak di-hardcode). Ujian tanpa proctoring tidak akan meminta izin kamera atau mengunci layar.
• Validasi Integritas APK: Sebelum install, aplikasi memverifikasi ukuran dan format berkas unduhan untuk memastikan APK valid dan utuh.
• Sinkronisasi Face ID Otomatis Web dan Android: Data biometrik wajah dari Android maupun Web 100% seragam dan langsung tersinkron otomatis.
• Verifikasi Biometrik Anti-Joki On-Device: Pengawasan kamera bebas kedip, cepat, offline, dan ringan.
• Auto-Unlock Real-Time dan Penilaian CBT Akurat: Pembukaan kunci otomatis via Socket serta penyimpanan dan skor akhir berjalan instan.`;

function githubRequest(method, endpoint, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: {
                'User-Agent': 'SIPENAFS-Release-Bot',
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = body ? JSON.parse(body) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`GitHub API Error (${res.statusCode}): ${parsed.message || body}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`GitHub API Error (${res.statusCode}): ${body}`));
                    }
                }
            });
        });

        req.on('error', reject);
        if (data) {
            if (Buffer.isBuffer(data)) {
                req.write(data);
            } else {
                req.write(typeof data === 'string' ? data : JSON.stringify(data));
            }
        }
        req.end();
    });
}

async function uploadAsset(uploadUrl, filePath, fileName, maxRetries = 4) {
    const cleanUploadUrl = uploadUrl.replace(/\{.*\}/, '') + `?name=${encodeURIComponent(fileName)}`;
    const stats = fs.statSync(filePath);
    const totalBytes = stats.size;
    const sizeMb = (totalBytes / (1024 * 1024)).toFixed(2);
    console.log(`Mengunggah ${fileName} (${sizeMb} MB)...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await new Promise((resolve, reject) => {
                const urlObj = new URL(cleanUploadUrl);
                const req = https.request({
                    hostname: urlObj.hostname,
                    path: urlObj.pathname + urlObj.search,
                    method: 'POST',
                    family: 4,
                    headers: {
                        'User-Agent': 'SIPENAFS-Release-Bot',
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/vnd.android.package-archive',
                        'Content-Length': totalBytes
                    }
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            try { resolve(JSON.parse(body)); } catch (_) { resolve({ success: true }); }
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
                        }
                    });
                });

                req.setTimeout(180000, () => {
                    req.destroy(new Error('Upload socket timeout (180s)'));
                });
                req.on('error', reject);

                let uploaded = 0;
                let lastLoggedPct = -1;
                const rs = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });
                rs.on('data', (chunk) => {
                    uploaded += chunk.length;
                    const pct = Math.floor((uploaded / totalBytes) * 100);
                    if (pct >= lastLoggedPct + 25 || pct === 100) {
                        lastLoggedPct = pct;
                        console.log(`  [${fileName}] ${pct}% (${(uploaded / (1024 * 1024)).toFixed(1)}/${sizeMb} MB)`);
                    }
                });
                rs.on('error', (err) => req.destroy(err));
                rs.pipe(req);
            });
            return result;
        } catch (e) {
            console.warn(`Upaya ${attempt}/${maxRetries} gagal mengunggah ${fileName}: ${e.message}`);
            if (attempt === maxRetries) throw e;
            await new Promise(res => setTimeout(res, 3000));
        }
    }
}

async function main() {
    console.log(`=== Memulai Rilis GitHub: ${tagName} ===`);
    
    // 1. Cek atau Buat Release di GitHub
    let release;
    let createdAsDraft = false;
    try {
        console.log(`Membuat rilis GitHub untuk tag ${tagName} (DRAFT)...`);
        release = await githubRequest('POST', `/repos/${GITHUB_REPO}/releases`, {
            tag_name: tagName,
            name: releaseName,
            body: releaseNotes,
            draft: true,
            prerelease: false
        });
        createdAsDraft = true;
        console.log(`Rilis DRAFT ${tagName} berhasil dibuat! ID: ${release.id}`);
    } catch (err) {
        if (err.message && (err.message.includes('already_exists') || err.message.includes('Validation Failed') || err.message.includes('422'))) {
            console.log(`Rilis ${tagName} sudah ada, mengambil data rilis...`);
            // Coba ambil rilis non-draft dulu
            try {
                release = await githubRequest('GET', `/repos/${GITHUB_REPO}/releases/tags/${tagName}`);
            } catch (e2) {
                // Jika gagal, kemungkinan rilis masih draft — cari dari daftar semua rilis
                console.log('Mencari rilis draft...');
                const allReleases = await githubRequest('GET', `/repos/${GITHUB_REPO}/releases`);
                release = allReleases.find(r => r.tag_name === tagName);
                if (!release) throw new Error(`Rilis ${tagName} tidak ditemukan.`);
            }
            if (release.draft) {
                createdAsDraft = true;
                console.log(`Rilis ${tagName} ditemukan sebagai DRAFT (ID: ${release.id})`);
            }
        } else {
            throw err;
        }
    }

    // 2. Cari file APK di direktori output Gradle
    const releaseDir = path.join(__dirname, '../android/app/build/outputs/apk/release');
    if (!fs.existsSync(releaseDir)) {
        throw new Error(`Direktori rilis APK tidak ditemukan di: ${releaseDir}`);
    }

    const arm64Apk = path.join(releaseDir, 'app-arm64-v8a-release.apk');
    const armeabiApk = path.join(releaseDir, 'app-armeabi-v7a-release.apk');
    const universalApk = path.join(releaseDir, 'app-universal-release.apk');
    const releaseApk = path.join(releaseDir, 'app-release.apk');

    const assetsToUpload = [];

    // 1. File APK 64-bit arm64-v8a (Digunakan oleh >90% ponsel modern)
    if (fs.existsSync(arm64Apk)) {
        const destArm64 = path.join(releaseDir, `sipenafs-mobile-${tagName}-arm64.apk`);
        fs.copyFileSync(arm64Apk, destArm64);
        assetsToUpload.push({ path: destArm64, name: `sipenafs-mobile-${tagName}-arm64.apk` });
    }

    // 2. File APK 32-bit armeabi-v7a (Khusus HP entry-level 32-bit)
    if (fs.existsSync(armeabiApk)) {
        const destStatic32 = path.join(releaseDir, 'sipenafs-mobile-32bit.apk');
        fs.copyFileSync(armeabiApk, destStatic32);
        assetsToUpload.push({ path: destStatic32, name: 'sipenafs-mobile-32bit.apk' });
    }

    // 3. File APK Universal / Utama (Kompatibel semua perangkat)
    const primarySrc = fs.existsSync(universalApk) ? universalApk : (fs.existsSync(arm64Apk) ? arm64Apk : (fs.existsSync(releaseApk) ? releaseApk : null));
    if (primarySrc) {
        const destStaticMain = path.join(releaseDir, 'sipenafs-mobile.apk');
        fs.copyFileSync(primarySrc, destStaticMain);
        assetsToUpload.push({ path: destStaticMain, name: 'sipenafs-mobile.apk' });
    }

    if (assetsToUpload.length === 0) {
        throw new Error('Tidak ada file APK yang ditemukan di folder output release.');
    }

    // 3. Upload masing-masing asset
    for (const asset of assetsToUpload) {
        // Hapus asset lama jika namanya sama sudah ada
        if (Array.isArray(release.assets)) {
            const existing = release.assets.find(a => a.name === asset.name);
            if (existing) {
                console.log(`Menghapus asset lama: ${asset.name}...`);
                try {
                    await githubRequest('DELETE', `/repos/${GITHUB_REPO}/releases/assets/${existing.id}`);
                } catch (e) {
                    console.warn(`Gagal hapus asset lama: ${e.message}`);
                }
            }
        }
        await uploadAsset(release.upload_url, asset.path, asset.name);
        console.log(`Berhasil mengunggah ${asset.name}!`);
    }

    // 4. Publikasikan rilis (un-draft) SETELAH semua asset berhasil terunggah
    if (createdAsDraft) {
        console.log(`\nSemua asset berhasil diunggah. Mempublikasikan rilis ${tagName}...`);
        try {
            await githubRequest('PATCH', `/repos/${GITHUB_REPO}/releases/${release.id}`, {
                draft: false
            });
            console.log(`Rilis ${tagName} berhasil dipublikasikan (un-draft)!`);
        } catch (pubErr) {
            console.error(`PERINGATAN: Gagal mempublikasikan rilis: ${pubErr.message}`);
            console.error('Rilis masih dalam status DRAFT. Publikasikan secara manual di GitHub.');
        }
    }

    console.log(`\n🎉 SUKSES: Rilis ${tagName} telah dipublikasikan di:`);
    console.log(`https://github.com/${GITHUB_REPO}/releases/tag/${tagName}`);
}

main().catch(err => {
    console.error('Gagal membuat rilis:', err.message);
    process.exit(1);
});
