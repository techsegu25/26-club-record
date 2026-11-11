// 로컬 테스트용 서버: DATABASE_URL=postgres://... node dev-server.js
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const routes = { "/api/entries": "./api/entries.js", "/api/admin": "./api/admin.js" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (routes[url.pathname]) {
    let body = "";
    for await (const c of req) body += c;
    req.query = Object.fromEntries(url.searchParams);
    req.body = body ? JSON.parse(body) : {};
    res.status = (c) => { res.statusCode = c; return res; };
    const { default: handler } = await import(routes[url.pathname]);
    return handler(req, res);
  }
  let p = url.pathname === "/" ? "/index.html" : url.pathname === "/admin" ? "/admin.html" : url.pathname;
  try {
    const file = await readFile(join(root, normalize(p)));
    res.writeHead(200, { "Content-Type": types[extname(p)] || "application/octet-stream" });
    res.end(file);
  } catch { res.writeHead(404); res.end("not found"); }
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
