const sharp = require("sharp");
const path = require("path");

const svg = [
  "<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 512 512'>",
  "  <rect width='512' height='512' rx='96' fill='#09090b'/>",
  "  <text x='256' y='310' font-family='Arial,Helvetica,sans-serif' font-weight='700'",
  "        font-size='240' fill='#e4e4e7' text-anchor='middle'>A</text>",
  "</svg>",
].join("\n");

const buf = Buffer.from(svg);
const out = path.join(__dirname, "..", "public", "icons");

Promise.all([
  sharp(buf).resize(192, 192).png().toFile(path.join(out, "icon-192.png")),
  sharp(buf).resize(512, 512).png().toFile(path.join(out, "icon-512.png")),
  sharp(buf).resize(180, 180).png().toFile(path.join(out, "apple-touch-icon.png")),
]).then(() => console.log("Icons generated"));
