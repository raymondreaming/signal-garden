export const defaults = Object.freeze({
  system: "bloom",
  palette: "iris",
  count: 1600,
  spread: 68,
  twist: 35,
  speed: 35,
  force: 45,
  size: 45,
  seed: 42,
  zoom: 100,
  tool: "attract",
  playing: true,
  lines: false,
});
export function normalize(input = {}) {
  const result = { ...defaults };
  if (!input || typeof input !== "object" || Array.isArray(input))
    return result;
  for (const [key, values] of Object.entries({
    system: ["bloom", "vortex", "ribbons", "constellation"],
    palette: ["iris", "ember", "tide", "gold"],
    tool: ["attract", "repel", "swirl"],
  })) {
    if (values.includes(input[key])) result[key] = input[key];
  }
  for (const [key, min, max] of [
    ["count", 200, 4000],
    ["spread", 20, 100],
    ["twist", 0, 100],
    ["speed", 0, 100],
    ["force", 0, 100],
    ["size", 10, 100],
    ["seed", 1, 99999],
    ["zoom", 50, 180],
  ]) {
    if (typeof input[key] === "number" && Number.isFinite(input[key]))
      result[key] = Math.round(Math.min(max, Math.max(min, input[key])));
  }
  for (const key of ["playing", "lines"])
    if (typeof input[key] === "boolean") result[key] = input[key];
  return result;
}
const palettes = {
  iris: ["#b6a2fc", "#e9d4ff", "#778bec"],
  ember: ["#fcb080", "#ffdfb3", "#df789a"],
  tide: ["#87d9bc", "#d5f9dc", "#6fa8bd"],
  gold: ["#d8c179", "#fff0b7", "#a5ae82"],
};

