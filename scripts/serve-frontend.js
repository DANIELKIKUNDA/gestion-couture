import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(normalize(join(__dirname, "..")), "frontend", "dist");
const port = Number(process.env.FRONTEND_PORT || 5173);
const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:3000";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function sendNotFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Ressource introuvable");
}

async function proxyApi(req, res) {
  const targetUrl = `${apiBase}${req.url}`;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : req;
  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      host: undefined
    },
    body,
    duplex: body ? "half" : undefined
  });

  const headers = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  if (!response.body) {
    res.end();
    return;
  }
  for await (const chunk of response.body) {
    res.write(chunk);
  }
  res.end();
}

async function serveFile(req, res) {
  const rawPath = String(req.url || "/").split("?")[0];
  const relativePath = rawPath === "/" ? "/index.html" : rawPath;
  const filePath = normalize(join(rootDir, relativePath));

  if (!filePath.startsWith(rootDir)) {
    sendNotFound(res);
    return;
  }

  const fallbackIndex = join(rootDir, "index.html");
  const target = existsSync(filePath) ? filePath : fallbackIndex;
  if (!existsSync(target)) {
    sendNotFound(res);
    return;
  }

  const ext = extname(target).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(target).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendNotFound(res);
      return;
    }

    if (req.url.startsWith("/api")) {
      await proxyApi(req, res);
      return;
    }

    if (req.url === "/health") {
      const payload = JSON.stringify({ ok: true, service: "atelier-frontend-launcher" });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(payload);
      return;
    }

    await serveFile(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err || "Erreur serveur");
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(message);
  }
});

server.listen(port, "127.0.0.1", async () => {
  const indexPath = join(rootDir, "index.html");
  if (!existsSync(indexPath)) {
    console.warn("Frontend dist introuvable. Lance `npm.cmd run build` dans frontend si necessaire.");
  }
  console.log(`Frontend launcher listening on http://127.0.0.1:${port}`);
});
