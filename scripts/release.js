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

const releaseNotes = `## Apa yang Baru di Versi ${version}
- **Auto-Detect Arsitektur 32-bit & 64-bit:** Aplikasi kini secara otomatis mendeteksi apakah ponsel pengguna berbasis 32-bit (HP jadul / entry-level) atau 64-bit (HP modern). Saat pembaruan, ponsel 32-bit akan otomatis mengunduh paket 32-bit (armeabi-v7a) yang 100% kompatibel tanpa error.
- **Dukungan Maksimal HP Jadul:** Menambahkan izin kelonggaran hardware pada AndroidManifest agar ponsel tanpa sensor biometrik atau kamera autofocus tetap dapat menginstal dan memperbarui aplikasi secara lancar.
- **Ketersediaan Varian APK Lengkap:** Menyediakan varian Universal APK, ARM64-v8a, dan ARMv7 32-bit di rilis GitHub.
- **CBT Jawaban Bergambar & Multi-Rombel:** Siswa dapat melihat gambar pada pilihan jawaban (opsi A-E) dan guru dapat menentukan multi-rombel sasaran ujian.`;

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
    }

    // 2. Siapkan file APK 64-bit arm64-v8a (Untuk HP modern 64-bit)
    if (fs.existsSync(arm64Apk)) {
        const destArm64 = path.join(releaseDir, `sipenafs-mobile-${tagName}-arm64.apk`);
        fs.copyFileSync(arm64Apk, destArm64);
        assetsToUpload.push({ path: destArm64, name: `sipenafs-mobile-${tagName}-arm64.apk` });
    }

    // 3. Siapkan file APK 32-bit armeabi-v7a (Khusus HP jadul 32-bit)
    if (fs.existsSync(armeabiApk)) {
        const destV7a = path.join(releaseDir, `sipenafs-mobile-${tagName}-armeabi-v7a.apk`);
        fs.copyFileSync(armeabiApk, destV7a);
        assetsToUpload.push({ path: destV7a, name: `sipenafs-mobile-${tagName}-armeabi-v7a.apk` });
    }

    // 4. File APK Utama (Default untuk download manual: utamakan universal agar aman 100% untuk semua HP)
    const primarySrc = fs.existsSync(universalApk) ? universalApk : (fs.existsSync(arm64Apk) ? arm64Apk : (fs.existsSync(releaseApk) ? releaseApk : null));
    if (primarySrc) {
        const dest = path.join(releaseDir, `sipenafs-mobile-${tagName}.apk`);
        fs.copyFileSync(primarySrc, dest);
        assetsToUpload.push({ path: dest, name: `sipenafs-mobile-${tagName}.apk` });
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
