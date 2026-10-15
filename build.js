import { readFile, writeFile } from "node:fs/promises";
// Geometry is created once at build time. Interaction never rebuilds this tree.
let petals = "";
for (let i = 0; i < 800; i++) {
  const radius = Math.sqrt(i / 800) * 240;
  const length = 10 + Math.sin(i * 7.3) * 4 + radius * 0.035;
  petals += `<g class="petal" style="--i:${i};--r:${radius.toFixed(3)}px;--opacity:${(0.35 + (i % 7) * 0.085).toFixed(3)}"><path d="M0 ${-length} Q${length * 0.65} 0 0 ${length} Q${-length * 0.65} 0 0 ${-length}Z"/><path class="vein" d="M0 ${-length}V${length}"/></g>`;
}
const art = `<div id="artwork" class="artwork"><svg viewBox="0 0 800 760" role="img" aria-label="Interactive botanical composition"><defs><radialGradient id="halo"><stop class="halo-stop" stop-opacity=".16"/><stop offset="1" stop-opacity="0"/></radialGradient></defs><circle cx="400" cy="380" r="350" fill="url(#halo)"/><g class="orbits" fill="none"><circle cx="400" cy="380" r="310"/><circle cx="400" cy="380" r="230" stroke-dasharray="2 8"/><ellipse cx="400" cy="380" rx="355" ry="140" transform="rotate(-35 400 380)"/><ellipse cx="400" cy="380" rx="355" ry="140" transform="rotate(35 400 380)"/></g><g transform="translate(400 380)"><g class="bloom">${petals}</g></g><circle class="core" cx="400" cy="380" r="5"/></svg></div>`;
let html = await readFile("index.template.html", "utf8");
html = html.replace("<!-- ARTWORK -->", art);
await writeFile("public/index.html", html);
console.log("Built 800 persistent petals. No runtime geometry allocation.");
