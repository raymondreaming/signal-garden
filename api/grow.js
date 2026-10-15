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
  for (let frame = 0; frame < 96; frame++) {
    if (closed) break;
    if (frame % 32 === 0 || frame === 95) {
      const notes =
        frame === 0
          ? "01 / Germination — introducing the first particles."
          : frame === 32
            ? "02 / Emergence — a temporary wave reshapes the field."
            : frame === 64
              ? "03 / Equilibrium — the field settles back into your recipe."
              : "Complete — 96 signal updates delivered. Your local settings are unchanged.";
      res.write(
        `event: datastar-patch-elements\ndata: elements <p id="stream-note" class="stream-note">${notes}</p>\n\n`,
      );
    }
    res.write(
      `event: datastar-patch-signals\ndata: signals ${JSON.stringify({ growth: Math.min(1, 0.12 + (frame + 1) / 40), frame: frame + 1, elapsed: Date.now() - started, drift: Math.sin(((frame + 1) / 96) * Math.PI) * 0.8, status: frame < 32 ? "Germinating" : frame < 64 ? "Unfolding" : frame < 95 ? "Settling" : "Complete" })}\n\n`,
    );
    if (frame < 95) await delay(80);
  }
  res.end();
}
