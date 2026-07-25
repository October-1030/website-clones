import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "scripting", "sidePanel", "storage"]);
assert.deepEqual([...manifest.host_permissions].sort(), ["http://127.0.0.1:3000/*", "http://localhost:3000/*"]);
assert.equal(JSON.stringify(manifest).includes("<all_urls>"), false);
assert.equal(manifest.permissions.includes("tabs"), false);

for (const name of ["service-worker.js", "sidepanel.js"]) {
  const file = path.join(root, name);
  const checked = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  assert.equal(checked.status, 0, checked.stderr);
}

const worker = readFileSync(path.join(root, "service-worker.js"), "utf8");
assert.match(worker, /chrome\.storage\.local/);
assert.match(worker, /active: true, currentWindow: true/);
assert.match(worker, /form,input,textarea,select,button/);
assert.match(worker, /Authorization: `Bearer \$\{settings\.token\}`/);
assert.doesNotMatch(worker, /console\.(?:log|info|debug)\s*\(/);
assert.doesNotMatch(worker, /chrome\.history|chrome\.cookies|chrome\.webRequest/);

console.log("PASS StudyPal extension manifest and source checks");
