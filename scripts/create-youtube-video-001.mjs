#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outDir = path.join(root, "assets", "youtube");
const workDir = path.join(outDir, ".video-001-work");
const outputMp4 = path.join(outDir, "video-001-website-pov.mp4");
const compatibilityMp4 = path.join(outDir, "video-001-draft.mp4");
const thumbnailPng = path.join(outDir, "video-001-thumbnail.png");
const appUrl = process.env.STACKSCOUT_VIDEO_URL ?? "http://localhost:4173";
const width = 1920;
const height = 1080;
const fps = 30;
const ffmpeg = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"].find((bin) => bin === "ffmpeg" || existsSync(bin));
const ffprobe = ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", "ffprobe"].find((bin) => bin === "ffprobe" || existsSync(bin));
const say = ["/usr/bin/say", "say"].find((bin) => bin === "say" || existsSync(bin));
const chrome = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
].find((bin) => bin.includes("/") ? existsSync(bin) : true);
const font = [
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/Library/Fonts/Arial.ttf",
].find(existsSync) ?? "/System/Library/Fonts/Supplemental/Arial.ttf";

const shots = [
  {
    name: "01-hook",
    duration: 7,
    text: "I hate scouring the internet for deals on my stack",
    action: async (page) => {
      await page.evaluate(`window.scrollTo({ top: 0, behavior: "instant" })`);
      await page.overlay({ label: "I hate scouring the internet for deals on my stack", x: 960, y: 810, cursorX: 1090, cursorY: 470 });
    },
  },
  {
    name: "02-creatine",
    duration: 8,
    text: "Open StackScout and compare creatine deals in one place.",
    action: async (page) => {
      await page.click('[data-category="creatine"]');
      await page.evaluate(`window.scrollTo({ top: 160, behavior: "instant" })`);
      await page.overlay({ label: "Compare creatine deals", x: 360, y: 150, cursorX: 865, cursorY: 147, click: true });
    },
  },
  {
    name: "03-sort-value",
    duration: 9,
    text: "Sort by value, because sticker price alone hides pack size and shipping.",
    action: async (page) => {
      await page.select("#sort-select", "value");
      await page.evaluate(`document.querySelector(".table-wrap")?.scrollIntoView({ block: "start" })`);
      await page.overlay({ label: "Sort by estimated value", x: 390, y: 115, cursorX: 333, cursorY: 102, click: true });
    },
  },
  {
    name: "04-delivered-total",
    duration: 9,
    text: "Check delivered total next, not just the item price.",
    action: async (page) => {
      await page.click('[data-sort-key="total"]');
      await page.evaluate(`document.querySelector(".table-wrap")?.scrollIntoView({ block: "start" })`);
      await page.overlay({ label: "Delivered total includes estimated shipping", x: 605, y: 116, cursorX: 1435, cursorY: 250, click: true });
    },
  },
  {
    name: "05-price-per-100g",
    duration: 9,
    text: "Then use price per 100 grams to compare different tub sizes fairly.",
    action: async (page) => {
      await page.click('[data-sort-key="value"]');
      await page.evaluate(`document.querySelector(".table-wrap")?.scrollIntoView({ block: "start" })`);
      await page.overlay({ label: "Price per 100g makes tub sizes comparable", x: 690, y: 116, cursorX: 1635, cursorY: 250, click: true });
    },
  },
  {
    name: "06-my-stack",
    duration: 8,
    text: "If something looks worth checking, add it to My stack.",
    action: async (page) => {
      await page.click("#results-body .stack-add");
      await page.evaluate(`document.querySelector(".stack-panel")?.scrollIntoView({ block: "center" })`);
      await page.overlay({ label: "Add products to My stack", x: 430, y: 180, cursorX: 1110, cursorY: 370, click: true });
    },
  },
  {
    name: "07-retailer",
    duration: 8,
    text: "Before buying, click through and verify the retailer checkout.",
    action: async (page) => {
      await page.evaluate(`document.querySelector(".table-wrap")?.scrollIntoView({ block: "start" })`);
      await page.overlay({ label: "Verify final price at retailer checkout", x: 610, y: 116, cursorX: 485, cursorY: 320, click: true });
    },
  },
  {
    name: "08-caveats",
    duration: 10,
    text: "Caveat: shipping is estimated, prices and stock are snapshots, and rural fees or promo codes can change the final total.",
    action: async (page) => {
      await page.evaluate(`document.querySelector(".faq")?.scrollIntoView({ block: "center" })`);
      await page.overlay({ label: "Shipping estimated. Prices and stock are snapshots.", x: 590, y: 145, cursorX: 1190, cursorY: 700 });
    },
  },
  {
    name: "09-cta",
    duration: 7,
    text: "Use it as a faster shortlist, then tell me which NZ store StackScout should add next.",
    action: async (page) => {
      await page.evaluate(`window.scrollTo({ top: 0, behavior: "instant" })`);
      await page.overlay({ label: "What NZ store should StackScout add next?", x: 570, y: 810, cursorX: 1040, cursorY: 450 });
    },
  },
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stderr}`));
    });
  });
}

function runWithTimeout(command, args, timeoutMs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 1500).unref();
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 || timedOut) resolve({ stdout, stderr, timedOut });
      else reject(new Error(`${command} exited ${code}\n${stderr}`));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
  return response.json();
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = new URL(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
  }

  connect() {
    return new Promise((resolve, reject) => {
      const key = randomBytes(16).toString("base64");
      this.socket = net.createConnection(Number(this.wsUrl.port), this.wsUrl.hostname);
      this.socket.once("error", reject);
      this.socket.once("connect", () => {
        this.socket.write(
          [
            `GET ${this.wsUrl.pathname}${this.wsUrl.search} HTTP/1.1`,
            `Host: ${this.wsUrl.host}`,
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Key: ${key}`,
            "Sec-WebSocket-Version: 13",
            "",
            "",
          ].join("\r\n"),
        );
      });
      const onHandshake = (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        const split = this.buffer.indexOf("\r\n\r\n");
        if (split === -1) return;
        const header = this.buffer.subarray(0, split).toString("utf8");
        if (!header.includes("101 Switching Protocols")) {
          reject(new Error(`Chrome WebSocket handshake failed:\n${header}`));
          return;
        }
        const accept = header.match(/sec-websocket-accept:\s*(.+)\r?/i)?.[1]?.trim();
        const expected = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
        if (accept !== expected) {
          reject(new Error("Chrome WebSocket handshake returned an invalid accept key"));
          return;
        }
        this.socket.off("data", onHandshake);
        this.buffer = this.buffer.subarray(split + 4);
        this.socket.on("data", (data) => this.onData(data));
        this.onData(Buffer.alloc(0));
        resolve();
      };
      this.socket.on("data", onHandshake);
    });
  }

  onData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      let offset = 2;
      let length = second & 0x7f;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        length = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }
      const masked = Boolean(second & 0x80);
      const maskOffset = masked ? 4 : 0;
      if (this.buffer.length < offset + maskOffset + length) return;
      const mask = masked ? this.buffer.subarray(offset, offset + 4) : null;
      const payload = Buffer.from(this.buffer.subarray(offset + maskOffset, offset + maskOffset + length));
      if (mask) {
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
      }
      this.buffer = this.buffer.subarray(offset + maskOffset + length);
      const opcode = first & 0x0f;
      if (opcode === 1) this.onMessage(payload.toString("utf8"));
      if (opcode === 8) this.close();
    }
  }

  onMessage(text) {
    const message = JSON.parse(text);
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
    else pending.resolve(message.result);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = Buffer.from(JSON.stringify({ id, method, params }));
    const frame = Buffer.alloc(payload.length < 126 ? 6 : 8);
    frame[0] = 0x81;
    if (payload.length < 126) {
      frame[1] = 0x80 | payload.length;
      randomBytes(4).copy(frame, 2);
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= frame[2 + (i % 4)];
    } else {
      frame[1] = 0x80 | 126;
      frame.writeUInt16BE(payload.length, 2);
      randomBytes(4).copy(frame, 4);
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= frame[4 + (i % 4)];
    }
    this.socket.write(Buffer.concat([frame, payload]));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 15000);
    });
  }

  close() {
    this.socket?.destroy();
  }
}

