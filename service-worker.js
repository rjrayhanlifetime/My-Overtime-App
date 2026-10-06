const CACHE_PREFIX='my-overtime-app-';
const SHELL='/My-Overtime-App/';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='MY_OVERTIME_ACTIVATE_CACHE'){
    e.waitUntil((async()=>{
      const keep=e.data.cacheName, keys=await caches.keys();
      await Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==keep).map(k=>caches.delete(k)));
      await self.clients.claim();
    })());
  }
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const isNavigation=req.mode==='navigate' || (req.headers.get('accept')||'').includes('text/html');
  if(isNavigation){
    e.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        if(fresh.ok){
          const cache=await caches.open(CACHE_PREFIX+'runtime');
          cache.put(req,fresh.clone()).catch(()=>{});
        }
        return fresh;
      }catch(err){
        const keys=await caches.keys();
        for(const k of keys.filter(x=>x.startsWith(CACHE_PREFIX))){
          const c=await caches.open(k), hit=await c.match(req) || await c.match(new URL('index.html',self.location.origin).pathname);
          if(hit)return hit;
        }
        throw err;
      }
    })());
    return;
  }
  e.respondWith((async()=>{
    const keys=await caches.keys();
    for(const k of keys.filter(x=>x.startsWith(CACHE_PREFIX))){
      const c=await caches.open(k), hit=await c.match(req);
      if(hit)return hit;
    }
    try{
      const fresh=await fetch(req);
      if(fresh.ok){
        const c=await caches.open(CACHE_PREFIX+'runtime');
        c.put(req,fresh.clone()).catch(()=>{});
      }
      return fresh;
    }catch(err){ throw err; }
  })());
});
