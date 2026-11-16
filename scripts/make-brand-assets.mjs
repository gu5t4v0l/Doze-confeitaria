// Gera as versões otimizadas do logo a partir de sources/*.jpg.
// Uso: npm run brand:assets
import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";

const SRC = "sources/828524974_18112248100958568_125804800357100219_n.jpg";
const SAGE = { r: 185, g: 196, b: 160 }; // --sage do site (#b9c4a0)

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

// Cor do fundo = média dos cantos (o fundo tem um leve degradê).
const corner = (x, y) => [0, 1, 2].map((c) => data[(y * W + x) * 3 + c]);
const corners = [corner(2, 2), corner(W - 3, 2), corner(2, H - 3), corner(W - 3, H - 3)];
const bg = [0, 1, 2].map((c) => corners.reduce((s, p) => s + p[c], 0) / 4);
const dist = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);

// Flood fill a partir das bordas: só pixels "parecidos com o fundo" e conectados a ele.
const TOL = 34;
const outside = new Uint8Array(W * H);
const stack = [];
const push = (x, y) => {
  const p = y * W + x;
  if (outside[p] || dist(p * 3) > TOL) return;
  outside[p] = 1;
  stack.push(p);
};
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (stack.length) {
  const p = stack.pop();
  const x = p % W, y = (p - x) / W;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

const alpha = Buffer.alloc(W * H);
for (let p = 0; p < W * H; p++) alpha[p] = outside[p] ? 0 : 255;
// Suaviza a borda do recorte (anti-serrilhado) e come 1px do halo claro.
const softAlpha = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
  .blur(1.1)
  .linear(1.6, -80)
  .toColourspace("b-w")
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data: d, info: i }) => { if (i.channels !== 1) throw new Error("alpha canais=" + i.channels); return d; });

const rgba = Buffer.alloc(W * H * 4);
for (let p = 0; p < W * H; p++) {
  rgba[p * 4] = data[p * 3];
  rgba[p * 4 + 1] = data[p * 3 + 1];
  rgba[p * 4 + 2] = data[p * 3 + 2];
  rgba[p * 4 + 3] = softAlpha[p];
}
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let p = 0; p < W * H; p++) {
  if (softAlpha[p] > 8) {
    const x = p % W, y = (p - x) / W;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
const cut = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
  .png()
  .toBuffer();
const meta = await sharp(cut).metadata();
const side = Math.max(meta.width, meta.height);
const square = await sharp(cut)
  .extend({
    top: Math.floor((side - meta.height) / 2),
    bottom: Math.ceil((side - meta.height) / 2),
    left: Math.floor((side - meta.width) / 2),
    right: Math.ceil((side - meta.width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

await mkdir("public", { recursive: true });
await sharp(square).resize(512, 512).webp({ quality: 88, alphaQuality: 95 }).toFile("public/logo.webp");
await sharp(square).resize(512, 512).png({ compressionLevel: 9 }).toFile("src/app/icon.png");
// apple-icon: sem transparência, selo sobre o fundo sálvia, com respiro.
const apple = await sharp(square).resize(150, 150).toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 3, background: SAGE } })
  .composite([{ input: apple, gravity: "center" }])
  .png()
  .toFile("src/app/apple-icon.png");
await sharp(square).resize(420, 420).png({ compressionLevel: 9 }).toFile("public/logo-og.png");
await rm("src/app/icon.svg", { force: true });
console.log("Logo gerado: public/logo.webp, public/logo-og.png, src/app/icon.png, src/app/apple-icon.png");
