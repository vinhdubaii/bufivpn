// Script sinh file src/assets/world-map-paths.js
// Chạy 1 lần lúc dev, KHÔNG chạy lúc build app (không phải runtime dependency).
// Dữ liệu: world-atlas (Natural Earth 110m, public domain / ISC) qua topojson-client.
//
// Dùng d3-geo (geoEquirectangular + geoPath) thay vì tự chiếu tay, vì d3-geo
// tự động CẮT (clip) các polygon bị đường đổi ngày ±180° kinh độ cắt qua
// (Nga, Fiji, quần đảo Aleutian...) — nếu tự nối điểm thủ công sẽ bị vệt kẻ
// ngang chạy xuyên cả bản đồ.
//
// Scale/translate được chọn để khớp CHÍNH XÁC với công thức project() dùng
// trong main.js: x=(lng+180)/360*1000, y=(90-lat)/180*500  (viewBox 0 0 1000 500)

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import * as topojson from "topojson-client";
import { geoEquirectangular, geoPath } from "d3-geo";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const topoPath = path.join(__dirname, "../node_modules/world-atlas/countries-110m.json");
const topology = JSON.parse(readFileSync(topoPath, "utf-8"));
const geo = topojson.feature(topology, topology.objects.countries);

const W = 1000, H = 500;
const projection = geoEquirectangular()
  .scale(W / (2 * Math.PI))
  .translate([W / 2, H / 2]);
const pathGen = geoPath(projection);

let out = "";
let count = 0;
for (const f of geo.features) {
  if (!f.geometry) continue;
  const d = pathGen(f);
  if (!d) continue;
  const name = (f.properties && (f.properties.name || f.properties.NAME)) || "";
  const safeName = name.replace(/"/g, "'");
  out += `<path class="country" data-name="${safeName}" d="${d}"/>`;
  count++;
}

const jsFile =
  `// File này được sinh tự động bởi scripts/gen-map.mjs — KHÔNG sửa tay.\n` +
  `// Nguồn dữ liệu: world-atlas (Natural Earth 110m), chiếu equirectangular viewBox 0 0 1000 500,\n` +
  `// dùng d3-geo để tự clip các nước bị cắt bởi đường đổi ngày ±180°.\n` +
  `window.WORLD_MAP_SVG_PATHS = ${JSON.stringify(out)};\n`;

const outPath = path.join(__dirname, "../src/assets/world-map-paths.js");
writeFileSync(outPath, jsFile, "utf-8");

console.log(`Đã sinh ${count} quốc gia -> ${outPath} (${(jsFile.length / 1024).toFixed(1)} KB)`);
