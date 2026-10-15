import { setTimeout as delay } from "node:timers/promises";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  let input;
  try {
    input = JSON.parse(url.searchParams.get("datastar") || "{}");
  } catch {
    res.statusCode = 400;
    return res.end("Invalid signals");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    res.statusCode = 400;
    return res.end("Invalid signals");
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });
  let closed = false;
  res.on("close", () => {
    closed = true;
  });
  const started = Date.now();
  for (let frame = 0; frame < 64; frame++) {
    if (closed) break;
    res.write(
      `event: datastar-patch-signals\ndata: signals ${JSON.stringify({ growth: (frame + 1) / 64, frame: frame + 1, elapsed: Date.now() - started, status: frame < 63 ? "Growing" : "Complete" })}\n\n`,
    );
    if (frame < 63) await delay(80);
  }
  res.end();
}
