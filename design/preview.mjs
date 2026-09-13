// Converts the .dc.html artboards into plain HTML pages under preview/ and serves them for a local look.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
const dir = new URL('./', import.meta.url);
for (const f of readdirSync(dir).filter((f) => f.endsWith('.dc.html'))) {
  const src = readFileSync(new URL(f, dir), 'utf8')
    .replace('<script src="./support.js"></script>', '')
    .replace(/<\/?x-dc>/g, '').replace(/<\/?helmet>/g, '');
  writeFileSync(new URL('preview/' + f.replace('.dc.html', '.html'), dir), src);
}
const port = Number(process.env.PORT || 4321);
createServer((req, res) => {
  try {
    const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'Main.html';
    const body = readFileSync(new URL('preview/' + name.replace(/[^\w.-]/g, ''), dir));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(port, () => console.log('preview on http://localhost:' + port));
