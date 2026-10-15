#!/usr/bin/env node
/*
  مدیریت مجوزها — یک دستور برای همه‌چیز
  ------------------------------------------------------------
  خروجی اصلی: ../licenses.json  (فقط هش؛ هرگز کد ملی خام)
  برنامه این فایل را هنگام «ایجاد حساب» از اینترنت می‌خواند،
  پس برای افزودن/حذف خریدار فقط همین یک فایل آپلود می‌شود و نسخهٔ برنامه عوض نمی‌شود.

  دستورها:
    node license-tools/make-hashes.js add 0499370899 "نام خریدار"   افزودن + ساخت licenses.json
    node license-tools/make-hashes.js add                            افزودن همهٔ خطوط تازهٔ buyers.txt (فقط ساخت)
    node license-tools/make-hashes.js remove 0499370899              حذف + ساخت
    node license-tools/make-hashes.js list                           فهرست خریداران
    node license-tools/make-hashes.js check 0499370899               آیا مجاز است؟
    node license-tools/make-hashes.js                                فقط ساخت licenses.json از buyers.txt
  گزینه‌ها:
    --push    بعد از ساخت: git add + commit + push (اگر پوشه یک مخزن git باشد)
    --salt X  نمک دستی (پیش‌فرض: از index.html خوانده می‌شود)
*/
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');

const ITER = 200000, KEYLEN = 32, DIGEST = 'sha256';
const DEFAULT_SALT = '749b359467ca42abb74c16d4f9d7e553c0cd96ae316340cca2f84d6feac9dd39';
const root = path.join(__dirname, '..');
const BUYERS = path.join(__dirname, 'buyers.txt');
const OUT = path.join(root, 'licenses.json');
const HTML = path.join(root, 'index.html');
const CACHE = path.join(__dirname, '.hash-cache.json');

const argv = process.argv.slice(2);
const push = argv.includes('--push');
const si = argv.indexOf('--salt');
const saltArg = si >= 0 ? argv[si + 1] : null;
const pos = argv.filter((a, i) => !a.startsWith('--') && !(si >= 0 && i === si + 1));
const cmd = ['add', 'remove', 'list', 'check'].includes(pos[0]) ? pos.shift() : 'build';

const toEn = s => String(s || '').replace(/[۰-۹]/g, c => c.charCodeAt(0) - 0x06F0).replace(/[٠-٩]/g, c => c.charCodeAt(0) - 0x0660);
const norm = s => toEn(s).replace(/\s+/g, '');
function validCode(c) {
  if (!/^\d{10}$/.test(c) || /^(\d)\1{9}$/.test(c)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += (+c[i]) * (10 - i);
  const r = s % 11, k = +c[9]; return r < 2 ? k === r : k === 11 - r;
}
function saltFromHtml() {
  try { const m = fs.readFileSync(HTML, 'utf8').match(/var SALT\s*=\s*'([^']*)'/); return m ? m[1] : null; } catch (e) { return null; }
}
const SALT = saltArg || saltFromHtml() || DEFAULT_SALT;
const saltId = crypto.createHash('sha256').update(SALT + ITER).digest('hex').slice(0, 16);

let cache = {};
try { const c = JSON.parse(fs.readFileSync(CACHE, 'utf8')); if (c.saltId === saltId) cache = c.map || {}; } catch (e) {}
function hashCode(code) {
  if (!cache[code]) cache[code] = crypto.pbkdf2Sync(code, SALT, ITER, KEYLEN, DIGEST).toString('hex');
  return cache[code];
}
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify({ saltId, map: cache }));

function readBuyers() {           // [{code, line}] ؛ خطوط توضیحی/خالی با code=null
  if (!fs.existsSync(BUYERS)) fs.writeFileSync(BUYERS, '# هر خط یک کد ملی؛ بعد از # توضیح\n');
  return fs.readFileSync(BUYERS, 'utf8').split(/\r?\n/).map(line => {
    const raw = line.split('#')[0].trim();
    return { line, code: raw ? norm(raw) : null };
  });
}
const writeBuyers = rows => fs.writeFileSync(BUYERS, rows.map(r => r.line).join('\n').replace(/\n*$/, '\n'));

