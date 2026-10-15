#!/usr/bin/env node
/*
  ابزار تولید هش مجوز (CMLicense)
  ------------------------------------------------------------
  PBKDF2-HMAC-SHA256 | 200,000 تکرار | خروجی ۳۲ بایت (۶۴ کاراکتر hex)
  ورودی  : license-tools/buyers.txt  (هر خط یک کد ملی؛ # = توضیح)
  خروجی : چاپ در ترمینال + license-tools/hashes.txt

  استفاده:
    node license-tools/make-hashes.js                 # فقط تولید هش
    node license-tools/make-hashes.js --inject        # تولید + جایگذاری در ../index.html
    node license-tools/make-hashes.js --check 0499370899   # آیا این کد در لیست هست؟
    گزینه‌ها: --in فایل  --out فایل  --html مسیر/index.html  --salt متن

  نمک به‌طور پیش‌فرض از خود index.html خوانده می‌شود تا هیچ‌وقت با برنامه ناهمخوان نشود.
*/
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const ITER = 200000, KEYLEN = 32, DIGEST = 'sha256';
const DEFAULT_SALT = 'YOUR_SUPER_SECRET_SALT_CHANGE_ME_2026_class_manager';
const START = '/*LICENSE-HASHES-START*/', END = '/*LICENSE-HASHES-END*/';

const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };

const root = path.join(__dirname, '..');
const inFile = opt('in', path.join(__dirname, 'buyers.txt'));
const outFile = opt('out', path.join(__dirname, 'hashes.txt'));
const htmlFile = opt('html', path.join(root, 'index.html'));

function toEn(s) {
  return String(s || '').replace(/[۰-۹]/g, c => c.charCodeAt(0) - 0x06F0).replace(/[٠-٩]/g, c => c.charCodeAt(0) - 0x0660);
}
function validCode(c) {            // همان الگوریتم CMAuth.validCode
  if (!/^\d{10}$/.test(c) || /^(\d)\1{9}$/.test(c)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += (+c[i]) * (10 - i);
  const r = s % 11, k = +c[9];
  return r < 2 ? k === r : k === 11 - r;
}
function readSaltFromHtml() {
  try {
    const m = fs.readFileSync(htmlFile, 'utf8').match(/var SALT\s*=\s*'([^']*)'/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}
const SALT = opt('salt', readSaltFromHtml() || DEFAULT_SALT);
const hashCode = code => crypto.pbkdf2Sync(code, SALT, ITER, KEYLEN, DIGEST).toString('hex');

if (SALT === DEFAULT_SALT) console.warn('⚠️  هشدار: هنوز نمک پیش‌فرض (CHANGE_ME) استفاده می‌شود. قبل از فروش واقعی آن را عوض کنید (هم در index.html هم همین‌جا خودکار خوانده می‌شود).\n');

// حالت بررسی یک کد
if (flag('check')) {
  const c = toEn(opt('check', '')).trim();
  const h = hashCode(c);
  const list = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').split(/\s+/) : [];
  console.log(h); console.log(list.includes(h) ? '✅ در hashes.txt هست' : '❌ در hashes.txt نیست');
  process.exit(0);
}

if (!fs.existsSync(inFile)) { console.error('فایل ورودی پیدا نشد: ' + inFile); process.exit(1); }
const seen = new Set(), rows = [];
let bad = 0, dup = 0;
fs.readFileSync(inFile, 'utf8').split(/\r?\n/).forEach((line, i) => {
  const raw = line.split('#')[0].trim();
  if (!raw) return;
  const code = toEn(raw).replace(/\s+/g, '');
  if (!validCode(code)) { console.warn(`⚠️  خط ${i + 1}: کد ملی نامعتبر، نادیده گرفته شد (${raw})`); bad++; return; }
  if (seen.has(code)) { console.warn(`ℹ️  خط ${i + 1}: تکراری، نادیده گرفته شد`); dup++; return; }
  seen.add(code); rows.push(code);
});

console.log(`در حال هش کردن ${rows.length} کد ملی (هر کدام ~0.1 ثانیه)...`);
const hashes = rows.map(hashCode).sort();           // مرتب‌سازی: ترتیب فایل، افراد را لو نمی‌دهد
fs.writeFileSync(outFile, hashes.join('\n') + '\n');
console.log(`✅ ${hashes.length} هش نوشته شد → ${outFile}   (نامعتبر: ${bad}، تکراری: ${dup})`);

const block = hashes.map(h => `        '${h}'`).join(',\n');
if (flag('inject')) {
  let html = fs.readFileSync(htmlFile, 'utf8');
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < 0 || b < a) { console.error('نشانگرهای LICENSE-HASHES در index.html پیدا نشد.'); process.exit(1); }
  html = html.slice(0, a + START.length) + '\n' + block + '\n        ' + html.slice(b);
  fs.writeFileSync(htmlFile, html);
  console.log('✅ لیست در index.html جایگذاری شد. حالا: node make-version.js <نسخه> "یادداشت"');
} else {
  console.log('\n--- این بلوک را بین نشانگرهای LICENSE-HASHES در index.html بگذارید (یا با --inject خودکار) ---\n' + block);
}