// One canvas owns animation and transient pointer state. Datastar owns configuration.
if (globalThis.customElements)
  customElements.define(
    "living-field",
    class extends HTMLElement {
      static observedAttributes = ["config", "growth", "drift"];
      connectedCallback() {
        this.config = normalize();
        this.time = 0;
        this.growth = 1;
        this.drift = 0;
        this.last = 0;
        this.x = new Float32Array(4000);
        this.y = new Float32Array(4000);
        this.pointer = { x: 0, y: 0, active: false };
        this.pins = [];
        this.canvas = document.createElement("canvas");
        this.canvas.setAttribute(
          "aria-label",
          "Interactive particle field. Move the pointer to influence particles. Click to pin a force. Arrow keys move the force; Enter pins it.",
        );
        this.canvas.tabIndex = 0;
        this.append(this.canvas);
        this.ctx = this.canvas.getContext("2d", { alpha: false });
        this.events = new AbortController();
        const options = { signal: this.events.signal };
        this.canvas.addEventListener(
          "pointermove",
          (event) => {
            const rect = this.canvas.getBoundingClientRect();
            this.pointer = {
              x: event.clientX - rect.left - this.width / 2,
              y: event.clientY - rect.top - this.height / 2,
              active: true,
            };
            this.wake();
          },
          options,
        );
        this.canvas.addEventListener(
          "pointerleave",
          () => {
            this.pointer.active = false;
            this.wake();
          },
          options,
        );
        this.canvas.addEventListener(
          "pointerdown",
          (event) => {
            const rect = this.canvas.getBoundingClientRect();
            this.pointer = {
              x: event.clientX - rect.left - this.width / 2,
              y: event.clientY - rect.top - this.height / 2,
              active: true,
            };
            this.canvas.setPointerCapture(event.pointerId);
            this.wake();
          },
          options,
        );
        this.canvas.addEventListener(
          "pointerup",
          (event) => {
            if (this.canvas.hasPointerCapture(event.pointerId))
              this.canvas.releasePointerCapture(event.pointerId);
            this.pin();
            if (event.pointerType === "touch") this.pointer.active = false;
          },
          options,
        );
        this.canvas.addEventListener(
          "pointercancel",
          () => {
            this.pointer.active = false;
            this.wake();
          },
          options,
        );
        this.canvas.addEventListener(
          "keydown",
          (event) => {
            if (
              ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                event.key,
              )
            ) {
              event.preventDefault();
              this.pointer.active = true;
              this.pointer.x +=
                event.key === "ArrowRight"
                  ? 20
                  : event.key === "ArrowLeft"
                    ? -20
                    : 0;
              this.pointer.y +=
                event.key === "ArrowDown"
                  ? 20
                  : event.key === "ArrowUp"
                    ? -20
                    : 0;
              this.wake();
            } else if (event.key === "Enter") {
              event.preventDefault();
              this.pin();
            } else if (event.key === "Escape") {
              this.pointer.active = false;
              this.clearPins();
            }
          },
          options,
        );
        this.resize = new ResizeObserver(() => {
          const rect = this.getBoundingClientRect();
          this.width = rect.width;
          this.height = rect.height;
          this.ratio = Math.min(devicePixelRatio || 1, 2);
          this.canvas.width = Math.round(this.width * this.ratio);
          this.canvas.height = Math.round(this.height * this.ratio);
          cancelAnimationFrame(this.raf);
          this.raf = 0;
          this.until = performance.now() + 650;
          this.draw(performance.now());
        });
        this.resize.observe(this);
        document.addEventListener(
          "visibilitychange",
          () => {
            if (document.hidden) {
              cancelAnimationFrame(this.raf);
              this.raf = 0;
            } else this.wake();
          },
          options,
        );
        this.attributeChangedCallback();
      }
      disconnectedCallback() {
        cancelAnimationFrame(this.raf);
        this.events?.abort();
        this.resize?.disconnect();
      }
      attributeChangedCallback() {
        if (!this.ctx) return;
        try {
          this.config = normalize(
            JSON.parse(this.getAttribute("config") || "{}"),
          );
        } catch {
          this.config = normalize();
        }
        this.growth = Math.max(
          0,
          Math.min(1, Number(this.getAttribute("growth") ?? 1)),
        );
        this.drift = Number(this.getAttribute("drift") || 0);
        this.wake();
      }
      pin() {
        if (this.pins.length === 6) this.pins.shift();
        this.pins.push({ ...this.pointer, tool: this.config.tool });
        this.dispatchEvent(
          new CustomEvent("pins-changed", {
            detail: this.pins.length,
            bubbles: true,
          }),
        );
        this.wake();
      }
      clearPins() {
        this.pins = [];
        this.dispatchEvent(
          new CustomEvent("pins-changed", { detail: 0, bubbles: true }),
        );
        this.wake();
      }
      wake() {
        this.until = performance.now() + 650;
        if (!this.raf && !document.hidden)
          this.raf = requestAnimationFrame((t) => this.draw(t));
      }
      draw(now) {
        this.raf = 0;
        if (!this.width || !this.height) return;
        const firstFrame = !this.last;
        const dt = firstFrame
          ? 1 / 60
          : Math.min((now - this.last) / 1000, 0.04);
        this.last = now;
        const c = this.config,
          ctx = this.ctx;
        if (c.playing) this.time += (dt * c.speed) / 35;
        const t = this.time,
          radius =
            (((Math.min(this.width, this.height) * 0.37 * c.spread) / 68) *
              c.zoom) /
            100;
        const count = Math.round(c.count * this.growth),
          colors = palettes[c.palette];
        ctx.setTransform(
          this.ratio,
          0,
          0,
          this.ratio,
          (this.width * this.ratio) / 2,
          (this.height * this.ratio) / 2,
        );
        ctx.fillStyle = "#101518";
        ctx.fillRect(
          -this.width / 2,
          -this.height / 2,
          this.width,
          this.height,
        );
        // Sparse reference grid and rings stay in the same canvas, with no layout work.
        ctx.fillStyle = "#35403c";
        for (let gx = -this.width / 2 + 20; gx < this.width / 2; gx += 28)
          for (let gy = -this.height / 2 + 20; gy < this.height / 2; gy += 28)
            ctx.fillRect(gx, gy, 0.7, 0.7);
        ctx.strokeStyle = "#c3d4b512";
        ctx.lineWidth = 1;
        for (const r of [radius * 0.55, radius * 1.12]) {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(-radius * 1.2, 0);
        ctx.lineTo(radius * 1.2, 0);
        ctx.moveTo(0, -radius * 1.2);
        ctx.lineTo(0, radius * 1.2);
        ctx.stroke();
        const smooth = firstFrame ? 1 : 1 - Math.exp(-dt * 15),
          twist = c.twist + this.drift * 28,
          phase = c.seed * 0.019;
        const grid = Math.ceil(Math.sqrt(c.count));
        const forces = this.pointer.active
          ? [...this.pins, this.pointer]
          : this.pins;
        for (let i = 0; i < count; i++) {
          const u = i / c.count,
            r = Math.sqrt(u) * radius;
          let x, y;
          if (c.system === "bloom") {
            const a =
              i * (2.399963 + (twist - 35) * 0.00025) + t * 0.06 + phase;
            const ripple = 1 + Math.sin(i * 0.061 + t * 0.9) * 0.018;
            x = Math.cos(a) * r * ripple;
            y = Math.sin(a) * r * ripple * 0.88;
          } else if (c.system === "vortex") {
            const a =
              i * 2.399963 +
              t * (0.08 + u * 0.2) +
              Math.sin(u * 9 + t * 0.23) * (twist / 30) +
              phase;
            x = Math.cos(a) * r;
            y = Math.sin(a) * r * (0.4 + 0.45 * Math.sin(u * 3 + t * 0.1) ** 2);
          } else if (c.system === "ribbons") {
            const strand = i % 5,
              a = u * Math.PI * 2,
              depth = Math.cos(a * 3 + t * 0.2 + strand * 0.3);
            x = Math.sin(a * 3 + t * 0.12 + phase) * radius;
            y =
              Math.sin(a * 2 + strand * 0.12 + t * 0.16) * radius * 0.65 +
              (strand - 2) * (twist / 5 + 2) +
              depth * 12;
          } else {
            const gx = ((i % grid) / (grid - 1)) * 2 - 1,
              gy = (Math.floor(i / grid) / (grid - 1)) * 2 - 1;
            x =
              gx * radius * 0.8 +
              Math.sin(gy * 5 + t * 0.4 + phase) * twist * 0.65;
            y =
              gy * radius * 0.7 +
              Math.cos(gx * 5 + t * 0.4 + phase) * twist * 0.65;
          }
          for (const p of forces) {
            const dx = p.x - x,
              dy = p.y - y,
              d = Math.hypot(dx, dy),
              reach = radius * 0.65;
            if (d < reach && d > 0.01) {
              const power = (1 - d / reach) ** 2 * c.force * 0.8;
              const tool = p.tool || c.tool;
              if (tool === "swirl") {
                x += (-dy / d) * power;
                y += (dx / d) * power;
              } else {
                const sign = tool === "repel" ? -1 : 1;
                x += (dx / d) * power * sign;
                y += (dy / d) * power * sign;
              }
            }
          }
          this.x[i] += (x - this.x[i]) * smooth;
          this.y[i] += (y - this.y[i]) * smooth;
        }
        if (c.lines) {
          ctx.lineWidth = 0.45;
          for (let channel = 0; channel < 3; channel++) {
            ctx.strokeStyle = colors[channel] + "28";
            ctx.beginPath();
            for (let i = channel; i < count - 5; i += 6) {
              ctx.moveTo(this.x[i], this.y[i]);
              ctx.lineTo(this.x[i + 5], this.y[i + 5]);
            }
            ctx.stroke();
          }
        }
        const dot = 0.5 + c.size * 0.024;
        for (let channel = 0; channel < 3; channel++) {
          ctx.fillStyle = colors[channel];
          ctx.globalAlpha = 0.72;
          ctx.beginPath();
          for (let i = channel; i < count; i += 3) {
            const x = this.x[i],
              y = this.y[i],
              size = dot * (0.6 + (i % 11) / 14);
            ctx.moveTo(x + size, y);
            if (c.system === "bloom")
              ctx.ellipse(
                x,
                y,
                size * 0.66,
                size * 2.15,
                Math.atan2(y, x) + Math.PI / 2,
                0,
                Math.PI * 2,
              );
            else ctx.arc(x, y, size, 0, Math.PI * 2);
          }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (const p of forces) {
          ctx.strokeStyle = "#d4e2b99a";
          ctx.lineWidth = 1;
          ctx.setLineDash(p.active ? [3, 5] : []);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(p.x - 4, p.y);
          ctx.lineTo(p.x + 4, p.y);
          ctx.moveTo(p.x, p.y - 4);
          ctx.lineTo(p.x, p.y + 4);
          ctx.stroke();
        }
        this.frames = (this.frames || 0) + 1;
        if (now - (this.metricAt || now) > 1000) {
          this.dispatchEvent(
            new CustomEvent("field-metrics", {
              detail: {
                fps: Math.round((this.frames * 1000) / (now - this.metricAt)),
              },
              bubbles: true,
            }),
          );
          this.frames = 0;
          this.metricAt = now;
        }
        if (!this.metricAt) this.metricAt = now;
        if ((c.playing && c.speed > 0) || now < this.until)
          this.raf = requestAnimationFrame((t) => this.draw(t));
        else
          this.dispatchEvent(
            new CustomEvent("field-metrics", {
              detail: { fps: 0 },
              bubbles: true,
            }),
          );
      }
      thumbnail() {
        const image = document.createElement("canvas");
        image.width = 320;
        image.height = 200;
        const ctx = image.getContext("2d");
        ctx.drawImage(this.canvas, 0, 0, 320, 200);
        return image.toDataURL("image/webp", 0.7);
      }
      async exportImage() {
        const canvas = document.createElement("canvas");
        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(this.canvas, 0, 0);
        ctx.font = `${Math.max(12, canvas.width / 80)}px monospace`;
        ctx.fillStyle = "#d4e2b9";
        ctx.fillText(
          `SIGNAL GARDEN / ${this.config.system.toUpperCase()} / SEED ${this.config.seed}`,
          30,
          canvas.height - 30,
        );
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob) throw new Error("Image export unavailable");
        const url = URL.createObjectURL(blob),
          link = document.createElement("a");
        link.href = url;
        link.download = `signal-garden-${this.config.system}-${this.config.seed}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  );