class Page {
  constructor(cdp) {
    this.cdp = cdp;
  }

  async evaluate(expression) {
    const result = await this.cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Runtime.evaluate failed");
    return result.result?.value;
  }

  async click(selector) {
    await this.evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("Missing selector: ${selector}");
        el.scrollIntoView({ block: "center", inline: "center" });
        el.click();
      })()
    `);
    await sleep(450);
  }

  async select(selector, value) {
    await this.evaluate(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error("Missing selector: ${selector}");
        el.value = ${JSON.stringify(value)};
        el.dispatchEvent(new Event("change", { bubbles: true }));
      })()
    `);
    await sleep(450);
  }

  async overlay({ label, x, y, cursorX, cursorY, click = false }) {
    await this.evaluate(`
      (() => {
        document.querySelector("#video-capture-overlay")?.remove();
        const overlay = document.createElement("div");
        overlay.id = "video-capture-overlay";
        overlay.innerHTML = \`
          <div class="video-label">${escapeForTemplate(label)}</div>
          <div class="video-cursor${click ? " clicking" : ""}"></div>
        \`;
        Object.assign(overlay.style, {
          position: "fixed",
          inset: "0",
          zIndex: "2147483647",
          pointerEvents: "none",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        });
        const style = document.createElement("style");
        style.textContent = \`
          #video-capture-overlay .video-label {
            position: fixed;
            left: ${Math.round(x)}px;
            top: ${Math.round(y)}px;
            transform: translate(-50%, -50%);
            max-width: 1120px;
            padding: 22px 30px;
            border-radius: 8px;
            background: rgba(23, 33, 29, 0.88);
            color: white;
            box-shadow: 0 18px 45px rgba(0,0,0,0.25);
            font-size: 44px;
            font-weight: 900;
            line-height: 1.12;
            text-align: center;
          }
          #video-capture-overlay .video-cursor {
            position: fixed;
            left: ${Math.round(cursorX)}px;
            top: ${Math.round(cursorY)}px;
            width: 0;
            height: 0;
            border-left: 22px solid white;
            border-top: 16px solid transparent;
            border-bottom: 16px solid transparent;
            filter: drop-shadow(0 3px 4px rgba(0,0,0,0.45));
          }
          #video-capture-overlay .video-cursor.clicking::after {
            content: "";
            position: absolute;
            left: -34px;
            top: -34px;
            width: 56px;
            height: 56px;
            border: 5px solid #0b6b58;
            border-radius: 50%;
            background: rgba(11,107,88,0.18);
          }
        \`;
        overlay.append(style);
        document.body.append(overlay);
      })()
    `);
    await sleep(250);
  }

  async screenshot(file) {
    const result = await this.cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true,
    });
    await writeFile(file, Buffer.from(result.data, "base64"));
  }
}

