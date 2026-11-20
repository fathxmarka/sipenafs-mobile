const fs = require('fs');
const path = require('path');
const https = require('https');

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
• Penyempurnaan Pendaftaran Face ID Biometrik: Penangkapan foto wajah lebih jernih dan menunggu izin kamera aktif agar ekstraksi biometrik 128-d akurat serta bebas bentrok di pendaftaran massal.
• Sinkronisasi Face ID Otomatis Web & Android: Data biometrik wajah dari Android maupun Web 100% seragam dan langsung tersinkron otomatis.
• Verifikasi Biometrik Anti-Joki On-Device & Audio Bahasa Indonesia Jernih: Pengawasan kamera bebas kedip, cepat, offline, dan ringan.
• Auto-Unlock Real-Time & Penilaian CBT Akurat: Pembukaan kunci otomatis via Socket serta penyimpanan dan skor akhir berjalan instan.`;

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

async function uploadAsset(uploadUrl, filePath, fileName, maxRetries = 3) {
    const cleanUploadUrl = uploadUrl.replace(/\{.*\}/, '') + `?name=${encodeURIComponent(fileName)}`;
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`Mengunggah ${fileName} (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await githubRequest('POST', cleanUploadUrl, fileBuffer, {
                'Content-Type': 'application/vnd.android.package-archive',
                'Content-Length': fileBuffer.length
            });
        } catch (e) {
            console.warn(`Upaya ${attempt}/${maxRetries} gagal mengunggah ${fileName}: ${e.message}`);
            if (attempt === maxRetries) throw e;
            await new Promise(res => setTimeout(res, 2500));
        }
    }
}

async function main() {
    console.log(`=== Memulai Rilis GitHub: ${tagName} ===`);
    
    // 1. Cek atau Buat Release di GitHub
    let release;
    try {
        console.log(`Membuat rilis GitHub untuk tag ${tagName}...`);
        release = await githubRequest('POST', `/repos/${GITHUB_REPO}/releases`, {
            tag_name: tagName,
            name: releaseName,
            body: releaseNotes,
            draft: false,
            prerelease: false
        });
        console.log(`Rilis ${tagName} berhasil dibuat! ID: ${release.id}`);
    } catch (err) {
        if (err.message && (err.message.includes('already_exists') || err.message.includes('Validation Failed') || err.message.includes('422'))) {
            console.log(`Rilis ${tagName} sudah ada, mengambil data rilis...`);
            release = await githubRequest('GET', `/repos/${GITHUB_REPO}/releases/tags/${tagName}`);
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

    // 1. Siapkan file APK UNIVERSAL (Sangat kompatibel untuk semua HP)
    if (fs.existsSync(universalApk)) {
        const destUniversal = path.join(releaseDir, `sipenafs-mobile-${tagName}-universal.apk`);
        fs.copyFileSync(universalApk, destUniversal);
        assetsToUpload.push({ path: destUniversal, name: `sipenafs-mobile-${tagName}-universal.apk` });

        // Asset statis permanen Universal
        const destStaticUniversal = path.join(releaseDir, 'sipenafs-mobile-universal.apk');
        fs.copyFileSync(universalApk, destStaticUniversal);
        assetsToUpload.push({ path: destStaticUniversal, name: 'sipenafs-mobile-universal.apk' });
    }

    // 2. Siapkan file APK 64-bit arm64-v8a (Untuk HP modern 64-bit)
    if (fs.existsSync(arm64Apk)) {
        const destArm64 = path.join(releaseDir, `sipenafs-mobile-${tagName}-arm64.apk`);
        fs.copyFileSync(arm64Apk, destArm64);
        assetsToUpload.push({ path: destArm64, name: `sipenafs-mobile-${tagName}-arm64.apk` });

        // Asset statis permanen 64-bit
        const destStatic64 = path.join(releaseDir, 'sipenafs-mobile-64bit.apk');
        fs.copyFileSync(arm64Apk, destStatic64);
        assetsToUpload.push({ path: destStatic64, name: 'sipenafs-mobile-64bit.apk' });
    }

    // 3. Siapkan file APK 32-bit armeabi-v7a (Khusus HP jadul 32-bit)
    if (fs.existsSync(armeabiApk)) {
        const destV7a = path.join(releaseDir, `sipenafs-mobile-${tagName}-armeabi-v7a.apk`);
        fs.copyFileSync(armeabiApk, destV7a);
        assetsToUpload.push({ path: destV7a, name: `sipenafs-mobile-${tagName}-armeabi-v7a.apk` });

        // Asset statis permanen 32-bit
        const destStatic32 = path.join(releaseDir, 'sipenafs-mobile-32bit.apk');
        fs.copyFileSync(armeabiApk, destStatic32);
        assetsToUpload.push({ path: destStatic32, name: 'sipenafs-mobile-32bit.apk' });
    }

    // 4. File APK Utama (Default untuk download manual: utamakan universal agar aman 100% untuk semua HP)
    const primarySrc = fs.existsSync(universalApk) ? universalApk : (fs.existsSync(arm64Apk) ? arm64Apk : (fs.existsSync(releaseApk) ? releaseApk : null));
    if (primarySrc) {
        const dest = path.join(releaseDir, `sipenafs-mobile-${tagName}.apk`);
        fs.copyFileSync(primarySrc, dest);
        assetsToUpload.push({ path: dest, name: `sipenafs-mobile-${tagName}.apk` });

        // Asset statis utama sipenafs-mobile.apk (Universal)
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

    console.log(`\n🎉 SUKSES: Rilis ${tagName} telah dipublikasikan di:`);
    console.log(`https://github.com/${GITHUB_REPO}/releases/tag/${tagName}`);
}

main().catch(err => {
    console.error('Gagal membuat rilis:', err.message);
    process.exit(1);
});
