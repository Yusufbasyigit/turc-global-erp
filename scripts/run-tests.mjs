// Test runner. Finds every `*.test.ts` under src/, runs it with `tsx` in a
// subprocess, and aggregates pass/fail counts. Each test file is a standalone
// script that uses the local `assertEq` / `section` helpers and prints a final
// "N passed, M failed" line; we parse that line per file.
//
// Run with: npm test
// Filter:   npm test -- ledger     (substring match against file path)

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const SRC = join(ROOT, "src");

const filter = process.argv.slice(2).join(" ").trim();

function findTestFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...findTestFiles(full));
    } else if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

const files = findTestFiles(SRC)
  .filter((f) => (filter ? f.includes(filter) : true))
  .sort();

if (files.length === 0) {
  console.error(`No test files found${filter ? ` matching "${filter}"` : ""}.`);
  process.exit(1);
}

let totalPassed = 0;
let totalFailed = 0;
let suiteFailed = 0;
const failedSuites = [];

const SUMMARY_RE = /^(\d+) passed, (\d+) failed$/m;

for (const file of files) {
  const rel = relative(ROOT, file);
  process.stdout.write(`\n──── ${rel}\n`);
  const result = spawnSync("npx", ["tsx", file], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  process.stdout.write(stdout);
  if (stderr.trim()) process.stderr.write(stderr);

  const match = SUMMARY_RE.exec(stdout);
  if (match) {
    totalPassed += Number(match[1]);
    totalFailed += Number(match[2]);
    if (Number(match[2]) > 0 || result.status !== 0) {
      suiteFailed += 1;
      failedSuites.push(rel);
    }
  } else {
    suiteFailed += 1;
    failedSuites.push(rel);
    console.error(`  ! could not parse summary line for ${rel}`);
  }
}

console.log("\n────");
console.log(
  `${files.length} suite${files.length === 1 ? "" : "s"}, ${totalPassed} passed, ${totalFailed} failed`,
);
if (failedSuites.length > 0) {
  console.log("Failed suites:");
  for (const s of failedSuites) console.log(`  - ${s}`);
}
process.exit(suiteFailed === 0 ? 0 : 1);
