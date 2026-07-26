// ===== Service Worker =====
const CACHE_NAME = 'birthday-copy-v1';
const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './static/style.css',
  './static/app.js',
  './data/copywriting.json',
  './static/icons/icon-192.png',
  './static/icons/icon-512.png'
];

// 安装：缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_URLS).catch(err => console.log('部分资源缓存失败:', err)))
      .then(() => self.skipWaiting())
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  // API 请求不缓存
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 静态资源：缓存优先，失败回退网络
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 缓存新资源
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // 离线回退
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
