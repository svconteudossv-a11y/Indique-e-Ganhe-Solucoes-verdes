'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const convertMov = require('./mov-converter').createMovHandler();
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/config.js': ['config.js', 'text/javascript; charset=utf-8']
};
const server = http.createServer((req, res) => {
  if(req.url.split('?')[0]==='/api/convert-mov' && req.method==='POST'){void convertMov(req,res);return;}
  const file = files[req.url.split('?')[0]];
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, {Allow: 'GET, HEAD'}); res.end(); return;
  }
  if (!file) {res.writeHead(404); res.end('Not found'); return;}
  fs.readFile(path.join(__dirname, 'public', file[0]), (err, data) => {
    if (err) {res.writeHead(500); res.end('Unable to load page'); return;}
    res.writeHead(200, {'Content-Type':file[1], 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Portal ready'));
