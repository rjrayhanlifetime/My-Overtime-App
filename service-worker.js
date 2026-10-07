const CACHE_PREFIX='my-overtime-app-';
const RUNTIME_CACHE=CACHE_PREFIX+'runtime';
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='MY_OVERTIME_ACTIVATE_CACHE')
    e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET') return;
  e.respondWith((async()=>{
    try{
      const fresh=await fetch(r,{cache:'no-store'});
      if(fresh&&fresh.ok){
        const c=await caches.open(RUNTIME_CACHE);
        c.put(r,fresh.clone()).catch(()=>{});
      }
      return fresh;
    }catch(err){
      const c=await caches.open(RUNTIME_CACHE);
      const hit=await c.match(r);
      if(hit)return hit;
      if(r.mode==='navigate'){
        const fallback=await c.match(new URL('./index.html',self.registration.scope).href);
        if(fallback)return fallback;
      }
      throw err;
    }
  })());
});
