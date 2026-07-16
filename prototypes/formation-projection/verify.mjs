import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "styles.css"), "utf8");
const js = readFileSync(resolve(root, "prototype.js"), "utf8");

const required = [
  "비실행 시뮬레이션",
  "실제 훈련계획은 바뀌지 않아요",
  "PRIVATE_SELF_ONLY",
  "data-fact-hash",
  "data-real-plan-hash",
  "설명 수준",
  "검토 요청",
  "aria-live",
  "composite-visual",
];

for (const token of required) {
  if (!html.includes(token)) throw new Error(`missing HTML contract: ${token}`);
}

for (const level of ["쉽게", "짧게", "균형", "자세히", "정확히"]) {
  if (!js.includes(level)) throw new Error(`missing explanation level: ${level}`);
}

if (!css.includes("@media (prefers-reduced-motion: reduce)")) {
  throw new Error("missing reduced-motion contract");
}
if (!css.includes("min-height: 44px") || !css.includes("min-width: 44px")) {
  throw new Error("missing 44px target contract");
}
if (/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|WebSocket/u.test(js)) {
  throw new Error("prototype must have no network or persistence API");
}

console.log("PASS Formation projection static contract");