function escapeForTemplate(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
}

async function launchChrome() {
  const port = 9222 + Math.floor(Math.random() * 500);
  const profileDir = path.join(workDir, "chrome-profile");
  await mkdir(profileDir, { recursive: true });
  const child = spawn(chrome, [
    "--headless=new",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    `--window-size=${width},${height}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
      const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (target) return { child, wsUrl: target.webSocketDebuggerUrl };
    } catch {
      await sleep(150);
    }
  }
  child.kill("SIGTERM");
  throw new Error(`Chrome did not expose a debugging target.\n${stderr}`);
}

async function captureSiteShots() {
  try {
    const captureHtml = await createCaptureHtml();
    const files = [];
    for (const shot of shots) {
      const file = path.join(workDir, `${shot.name}.png`);
      const profile = path.join(workDir, `chrome-${shot.name}`);
      await mkdir(profile, { recursive: true });
      await runWithTimeout(chrome, [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--allow-file-access-from-files",
        `--user-data-dir=${profile}`,
        `--window-size=${width},${height}`,
        "--virtual-time-budget=7000",
        `--screenshot=${file}`,
        `${pathToFileURL(captureHtml).href}?shot=${encodeURIComponent(shot.name)}`,
      ], 12000);
      if (!existsSync(file)) throw new Error(`Chrome did not write ${file}`);
      files.push(file);
      console.log(`Captured ${path.relative(root, file)}`);
    }
    return files;
  } catch (error) {
    console.warn(`Chrome website capture failed (${error.message}); rendering StackScout UI frames from real app data`);
    return createRenderedShots();
  }
}

async function createRenderedShots() {
  const dataset = JSON.parse(await readText(path.join(root, "data", "products.json")));
  const products = (dataset.products ?? [])
    .filter((product) => (product.category ?? "creatine") === "creatine")
    .filter((product) => product.available !== false && product.fetchStatus !== "unavailable")
    .sort((a, b) => pricePer100gForRender(a) - pricePer100gForRender(b))
    .slice(0, 6);

  const files = [];
  for (const [index, shot] of shots.entries()) {
    const file = path.join(workDir, `${shot.name}.png`);
    await createRenderedShot(file, shot, products, index);
    files.push(file);
    console.log(`Rendered ${path.relative(root, file)}`);
  }
  return files;
}

function estimatedShippingForRender(product) {
  if (!product.deliveryAvailable) return null;
  if (product.price >= product.shipping.freeThreshold) return 0;
  return product.shipping.cost;
}

function estimatedTotalForRender(product) {
  const shipping = estimatedShippingForRender(product);
  return shipping === null ? product.price : product.price + shipping;
}

function pricePer100gForRender(product) {
  return (estimatedTotalForRender(product) / product.sizeGrams) * 100;
}

function nzMoney(value) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(value);
}

async function textAsset(name, text) {
  const file = path.join(workDir, `${name}.txt`);
  await writeFile(file, text);
  return file;
}

async function createRenderedShot(file, shot, products, index) {
  const title = await textAsset(`${shot.name}-title`, "StackScout");
  const eyebrow = await textAsset(`${shot.name}-eyebrow`, "Build your stack for less with NZ's supplement price checker");
  const summary = await textAsset(`${shot.name}-summary`, "Compare creatine by real cost, size, reviews, shipping, and delivered total.");
  const status = await textAsset(`${shot.name}-status`, "Data refreshed from local product cache for video capture.");
  const label = await textAsset(`${shot.name}-label`, shot.text);
  const sort = await textAsset(`${shot.name}-sort`, sortLabelForShot(shot.name));
  const caveat = await textAsset(`${shot.name}-caveat`, "Prices, stock, and shipping are snapshots. Check retailer checkout before buying.");
  const stackText = await textAsset(`${shot.name}-stack`, stackTextForShot(shot.name, products[0]));
  const headers = await Promise.all(["Retailer", "Product", "Pack", "Item", "Shipping", "Delivered", "$ / 100g", "My stack"].map((text, i) => textAsset(`${shot.name}-head-${i}`, text)));
  const rowFiles = await Promise.all(
    products.map(async (product, row) => ({
      retailer: await textAsset(`${shot.name}-row-${row}-retailer`, product.retailer),
      product: await textAsset(`${shot.name}-row-${row}-product`, product.product),
      pack: await textAsset(`${shot.name}-row-${row}-pack`, `${product.sizeGrams.toLocaleString()}g`),
      item: await textAsset(`${shot.name}-row-${row}-item`, nzMoney(product.price)),
      shipping: await textAsset(`${shot.name}-row-${row}-shipping`, estimatedShippingForRender(product) === 0 ? "Free" : nzMoney(estimatedShippingForRender(product) ?? 0)),
      delivered: await textAsset(`${shot.name}-row-${row}-delivered`, nzMoney(estimatedTotalForRender(product))),
      value: await textAsset(`${shot.name}-row-${row}-value`, nzMoney(pricePer100gForRender(product))),
      stack: await textAsset(`${shot.name}-row-${row}-stack`, shot.name === "06-my-stack" && row === 0 ? "Added (1)" : "Add"),
    })),
  );

  const tableTop = shot.name === "01-hook" || shot.name === "09-cta" ? 490 : 315;
  const filter = [
    "format=rgba",
    "drawbox=x=0:y=0:w=1920:h=1080:color=#f5f1e8:t=fill",
    "drawbox=x=0:y=0:w=1920:h=18:color=#0b6b58:t=fill",
    drawText({ file: eyebrow, x: "(w-text_w)/2", y: 60, size: 24, color: "#0b6b58" }),
    drawText({ file: title, x: "(w-text_w)/2", y: 95, size: 112, color: "#17211d" }),
    drawText({ file: summary, x: "(w-text_w)/2", y: 225, size: 34, color: "#5a665f" }),
    drawText({ file: status, x: "(w-text_w)/2", y: 278, size: 23, color: "#5a665f" }),
    "drawbox=x=700:y=332:w=150:h=48:color=#0b6b58:t=fill",
    "drawbox=x=864:y=332:w=220:h=48:color=white:t=fill",
    "drawbox=x=1098:y=332:w=170:h=48:color=white:t=fill",
    drawInlineText("Creatine", 726, 344, 23, "white"),
    drawInlineText("Whey protein", 895, 344, 23, "#17211d"),
    drawInlineText("Pre-workout", 1126, 344, 23, "#17211d"),
    "drawbox=x=96:y=405:w=360:h=78:color=white:t=fill",
    drawInlineText("Sort", 118, 420, 21, "#5a665f"),
    drawText({ file: sort, x: 118, y: 448, size: 28, color: "#17211d" }),
    "drawbox=x=486:y=405:w=1338:h=78:color=white:t=fill",
    drawText({ file: caveat, x: 512, y: 432, size: 28, color: "#5a665f" }),
    ...stackPanelFilters(shot.name, stackText),
    ...tableFilters(tableTop, headers, rowFiles, shot.name),
    "drawbox=x=210:y=792:w=1500:h=116:color=black@0.82:t=fill",
    drawText({ file: label, x: "(w-text_w)/2", y: 824, size: 44, color: "white" }),
    ...cursorFilters(shot.name),
  ].join(",");

  await run(ffmpeg, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=#f5f1e8:s=${width}x${height}:r=1:d=1`,
    "-vf",
    filter,
    "-frames:v",
    "1",
    file,
  ]);
}

