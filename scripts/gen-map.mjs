// Script sinh file src/assets/world-map-paths.js
// Chạy 1 lần lúc dev, KHÔNG chạy lúc build app (không phải runtime dependency).
// Dữ liệu: world-atlas (Natural Earth 110m, public domain / ISC) qua topojson-client.
// Phép chiếu: equirectangular thủ công, khớp đúng công thức project() đang dùng trong main.js
//   x = (lng + 180) / 360 * 1000
//   y = (90 - lat) / 180 * 500
// => viewBox chuẩn "0 0 1000 500"

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import * as topojson from "topojson-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const topoPath = path.join(__dirname, "../node_modules/world-atlas/countries-110m.json");
const topology = JSON.parse(readFileSync(topoPath, "utf-8"));
const geo = topojson.feature(topology, topology.objects.countries);

const W = 1000, H = 500;
function project([lng, lat]) {
  const x = ((lng + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return [x, y];
}

function ringToPath(ring) {
  return ring
    .map((coord, i) => {
      const [x, y] = project(coord);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join("") + "Z";
}

function geometryToD(geometry) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringToPath).join(" ");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((poly) => poly.map(ringToPath).join(" "))
      .join(" ");
  }
  return "";
}

let out = "";
let count = 0;
for (const f of geo.features) {
  if (!f.geometry) continue;
  const d = geometryToD(f.geometry);
  if (!d) continue;
  const name = (f.properties && (f.properties.name || f.properties.NAME)) || "";
  const safeName = name.replace(/"/g, "'");
  out += `<path class="country" data-name="${safeName}" d="${d}"/>`;
  count++;
}

const jsFile =
  `// File này được sinh tự động bởi scripts/gen-map.mjs — KHÔNG sửa tay.\n` +
  `// Nguồn dữ liệu: world-atlas (Natural Earth 110m), chiếu equirectangular viewBox 0 0 1000 500.\n` +
  `window.WORLD_MAP_SVG_PATHS = ${JSON.stringify(out)};\n`;

const outPath = path.join(__dirname, "../src/assets/world-map-paths.js");
writeFileSync(outPath, jsFile, "utf-8");

console.log(`Đã sinh ${count} quốc gia -> ${outPath} (${(jsFile.length / 1024).toFixed(1)} KB)`);
