import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "assets", "app-icon.png");
const iconset = path.join(root, "assets", "AppIcon.iconset");
const pngDirectory = path.join(root, "assets", "icon-png");

rmSync(iconset, { force: true, recursive: true });
rmSync(pngDirectory, { force: true, recursive: true });
mkdirSync(iconset, { recursive: true });
mkdirSync(pngDirectory, { recursive: true });

const macSizes = [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"],
];

for (const [size, name] of macSizes) {
  execFileSync("sips", ["-z", String(size), String(size), source, "--out", path.join(iconset, name)], {
    stdio: "ignore",
  });
}
execFileSync("iconutil", ["-c", "icns", iconset, "-o", path.join(root, "assets", "app-icon.icns")]);

const windowsSizes = [16, 24, 32, 48, 64, 128, 256];
const images = windowsSizes.map((size) => {
  const output = path.join(pngDirectory, `${size}.png`);
  execFileSync("sips", ["-z", String(size), String(size), source, "--out", output], {
    stdio: "ignore",
  });
  return { size, data: readFileSync(output) };
});

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

let offset = header.length + images.length * 16;
const entries = images.map(({ size, data }) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(data.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += data.length;
  return entry;
});

writeFileSync(
  path.join(root, "assets", "app-icon.ico"),
  Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]),
);

rmSync(iconset, { force: true, recursive: true });
rmSync(pngDirectory, { force: true, recursive: true });