function build() {
  const rows = readBuyers(), seen = new Set(); let bad = 0, dup = 0;
  rows.forEach((r, i) => {
    if (!r.code) return;
    if (!validCode(r.code)) { console.warn(`⚠️  خط ${i + 1}: کد ملی نامعتبر، نادیده گرفته شد (${r.code})`); bad++; return; }
    if (seen.has(r.code)) { dup++; return; }
    seen.add(r.code);
  });
  const hashes = [...seen].map(hashCode).sort();      // مرتب‌سازی: ترتیب، افراد را لو نمی‌دهد
  saveCache();
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const json = JSON.stringify({ v: 1, alg: 'PBKDF2-SHA256', iterations: ITER, count: hashes.length, hashes }, null, 2) + '\n';
  fs.writeFileSync(OUT, json);
  console.log(`✅ licenses.json ساخته شد: ${hashes.length} مجوز` + (bad || dup ? `  (نامعتبر: ${bad}، تکراری: ${dup})` : '') + (prev === json ? '  — بدون تغییر نسبت به قبل' : ''));
  if (SALT === DEFAULT_SALT) console.warn('⚠️  هنوز نمک پیش‌فرض (CHANGE_ME) است؛ قبل از فروش واقعی عوضش کنید (راهنما: README).');
  return prev !== json;
}

function gitPush(changed) {
  if (!changed) { console.log('ℹ️  تغییری نبود؛ چیزی ارسال نشد.'); return; }
  const run = (...a) => cp.spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  if (run('rev-parse', '--is-inside-work-tree').status !== 0) { console.log('ℹ️  این پوشه مخزن git نیست؛ فایل licenses.json را دستی آپلود کنید.'); return; }
  run('add', 'licenses.json');
  const c = run('commit', '-m', 'update licenses');
  if (c.status !== 0 && !/nothing to commit/.test(c.stdout + c.stderr)) { console.error(c.stderr || c.stdout); process.exit(1); }
  const p = run('push');
  if (p.status !== 0) { console.error('❌ push ناموفق:\n' + p.stderr); process.exit(1); }
  console.log('🚀 به GitHub ارسال شد. حداکثر ~۱۰ دقیقه تا اعمال در GitHub Pages.');
}
function done(changed) {
  if (push) gitPush(changed);
  else if (changed) console.log('📤 حالا فقط فایل  licenses.json  را در ریشهٔ مخزن GitHub آپلود (جایگزین) کنید. نسخهٔ برنامه عوض نمی‌شود.');
}

if (cmd === 'add') {
  if (pos[0]) {
    const code = norm(pos[0]);
    if (!validCode(code)) { console.error('❌ کد ملی نامعتبر است (۱۰ رقم با رقم کنترل درست).'); process.exit(1); }
    const rows = readBuyers();
    if (rows.some(r => r.code === code)) console.log('ℹ️  این کد قبلاً در buyers.txt بود.');
    else {
      const note = pos.slice(1).join(' ').trim(), d = new Date().toISOString().slice(0, 10);
      rows.push({ code, line: `${code}   # ${note ? note + ' - ' : ''}${d}` });
      writeBuyers(rows); console.log('➕ به buyers.txt اضافه شد.');
    }
  }
  done(build());
} else if (cmd === 'remove') {
  const code = norm(pos[0] || '');
  const rows = readBuyers(), left = rows.filter(r => r.code !== code);
  if (left.length === rows.length) { console.error('❌ این کد در buyers.txt نیست.'); process.exit(1); }
  writeBuyers(left); console.log('➖ از buyers.txt حذف شد. (حساب‌های ساخته‌شده قبلی روی دستگاه‌ها می‌مانند؛ فقط ساخت حساب جدید بسته می‌شود.)');
  done(build());
} else if (cmd === 'list') {
  const rows = readBuyers().filter(r => r.code);
  rows.forEach(r => console.log(r.line)); console.log(`\nمجموع: ${rows.length}`);
} else if (cmd === 'check') {
  const code = norm(pos[0] || '');
  let list = []; try { list = JSON.parse(fs.readFileSync(OUT, 'utf8')).hashes; } catch (e) {}
  console.log(list.includes(hashCode(code)) ? '✅ در licenses.json هست' : '❌ در licenses.json نیست'); saveCache();
} else {
  done(build());
}
