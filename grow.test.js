import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import handler from "./api/grow.js";

const server = createServer(handler);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test("server streams only compact growth signals", async () => {
  const response = await fetch(
    `${base}/api/grow?datastar=${encodeURIComponent(JSON.stringify({ density: 120, palette: "tide", seed: 19, spread: 50 }))}`,
  );
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  const text = await response.text();
  assert.doesNotMatch(text, /datastar-patch-elements|<svg/);
  assert.match(text, /event: datastar-patch-signals/);
  assert.match(text, /"growth":1,/);
  assert.ok(
    Buffer.byteLength(text) < 12000,
    "entire growth stream stays below 12 KB",
  );
  assert.match(text, /"status":"Complete"/);
});
test("untrusted values are never reflected into the stream", async () => {
  const response = await fetch(
    `${base}/api/grow?datastar=${encodeURIComponent(JSON.stringify({ density: 999999, palette: "<script>alert(1)</script>", seed: "NaN" }))}`,
  );
  const text = await response.text();
  assert.match(text, /"growth":1,/);
  assert.doesNotMatch(text, /<script>|NaN/);
});
test("invalid JSON and non-object signals return 400", async () => {
  for (const value of ["{", "null", "[]"]) {
    const response = await fetch(
      `${base}/api/grow?datastar=${encodeURIComponent(value)}`,
    );
    assert.equal(response.status, 400);
    await response.text();
  }
});
test("growth delivers 64 complete SSE frames before ending", async () => {
  const response = await fetch(
    `${base}/api/grow?datastar=${encodeURIComponent('{"density":100}')}`,
  );
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /datastar-patch-signals/);
  let text = new TextDecoder().decode(first.value);
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    text += new TextDecoder().decode(chunk.value);
  }
  assert.equal((text.match(/event: datastar-patch-signals/g) || []).length, 64);
  assert.match(text, /"frame":64/);
  assert.match(text, /"growth":1,/);
  assert.match(text, /"status":"Complete"/);
});
