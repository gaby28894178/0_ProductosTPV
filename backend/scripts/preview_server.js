const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'tmp');
const port = process.env.PREVIEW_PORT ? Number(process.env.PREVIEW_PORT) : 5500;

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(root, urlPath.replace(/^\/+/, ''));
  let target = filePath;
  try {
    const st = fs.statSync(target);
    if (st.isDirectory()) target = path.join(target, 'index.html');
  } catch {}
  fs.readFile(target, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not Found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const types = { '.pdf': 'application/pdf', '.html': 'text/html', '.txt': 'text/plain' };
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Preview server running at http://localhost:${port}/`);
});