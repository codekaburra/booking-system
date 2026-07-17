/**
 * Demo 產生器離線驗證(不需 DB / 不需 Next server)。
 *
 *   node scripts/check-demo.mjs
 *
 * demo-generator.ts 是純函式模組,但用了 `@/` alias 與 TS 型別 → 這裡直接以
 * tsx/ts-node 之類的 loader 太重,改用 Next 的 build 產物不實際;因此本腳本
 * 以 TypeScript compiler API 之外最輕的作法:用 node --experimental-strip-types
 * (Node 22.6+ 內建 TS 型別剝離)+ 手動解析 `@/` alias。
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

// `@/x` → <root>/src/x 的極簡 loader
const rootUrl = new URL("..", import.meta.url).href;
const loaderCode = `
  export async function resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) {
      const target = new URL("src/" + specifier.slice(2) + ".ts", ${JSON.stringify(rootUrl)}).href;
      return next(target, context);
    }
    return next(specifier, context);
  }
`;
register(`data:text/javascript,${encodeURIComponent(loaderCode)}`, import.meta.url);

const { generateSlots, buildDateOverrides, branches, resources, RANGE_DAYS } =
  await import(pathToFileURL(new URL("../src/lib/data/demo-generator.ts", import.meta.url).pathname).href);

let failures = 0;
let checks = 0;
const assert = (name, cond, detail = "") => {
  checks += 1;
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}\n      ${detail}`);
  }
};

const TODAY = "2026-07-16";
const slots = generateSlots(TODAY);
const branchOf = new Map(resources.map((r) => [r.id, r.branch_id]));

console.log("\n分店產生:");
assert("產生了 slots", slots.length > 0, String(slots.length));

const branchIds = new Set(slots.map((s) => s.branch_id));
assert(
  "每一間啟用分店都有 slots(逐分店產生)",
  branches.filter((b) => b.is_active).every((b) => branchIds.has(b.id)),
  [...branchIds].join(", "),
);

assert(
  "每個 slot 的 branch_id = 其 resource 的分店",
  slots.every((s) => s.branch_id === branchOf.get(s.resource_id)),
);

console.log("\ndate_overrides 示範:");
const ovs = buildDateOverrides(TODAY);
assert("兩個示範 override 都在", ovs.length === 2, JSON.stringify(ovs.map((o) => o.type)));
assert(
  "分店級 special_hours(resource_id = null)帶 branch_id",
  ovs.some((o) => o.type === "special_hours" && o.resource_id === null && o.branch_id),
);
const leave = ovs.find((o) => o.type === "closed" && o.resource_id);
assert(
  "資源級 closed 的 branch_id 與該資源的分店一致",
  leave && leave.branch_id === branchOf.get(leave.resource_id),
);

// 分店級 special_hours 只影響同分店:當天另一間分店不該被裁掉上午
const special = ovs.find((o) => o.type === "special_hours");
const otherBranchThatDay = slots.filter(
  (s) => s.starts_at.startsWith(special.date) && s.branch_id !== special.branch_id,
);
assert(
  "分店級 special_hours 不影響其他分店(當天他店仍有 13:00 前的 slot)",
  otherBranchThatDay.length === 0 ||
    otherBranchThatDay.some((s) => Number(s.starts_at.slice(11, 13)) < 13),
  `他店當天 ${otherBranchThatDay.length} 筆,最早 ${otherBranchThatDay[0]?.starts_at}`,
);

console.log("\n佔用率梯度:");
const dayIndex = (s) => {
  const d = new Date(s.starts_at.slice(0, 10) + "T00:00:00+08:00");
  const t = new Date(TODAY + "T00:00:00+08:00");
  return Math.round((d - t) / 86400000);
};
const fullRate = (lo, hi) => {
  const band = slots.filter((s) => {
    const d = dayIndex(s);
    return d >= lo && d <= hi;
  });
  if (band.length === 0) return null;
  return band.filter((s) => s.booked_count >= s.capacity).length / band.length;
};
const near = fullRate(0, 6);
const mid = fullRate(7, 20);
const far = fullRate(21, RANGE_DAYS);
console.log(
  `      0–6d=${(near * 100).toFixed(0)}% 7–20d=${(mid * 100).toFixed(0)}% 21+d=${(far * 100).toFixed(0)}% 全滿`,
);
assert("0–6 天約 90% 全滿(±15%)", near > 0.75 && near <= 1, String(near));
assert("7–20 天約 70% 全滿(±15%)", mid > 0.55 && mid < 0.9, String(mid));
assert("梯度遞減:近 > 中 > 遠", near > mid && mid > far, `${near} / ${mid} / ${far}`);

console.log("\n決定性:");
const again = generateSlots(TODAY);
assert(
  "同一個 today 連跑兩次結果完全相同",
  JSON.stringify(slots) === JSON.stringify(again),
);

console.log(`\n${failures === 0 ? "全部通過" : "有失敗"}:${checks - failures}/${checks}\n`);
process.exit(failures === 0 ? 0 : 1);