function sortLabelForShot(name) {
  if (name === "04-delivered-total") return "Lowest delivered total";
  if (name === "05-price-per-100g") return "Best value";
  return "Best value";
}

function stackTextForShot(name, product) {
  if (name !== "06-my-stack" || !product) return "My stack: No products added yet. Rough stack total $0.00";
  return `My stack: 1 product saved. Rough stack total ${nzMoney(product.price)}`;
}

function drawInlineText(text, x, y, size, color) {
  const escaped = text.replaceAll("'", "\\'").replaceAll(":", "\\:");
  return `drawtext=fontfile='${font}':text='${escaped}':fontsize=${size}:fontcolor=${color}:x=${x}:y=${y}`;
}

function stackPanelFilters(name, stackText) {
  const y = name === "06-my-stack" ? 500 : 0;
  if (!y) return [];
  return [
    `drawbox=x=96:y=${y}:w=1728:h=110:color=white:t=fill`,
    drawInlineText("My stack", 126, y + 20, 30, "#17211d"),
    drawText({ file: stackText, x: 126, y: y + 62, size: 26, color: "#5a665f" }),
  ];
}

function tableFilters(tableTop, headers, rowFiles, shotName) {
  const cols = [116, 295, 775, 910, 1040, 1225, 1435, 1645];
  const widths = [150, 450, 105, 100, 155, 165, 150, 120];
  const filters = [
    `drawbox=x=96:y=${tableTop}:w=1728:h=52:color=#17211d:t=fill`,
    `drawbox=x=96:y=${tableTop + 52}:w=1728:h=${rowFiles.length * 78}:color=white:t=fill`,
  ];
  headers.forEach((file, i) => filters.push(drawText({ file, x: cols[i], y: tableTop + 14, size: 23, color: "white" })));
  rowFiles.forEach((row, i) => {
    const y = tableTop + 52 + i * 78;
    const shade = i % 2 === 0 ? "#ffffff" : "#f8faf8";
    filters.push(`drawbox=x=96:y=${y}:w=1728:h=78:color=${shade}:t=fill`);
    if (i === 0) filters.push(`drawbox=x=96:y=${y}:w=1728:h=78:color=#0b6b58@0.08:t=fill`);
    filters.push(drawText({ file: row.retailer, x: cols[0], y: y + 18, size: 24, color: "#17211d" }));
    filters.push(drawText({ file: row.product, x: cols[1], y: y + 14, size: 22, color: "#17211d" }));
    filters.push(drawText({ file: row.pack, x: cols[2], y: y + 20, size: 23, color: "#17211d" }));
    filters.push(drawText({ file: row.item, x: cols[3], y: y + 20, size: 23, color: "#17211d" }));
    filters.push(drawText({ file: row.shipping, x: cols[4], y: y + 20, size: 23, color: "#17211d" }));
    filters.push(drawText({ file: row.delivered, x: cols[5], y: y + 20, size: 25, color: shotName === "04-delivered-total" ? "#b5422f" : "#17211d" }));
    filters.push(drawText({ file: row.value, x: cols[6], y: y + 20, size: 25, color: shotName === "05-price-per-100g" ? "#0b6b58" : "#17211d" }));
    filters.push(`drawbox=x=${cols[7] - 6}:y=${y + 16}:w=${widths[7]}:h=38:color=${shotName === "06-my-stack" && i === 0 ? "#0b6b58" : "#f5f1e8"}:t=fill`);
    filters.push(drawText({ file: row.stack, x: cols[7] + 8, y: y + 23, size: 18, color: shotName === "06-my-stack" && i === 0 ? "white" : "#17211d" }));
  });
  return filters;
}

