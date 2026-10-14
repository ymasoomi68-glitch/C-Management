// استفاده: node make-version.js 4.3.0 "یادداشت۱" "یادداشت۲"
// هش SHA-256 فایل‌های انتشار را حساب و version.json را می‌سازد.
const fs=require('fs'),c=require('crypto');
const files=["index.html","sw.js","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png","apple-touch-icon.png","favicon.png"];
const [v,...notes]=process.argv.slice(2);
if(!v){console.error('نسخه را بدهید');process.exit(1)}
const sha={};files.forEach(f=>sha[f]=c.createHash('sha256').update(fs.readFileSync(f)).digest('hex'));
fs.writeFileSync('version.json',JSON.stringify({app:"class-manager",version:v,notes,files,sha256:sha},null,2));
console.log('version.json ساخته شد',v);
