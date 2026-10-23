/* ═══════════════════════════════════════════════════
   📱 Service Worker - کلاس‌یار
   ═══════════════════════════════════════════════════ */

var CACHE_NAME = 'cmc-app-v17';
var CACHE_PREFIX = 'cmc-app-'; // فقط کش‌های همین برنامه؛ به کش برنامه‌های دیگرِ همین دامنه دست نمی‌زنیم
var CACHE_FILES = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-512.png',
    './apple-touch-icon.png',
    './favicon.png'
];

// ===== نصب =====
// نسخهٔ جدید برنامه بدون اطلاع کاربر جایگزین نمی‌شود: صفحهٔ اصلی (index.html) از کشِ نسخهٔ قبلی منتقل می‌شود
// و فقط وقتی کاربر در پنجرهٔ «نسخهٔ جدید» روی «بروزرسانی» بزند عوض می‌شود (نصب در خود برنامه انجام می‌شود).
var PAGE_FILES = ['./', './index.html'];
self.addEventListener('install', function(event) {
    console.log('✅ Service Worker نصب شد');
    event.waitUntil((async function() {
        var cache = await caches.open(CACHE_NAME);
        var rest = CACHE_FILES.filter(function(f) { return PAGE_FILES.indexOf(f) < 0; });
        await cache.addAll(rest);
        var names = await caches.keys();
        var prev = names.filter(function(n) { return n.indexOf(CACHE_PREFIX) === 0 && n !== CACHE_NAME; })
            .sort(function(a, b) { return (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0); }).pop();
        var copied = 0;
        if (prev) {
            var pc = await caches.open(prev);
            for (var i = 0; i < PAGE_FILES.length; i++) {
                var r = await pc.match(PAGE_FILES[i]);
                if (r) { await cache.put(PAGE_FILES[i], r); copied++; }
            }
        }
        if (copied < PAGE_FILES.length) await cache.addAll(PAGE_FILES);   // نصب اول (یا نبودن نسخهٔ قبلی)
    })().catch(function(err) {
        console.log('خطا در کش کردن:', err);
    }));
    self.skipWaiting();
});

// ===== فعال‌سازی =====
self.addEventListener('activate', function(event) {
    console.log('✅ Service Worker فعال شد');
    event.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(name) {
                    return name.indexOf(CACHE_PREFIX) === 0 && name !== CACHE_NAME;
                }).map(function(name) {
                    return caches.delete(name);
                })
            );
        })
    );
    self.clients.claim();
});

// ===== دریافت =====
self.addEventListener('fetch', function(event) {
    // فقط درخواست‌های GET رو کش کن
    if (event.request.method !== 'GET') return;

    // درخواست‌های API سیدا رو کش نکن
    if (event.request.url.indexOf('/api/') !== -1) return;

    var reqUrl = new URL(event.request.url);
    // درخواست‌های خارج از این سایت (مثل GitHub) را دست نزن
    if (reqUrl.origin !== self.location.origin) return;
    // فایل نسخه همیشه از شبکه خوانده شود
    if (/\/(version|licenses)\.json$/.test(reqUrl.pathname)) return;

    // صفحهٔ اصلی: از کش (نسخهٔ نصب‌شده)؛ نسخهٔ جدید فقط با تأیید کاربر در خود برنامه نصب می‌شود.
    // اگر هنوز در کش نبود، از شبکه می‌آید و ذخیره می‌شود.
    if (event.request.mode === 'navigate' || /\/(index\.html)?$/.test(reqUrl.pathname)) {
        event.respondWith(
            caches.match(event.request, { ignoreSearch: true }).then(function(c) {
                if (c) return c;
                return fetch(event.request).then(function(response) {
                    if (response && response.status === 200 && response.type !== 'opaque') {
                        var rc = response.clone();
                        caches.open(CACHE_NAME).then(function(cache) { cache.put('./index.html', rc); });
                    }
                    return response;
                }).catch(function() { return caches.match('./index.html'); });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function(cached) {
            // اگه توی کش هست، برگردون (Cache First)
            if (cached) return cached;

            // وگرنه از شبکه بگیر
            return fetch(event.request).then(function(response) {
                // فقط پاسخ‌های موفق رو کش کن
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }

                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(function() {
                // اگه شبکه نبود، صفحهٔ اصلی رو برگردون
                return caches.match('./index.html');
            });
        })
    );
});