function cursorFilters(name) {
  const positions = {
    "02-creatine": [865, 147],
    "03-sort-value": [333, 446],
    "04-delivered-total": [1325, 560],
    "05-price-per-100g": [1510, 560],
    "06-my-stack": [1688, 665],
    "07-retailer": [415, 560],
  };
  const [x, y] = positions[name] ?? [1090, 470];
  return [
    `drawbox=x=${x}:y=${y}:w=28:h=6:color=white:t=fill`,
    `drawbox=x=${x}:y=${y}:w=6:h=36:color=white:t=fill`,
    name === "01-hook" || name === "08-caveats" || name === "09-cta" ? "" : `drawbox=x=${x - 24}:y=${y - 24}:w=72:h=72:color=#0b6b58@0.18:t=6`,
  ].filter(Boolean);
}

async function createCaptureHtml() {
  const index = await readText(path.join(root, "index.html"));
  const dataset = JSON.parse(await readText(path.join(root, "data", "products.json")));
  const shotData = Object.fromEntries(
    shots.map((shot) => [
      shot.name,
      {
        label: shot.text,
        x: shot.name === "01-hook" || shot.name === "09-cta" ? 960 : 580,
        y: shot.name === "01-hook" || shot.name === "09-cta" ? 810 : 125,
      },
    ]),
  );
  const injectedHead = `
    <base href="${pathToFileURL(`${root}/`).href}" />
    <script>
      window.__STACKSCOUT_CAPTURE_DATA__ = ${JSON.stringify(dataset).replaceAll("</script", "<\\/script")};
      window.__STACKSCOUT_CAPTURE_SHOTS__ = ${JSON.stringify(shotData).replaceAll("</script", "<\\/script")};
      (() => {
        const moneyValue = (product) => {
          const shipping = !product.deliveryAvailable ? null : product.price >= product.shipping.freeThreshold ? 0 : product.shipping.cost;
          return shipping === null ? product.price : product.price + shipping;
        };
        const per100 = (product) => (moneyValue(product) / product.sizeGrams) * 100;
        const isAvailable = (product) => product.available !== false && product.fetchStatus !== "unavailable";
        const sortProducts = (products, sort) => [...products].sort((a, b) => {
          if (sort === "total-desc") return moneyValue(b) - moneyValue(a);
          if (sort === "total-asc") return moneyValue(a) - moneyValue(b);
          if (sort === "price-desc") return b.price - a.price;
          if (sort === "price-asc") return a.price - b.price;
          if (sort === "size-desc") return b.sizeGrams - a.sizeGrams;
          if (sort === "size-asc") return a.sizeGrams - b.sizeGrams;
          if (sort === "value-desc") return per100(b) - per100(a);
          return per100(a) - per100(b);
        });
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, options) => {
          const url = new URL(String(input), window.location.href);
          if (url.pathname === "/api/products") {
            const data = window.__STACKSCOUT_CAPTURE_DATA__;
            const category = url.searchParams.get("category");
            const sort = url.searchParams.get("sort") || "value";
            const raw = data.products || [];
            const categoryProducts = category ? raw.filter((product) => (product.category || "creatine") === category) : raw;
            const products = sortProducts(categoryProducts.filter(isAvailable), sort).map((product) => ({
              ...product,
              productImage: product.productImage || null,
              available: isAvailable(product),
            }));
            return new Response(JSON.stringify({
              source: "capture-cache",
              refreshedAt: data.refreshedAt || null,
              discoveryRefreshedAt: data.discoveryRefreshedAt || null,
              category,
              products,
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          return originalFetch(input, options);
        };
      })();
    </script>
  `;
  const injectedBody = `
    <script>
      (() => {
        const shotName = new URLSearchParams(window.location.search).get("shot") || "01-hook";
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const waitForRows = () => new Promise((resolve, reject) => {
          const start = Date.now();
          const tick = () => {
            if (document.querySelectorAll("#results-body tr").length) resolve();
            else if (Date.now() - start > 5000) reject(new Error("Timed out waiting for rows"));
            else setTimeout(tick, 100);
          };
          tick();
        });
        const click = async (selector) => {
          const el = document.querySelector(selector);
          if (!el) return;
          el.scrollIntoView({ block: "center", inline: "center" });
          el.click();
          await wait(250);
        };
        const select = async (selector, value) => {
          const el = document.querySelector(selector);
          if (!el) return;
          el.value = value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          await wait(250);
        };
        const overlay = ({ label, x = 560, y = 125, cursorX = 1050, cursorY = 420, click = false }) => {
          document.querySelector("#video-capture-overlay")?.remove();
          const el = document.createElement("div");
          el.id = "video-capture-overlay";
          el.innerHTML = '<div class="video-label"></div><div class="video-cursor"></div>';
          el.querySelector(".video-label").textContent = label;
          el.querySelector(".video-cursor").classList.toggle("clicking", click);
          Object.assign(el.style, { position: "fixed", inset: "0", zIndex: "2147483647", pointerEvents: "none", fontFamily: "Inter, system-ui, sans-serif" });
          const style = document.createElement("style");
          style.textContent = \`
            #video-capture-overlay .video-label {
              position: fixed; left: \${x}px; top: \${y}px; transform: translate(-50%, -50%);
              max-width: 1120px; padding: 22px 30px; border-radius: 8px;
              background: rgba(23, 33, 29, 0.9); color: white;
              box-shadow: 0 18px 45px rgba(0,0,0,0.25);
              font-size: 44px; font-weight: 900; line-height: 1.12; text-align: center;
            }
            #video-capture-overlay .video-cursor {
              position: fixed; left: \${cursorX}px; top: \${cursorY}px; width: 0; height: 0;
              border-left: 22px solid white; border-top: 16px solid transparent; border-bottom: 16px solid transparent;
              filter: drop-shadow(0 3px 4px rgba(0,0,0,0.45));
            }
            #video-capture-overlay .video-cursor.clicking::after {
              content: ""; position: absolute; left: -34px; top: -34px; width: 56px; height: 56px;
              border: 5px solid #0b6b58; border-radius: 50%; background: rgba(11,107,88,0.18);
            }
          \`;
          el.append(style);
          document.body.append(el);
        };
        window.addEventListener("load", async () => {
          localStorage.removeItem("stackscout.myStack.v1");
          await waitForRows();
          if (shotName === "01-hook") {
            window.scrollTo(0, 0);
            overlay({ label: "I hate scouring the internet for deals on my stack", x: 960, y: 810, cursorX: 1090, cursorY: 470 });
          } else if (shotName === "02-creatine") {
            await click('[data-category="creatine"]');
            window.scrollTo(0, 160);
            overlay({ label: "Compare creatine deals", x: 360, y: 150, cursorX: 865, cursorY: 147, click: true });
          } else if (shotName === "03-sort-value") {
            await select("#sort-select", "value");
            document.querySelector(".table-wrap")?.scrollIntoView({ block: "start" });
            overlay({ label: "Sort by estimated value", x: 390, y: 115, cursorX: 333, cursorY: 102, click: true });
          } else if (shotName === "04-delivered-total") {
            await click('[data-sort-key="total"]');
            document.querySelector(".table-wrap")?.scrollIntoView({ block: "start" });
            overlay({ label: "Delivered total includes estimated shipping", x: 605, y: 116, cursorX: 1435, cursorY: 250, click: true });
          } else if (shotName === "05-price-per-100g") {
            await click('[data-sort-key="value"]');
            document.querySelector(".table-wrap")?.scrollIntoView({ block: "start" });
            overlay({ label: "Price per 100g makes tub sizes comparable", x: 690, y: 116, cursorX: 1635, cursorY: 250, click: true });
          } else if (shotName === "06-my-stack") {
            await click("#results-body .stack-add");
            document.querySelector(".stack-panel")?.scrollIntoView({ block: "center" });
            overlay({ label: "Add products to My stack", x: 430, y: 180, cursorX: 1110, cursorY: 370, click: true });
          } else if (shotName === "07-retailer") {
            document.querySelector(".table-wrap")?.scrollIntoView({ block: "start" });
            overlay({ label: "Verify final price at retailer checkout", x: 610, y: 116, cursorX: 485, cursorY: 320, click: true });
          } else if (shotName === "08-caveats") {
            document.querySelector(".faq")?.scrollIntoView({ block: "center" });
            overlay({ label: "Shipping estimated. Prices and stock are snapshots.", x: 590, y: 145, cursorX: 1190, cursorY: 700 });
          } else {
            window.scrollTo(0, 0);
            overlay({ label: "What NZ store should StackScout add next?", x: 570, y: 810, cursorX: 1040, cursorY: 450 });
          }
        });
      })();
    </script>
  `;
  const html = index.replace("<head>", `<head>${injectedHead}`).replace("</body>", `${injectedBody}</body>`);
  const file = path.join(workDir, "capture.html");
  await writeFile(file, html);
  return file;
}

