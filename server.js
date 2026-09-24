// Ifile server: serves ifile.html and relays messages between one Sender and one Receiver.
const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
// Serves ifile.html plus the PWA files (manifest, service worker, icons) and optional local copies of the QR libraries.
const STATIC={'/jsQR.min.js':'application/javascript','/qrcode.min.js':'application/javascript','/sw.js':'application/javascript','/manifest.json':'application/manifest+json',
  '/icons/icon-192.png':'image/png','/icons/icon-512.png':'image/png','/icons/icon-maskable-512.png':'image/png','/icons/apple-touch-icon.png':'image/png'};
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0],ct=STATIC[u];
  fs.readFile(path.join(__dirname,ct?u.slice(1):'ifile.html'),(e,d)=>{
    if(e){r.writeHead(ct?404:500);return r.end(ct?'not found':'ifile.html not found')}
    r.writeHead(200,{'Content-Type':ct||'text/html; charset=utf-8','Cache-Control':(ct&&ct!=='image/png')||!ct?'no-cache':'public, max-age=86400'});r.end(d)})});
const wss=new WebSocketServer({server:srv,maxPayload:1024*1024});
const rooms={};
const peerOf=ws=>{const r=rooms[ws.room];return r&&(ws.role==='host'?r.guest:r.host)};
wss.on('connection',ws=>{
  ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
  ws.on('message',(d,bin)=>{
    if(!bin){let m;try{m=JSON.parse(d)}catch(e){return}
      if(m.t==='host'){const o=rooms[m.code];if(o&&o.host!==ws&&o.host.readyState===1)return ws.send(JSON.stringify({t:'busy'}));rooms[m.code]={host:ws,guest:null};ws.room=m.code;ws.role='host';return}
      if(m.t==='join'){const r=rooms[m.code];
        if(!r||r.guest){ws.bad=(ws.bad||0)+1;if(ws.bad>5)return ws.terminate();return ws.send(JSON.stringify({t:'err'}))}
        r.guest=ws;ws.room=m.code;ws.role='guest';
        ws.send(JSON.stringify({t:'ok'}));r.host.send(JSON.stringify({t:'joined'}));return}}
    const p=peerOf(ws);if(p&&p.readyState===1)p.send(d,{binary:bin});
  });
  ws.on('close',()=>{const r=rooms[ws.room];if(!r)return;const p=peerOf(ws);
    if(p&&p.readyState===1)p.send(JSON.stringify({t:'left'}));
    if(ws.role==='host')delete rooms[ws.room];else r.guest=null});
});
setInterval(()=>wss.clients.forEach(w=>{if(!w.isAlive)return w.terminate();w.isAlive=false;w.ping()}),25000);
srv.listen(process.env.PORT||3000,()=>console.log('Ifile running on port '+(process.env.PORT||3000)));
