/* ═══════════════════════════════════════════════════
   📱 Service Worker - کلاس‌یار
   ═══════════════════════════════════════════════════ */

var CACHE_NAME = 'cmc-app-v21';
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
// [update-confirm] نسخهٔ جدید skipWaiting نمی‌کند: در حالت «waiting» می‌ماند تا کاربر در برنامه «تأیید» بزند
// (برنامه پیام SKIP_WAITING می‌فرستد). صفحهٔ اصلی تا آن زمان از کشِ نسخهٔ فعلی خوانده می‌شود.
self.addEventListener('install', function(event) {
    console.log('🔄 Service Worker در حال نصب...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            // cache:'reload' → فایل‌ها حتماً از شبکه (نه از کش HTTP مرورگر) گرفته شوند تا نسخهٔ کهنه ذخیره نشود
            return cache.addAll(CACHE_FILES.map(function(u) { return new Request(u, { cache: 'reload' }); }));
        }).catch(function(err) {
            console.log('خطا در کش کردن:', err);
        })
    );
    // [update-confirm] self.skipWaiting() عمداً حذف شده است
});

// ===== فعال‌سازی =====
self.addEventListener('activate', function(event) {
    console.log('✅ Service Worker فعال شد');
    event.waitUntil((async function() {
        var names = await caches.keys();
        await Promise.all(
            names.filter(function(name) {
                return name.indexOf(CACHE_PREFIX) === 0 && name !== CACHE_NAME;
            }).map(function(name) {
                return caches.delete(name);
            })
        );
        await self.clients.claim();
    })());
});

// [update-confirm] فعال‌سازی نسخهٔ جدید فقط با تأیید کاربر
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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