async function readText(file) {
  return readFile(file, "utf8");
}

async function createSegment(index, image) {
  const shot = shots[index];
  const segment = path.join(workDir, `${shot.name}.mp4`);
  const zoom = index % 2 === 0 ? "min(zoom+0.00055,1.035)" : "min(zoom+0.00042,1.028)";
  const x = index % 2 === 0 ? "iw/2-(iw/zoom/2)" : `(iw-iw/zoom)*on/${shot.duration * fps}`;
  const y = index % 3 === 0 ? "ih/2-(ih/zoom/2)" : "(ih-ih/zoom)*0.35";
  await run(ffmpeg, [
    "-y",
    "-loop",
    "1",
    "-i",
    image,
    "-t",
    String(shot.duration),
    "-vf",
    `scale=${width}:${height},zoompan=z='${zoom}':x='${x}':y='${y}':d=${shot.duration * fps}:s=${width}x${height}:fps=${fps},format=yuv420p`,
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    segment,
  ]);
  return segment;
}

async function createVoiceover(totalSeconds) {
  const script = shots.map((shot) => shot.text).join(" ");
  const scriptFile = path.join(workDir, "voiceover.txt");
  const voiceAiff = path.join(workDir, "voiceover.aiff");
  const voiceWav = path.join(workDir, "voiceover.wav");
  await writeFile(scriptFile, script);
  try {
    await run(say, ["-r", "182", "-o", voiceAiff, "-f", scriptFile]);
    await run(ffmpeg, ["-y", "-i", voiceAiff, "-af", `apad=pad_dur=${totalSeconds}`, "-t", String(totalSeconds), voiceWav]);
    return voiceWav;
  } catch (error) {
    console.warn(`Voiceover generation skipped: ${error.message}`);
    await run(ffmpeg, ["-y", "-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=48000:d=${totalSeconds}`, voiceWav]);
    return voiceWav;
  }
}

async function createVideo(segments) {
  const concatList = path.join(workDir, "concat.txt");
  await writeFile(concatList, segments.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
  const silentVideo = path.join(workDir, "silent.mp4");
  await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", silentVideo]);

  const totalSeconds = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const voice = await createVoiceover(totalSeconds);
  const clickExpression = "if(lt(mod(t\\,8)\\,0.04)\\,0.16*sin(2*PI*1150*t)*exp(-80*mod(t\\,8))\\,0)";
  await run(ffmpeg, [
    "-y",
    "-i",
    silentVideo,
    "-i",
    voice,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=196:duration=${totalSeconds}:sample_rate=48000`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=294:duration=${totalSeconds}:sample_rate=48000`,
    "-f",
    "lavfi",
    "-i",
    `aevalsrc=${clickExpression}:d=${totalSeconds}:s=48000`,
    "-filter_complex",
    [
      "[1:a]volume=1.0,aformat=channel_layouts=stereo[vo]",
      "[2:a]volume=0.018,tremolo=f=4:d=0.35,aformat=channel_layouts=stereo[m1]",
      "[3:a]volume=0.012,tremolo=f=3:d=0.25,aformat=channel_layouts=stereo[m2]",
      "[4:a]volume=0.5,aformat=channel_layouts=stereo[sfx]",
      `[vo][m1][m2][sfx]amix=inputs=4:duration=first:dropout_transition=1,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, totalSeconds - 2)}:d=2[a]`,
    ].join(";"),
    "-map",
    "0:v:0",
    "-map",
    "[a]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    outputMp4,
  ]);
  await copyFile(outputMp4, compatibilityMp4);
}

function drawText({ file, x, y, size, color = "white", box = false }) {
  const safeFile = file.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
  return [
    `drawtext=fontfile='${font}'`,
    `textfile='${safeFile}'`,
    `fontsize=${size}`,
    `fontcolor=${color}`,
    "line_spacing=12",
    `x=${x}`,
    `y=${y}`,
    box ? "box=1:boxcolor=black@0.72:boxborderw=24" : "",
  ].filter(Boolean).join(":");
}

async function createThumbnail(firstShot) {
  const cleanBase = path.join(workDir, "thumbnail-clean-base.png");
  try {
    const profile = path.join(workDir, "chrome-thumbnail");
    await mkdir(profile, { recursive: true });
    await runWithTimeout(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      "--virtual-time-budget=5000",
      `--screenshot=${cleanBase}`,
      appUrl,
    ], 12000);
  } catch (error) {
    console.warn(`Thumbnail clean capture failed (${error.message}); using video frame base`);
  }

  const base = existsSync(cleanBase) ? cleanBase : firstShot;
  const title = path.join(workDir, "thumbnail-title.txt");
  const caveat = path.join(workDir, "thumbnail-caveat.txt");
  const callout = path.join(workDir, "thumbnail-callout.txt");
  await writeFile(title, "NZ CREATINE\nREAL COST?");
  await writeFile(caveat, "StackScout MVP | shipping estimated");
  await writeFile(callout, "Delivered total + $ / 100g");
  await run(ffmpeg, [
    "-y",
    "-i",
    base,
    "-vf",
    [
      "scale=1920:1080",
      "drawbox=x=0:y=0:w=1920:h=1080:color=black@0.08:t=fill",
      "drawbox=x=64:y=145:w=930:h=500:color=black@0.76:t=fill",
      "drawbox=x=1140:y=710:w=600:h=150:color=#0b6b58@0.22:t=fill",
      "drawbox=x=1140:y=710:w=600:h=150:color=#0b6b58:t=8",
      drawText({ file: title, x: 108, y: 215, size: 108, color: "white" }),
      drawText({ file: caveat, x: 108, y: 555, size: 36, color: "#d8f3ea" }),
      drawText({ file: callout, x: 1185, y: 765, size: 38, color: "#0b3d34", box: true }),
    ].join(","),
    "-frames:v",
    "1",
    thumbnailPng,
  ]);
}

async function assertReachable() {
  try {
    const response = await fetch(appUrl);
    if (response.ok) return;
    console.warn(`${appUrl} returned HTTP ${response.status}; using file-based capture fallback`);
  } catch (error) {
    console.warn(`${appUrl} was not reachable from Node (${error.message}); using file-based capture fallback`);
  }
}

async function probeOutput() {
  const { stdout } = await run(ffprobe, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate:format=duration,size",
    "-of",
    "json",
    outputMp4,
  ]);
  await writeFile(path.join(outDir, "video-001-website-pov.ffprobe.json"), stdout);
  return JSON.parse(stdout);
}

async function main() {
  if (!ffmpeg) throw new Error("ffmpeg is required");
  if (!ffprobe) throw new Error("ffprobe is required");
  if (!chrome) throw new Error("Google Chrome or Chromium is required for website capture");
  await assertReachable();
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  try {
    const images = await captureSiteShots();
    const segments = [];
    for (let index = 0; index < images.length; index += 1) {
      segments.push(await createSegment(index, images[index]));
    }
    await createVideo(segments);
    await createThumbnail(images[3] ?? images[0]);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  const probe = await probeOutput();
  const duration = Number(probe.format.duration).toFixed(1);
  console.log(`Created ${path.relative(root, outputMp4)} (${duration}s, ${probe.streams[0].width}x${probe.streams[0].height})`);
  console.log(`Created ${path.relative(root, compatibilityMp4)}`);
  console.log(`Created ${path.relative(root, thumbnailPng)}`);
  console.log(`Wrote ${path.relative(root, path.join(outDir, "video-001-website-pov.ffprobe.json"))}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
