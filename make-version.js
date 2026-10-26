// استفاده: node make-version.js 4.6.4 "یادداشت۱" "یادداشت۲"
// هش SHA-256 فایل‌های انتشار را حساب و version.json را می‌سازد.
// نکته: خط‌پایان‌ها به LF نرمال می‌شوند تا هش با نسخهٔ GitHub یکی باشد.
const fs = require('fs'), c = require('crypto');

const files = [
    "index.html",
    "sw.js",
    "manifest.json",
    "icon-192.png",
    "icon-512.png",
    "icon-maskable-512.png",
    "apple-touch-icon.png",
    "favicon.png",
    // [audit-7] فونت‌های محلی
    "fonts/vazirmatn-arabic-400.woff2",
    "fonts/vazirmatn-arabic-500.woff2",
    "fonts/vazirmatn-arabic-600.woff2",
    "fonts/vazirmatn-arabic-700.woff2",
    "fonts/vazirmatn-latin-400.woff2",
    "fonts/vazirmatn-latin-500.woff2",
    "fonts/vazirmatn-latin-600.woff2",
    "fonts/vazirmatn-latin-700.woff2",
    "fonts/vazirmatn-fd-digits.woff2"
];

const [v, ...notes] = process.argv.slice(2);
if (!v) { console.error('نسخه را بدهید'); process.exit(1); }

const sha = {};
files.forEach(f => {
    let buf;
    try {
        buf = fs.readFileSync(f);
    } catch (e) {
        console.warn('⚠️  فایل پیدا نشد، نادیده گرفته شد: ' + f);
        return;
    }
    // برای فایل‌های متنی، خط‌پایان‌ها را به LF نرمال کن (مثل آنچه Git روی GitHub ذخیره می‌کند)
    if (/\.(html?|js|json|css|txt|md|svg)$/i.test(f)) {
        let s = buf.toString('utf8');
        s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        buf = Buffer.from(s, 'utf8');
    }
    sha[f] = c.createHash('sha256').update(buf).digest('hex');
});

fs.writeFileSync('version.json', JSON.stringify({
    app: "cmc-class-manager",
    version: v,
    notes: notes,
    files: files,
    sha256: sha
}, null, 2));

console.log('version.json ساخته شد', v);