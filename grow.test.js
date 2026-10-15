import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import handler from "./api/grow.js";
import { defaults, normalize } from "./public/field.js";
const server = createServer(handler);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test("shared and saved recipes accept only bounded, known configuration", () => {
  const config = normalize({
    system: "vortex",
    palette: "<script>",
    count: 999999,
    spread: -100,
    seed: NaN,
    playing: false,
    lines: "yes",
    zoom: Infinity,
    extra: "ignored",
  });
  assert.equal(config.system, "vortex");
  assert.equal(config.palette, "iris");
  assert.equal(config.count, 4000);
  assert.equal(config.spread, 20);
  assert.equal(config.seed, 42);
  assert.equal(config.playing, false);
  assert.equal(config.lines, false);
  assert.equal(config.zoom, 100);
  assert.equal("extra" in config, false);
  for (const invalid of [null, [], 1, "x"])
    assert.deepEqual(normalize(invalid), defaults);
});
test("recipe URL serialization preserves all accepted settings", () => {
  const recipe = normalize({
    ...defaults,
    system: "ribbons",
    palette: "tide",
    playing: false,
    count: 3200,
    seed: 9899,
  });
  const url = new URL("https://example.com");
  url.hash = new URLSearchParams({ recipe: JSON.stringify(recipe) });
  assert.deepEqual(
    normalize(JSON.parse(new URLSearchParams(url.hash.slice(1)).get("recipe"))),
    recipe,
  );
});
test("malformed input returns 400 without starting a stream", async () => {
  for (const input of ["{", "null", "[]"]) {
    const response = await fetch(
      `${base}/api/grow?datastar=${encodeURIComponent(input)}`,
    );
    assert.equal(response.status, 400);
    await response.text();
  }
});
test("evolution progressively delivers 96 bounded signals, stage notes, and completion", async () => {
  const response = await fetch(
    `${base}/api/grow?datastar=${encodeURIComponent('{"seed":"<script>alert(1)</script>"}')}`,
  );
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  const first = await reader.read();
  let text = decoder.decode(first.value);
  assert.match(text, /Germination/);
  assert.doesNotMatch(text, /Complete/);
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    text += decoder.decode(chunk.value);
  }
  const events = text.split("\n\n").filter(Boolean);
  const signals = events
    .filter((event) => event.startsWith("event: datastar-patch-signals"))
    .map((event) => JSON.parse(event.split("data: signals ")[1]));
  assert.equal(signals.length, 96);
  assert.equal(events.length, 100);
  assert.equal(signals.at(-1).status, "Complete");
  assert.equal(signals.at(-1).growth, 1);
  assert.ok(Math.abs(signals.at(-1).drift) < 0.00001);
  assert.deepEqual(
    [...new Set(signals.map((item) => item.status))],
    ["Germinating", "Unfolding", "Settling", "Complete"],
  );
  for (const [i, event] of signals.entries()) {
    assert.equal(event.frame, i + 1);
    assert.ok(event.growth >= 0.12 && event.growth <= 1);
    assert.ok(event.drift >= 0 && event.drift <= 0.8);
    assert.deepEqual(Object.keys(event), [
      "growth",
      "frame",
      "elapsed",
      "drift",
      "status",
    ]);
  }
  assert.doesNotMatch(text, /<script>|<canvas|<svg/);
  assert.ok(Buffer.byteLength(text) < 20000, "stream stays under 20 KB");
});
test("clients can cancel an active evolution", async () => {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/grow`, {
    signal: controller.signal,
  });
  const reader = response.body.getReader();
  await reader.read();
  controller.abort();
  await assert.rejects(reader.read(), { name: "AbortError" });
});
