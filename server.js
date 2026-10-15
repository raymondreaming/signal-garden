import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import handler from "./api/grow.js";
const files = {
  "/": "index.html",
  "/style.css": "style.css",
  "/vendor/datastar.js": "vendor/datastar.js",
};
createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/api/grow") return handler(req, res);
  if (!files[path]) {
    res.writeHead(404);
    return res.end("Not found");
  }
  try {
    const content = await readFile(
      new URL(`./public/${files[path]}`, import.meta.url),
    );
    res.setHeader(
      "Content-Type",
      path.endsWith(".css")
        ? "text/css"
        : path.endsWith(".js")
          ? "text/javascript"
          : "text/html",
    );
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end("Unable to load page");
  }
}).listen(4317, "127.0.0.1", () =>
  console.log("Signal Garden → http://localhost:4317"),
);
