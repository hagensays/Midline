const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const { TextDecoder } = require("util");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 5173);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SOURCES_DIR = path.join(ROOT_DIR, ".txt sources");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function getSafeSourceName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    return null;
  }
  const clean = path.basename(name);
  if (clean !== name) {
    return null;
  }
  if (path.extname(clean).toLowerCase() !== ".txt") {
    return null;
  }
  return clean;
}

function decodeTextBuffer(buffer) {
  const decoders = [
    new TextDecoder("utf-8", { fatal: true }),
    new TextDecoder("utf-16le", { fatal: true }),
    new TextDecoder("latin1", { fatal: false }),
  ];
  for (const decoder of decoders) {
    try {
      return decoder.decode(buffer);
    } catch (error) {
      continue;
    }
  }
  return buffer.toString("utf8");
}

function sanitizeText(rawText) {
  return rawText.replace(/\s+/g, " ").trim();
}

async function handleApi(req, res, pathname, searchParams) {
  if (pathname === "/api/health") {
    sendJson(res, 200, { ok: true, app: "Midline" });
    return;
  }

  if (pathname === "/api/sources") {
    try {
      await fs.mkdir(SOURCES_DIR, { recursive: true });
      const dirEntries = await fs.readdir(SOURCES_DIR, { withFileTypes: true });
      const files = dirEntries
        .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".txt")
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
      sendJson(res, 200, { files, folder: ".txt sources" });
    } catch (error) {
      sendJson(res, 500, { error: "Failed to list sources." });
    }
    return;
  }

  if (pathname === "/api/source") {
    const name = getSafeSourceName(searchParams.get("name"));
    if (!name) {
      sendJson(res, 400, { error: "Invalid source name." });
      return;
    }

    try {
      const filePath = path.join(SOURCES_DIR, name);
      const fileBuffer = await fs.readFile(filePath);
      const text = sanitizeText(decodeTextBuffer(fileBuffer));
      sendJson(res, 200, { name, text });
    } catch (error) {
      if (error && error.code === "ENOENT") {
        sendJson(res, 404, { error: "Source file not found." });
        return;
      }
      sendJson(res, 500, { error: "Failed to load source file." });
    }
    return;
  }

  sendJson(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res, pathname) {
  const relPath = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(relPath);
  const normalized = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname, requestUrl.searchParams);
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
});

server.listen(PORT, HOST, async () => {
  await fs.mkdir(SOURCES_DIR, { recursive: true });
  console.log(`Midline running at http://${HOST}:${PORT}`);
  console.log(`Text sources folder: ${SOURCES_DIR}`);
});
