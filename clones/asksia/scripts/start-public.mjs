import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const configuredMode = process.env.STUDYPAL_DEPLOYMENT_MODE?.trim().toLowerCase();
if (configuredMode && configuredMode !== "public") {
  console.error("npm start is reserved for public deployments. Use npm run start:local for loopback-only local mode.");
  process.exit(1);
}

const candidates = [
  path.join(root, ".next", "standalone", "server.js"),
  path.join(root, ".next", "standalone", "clones", "asksia", "server.js"),
];
const serverPath = candidates.find((candidate) => existsSync(candidate));
if (!serverPath) {
  console.error("StudyPal AI production build is missing. Run npm run build first.");
  process.exit(1);
}

const standaloneRoot = path.dirname(serverPath);
const publicSource = path.join(root, "public");
const staticSource = path.join(root, ".next", "static");
const transcribeScriptSource = path.join(root, "scripts", "transcribe-audio.py");
if (existsSync(publicSource)) cpSync(publicSource, path.join(standaloneRoot, "public"), { recursive: true, force: true });
if (existsSync(staticSource)) cpSync(staticSource, path.join(standaloneRoot, ".next", "static"), { recursive: true, force: true });
if (existsSync(transcribeScriptSource)) cpSync(transcribeScriptSource, path.join(standaloneRoot, "scripts", "transcribe-audio.py"), { force: true });

const environment = {
  ...process.env,
  HOSTNAME: process.env.HOSTNAME?.trim() || "0.0.0.0",
  PORT: process.env.PORT?.trim() || "3000",
  NEXT_TELEMETRY_DISABLED: "1",
  STUDYPAL_DEPLOYMENT_MODE: "public",
  STUDYPAL_TRANSCRIBE_SCRIPT: process.env.STUDYPAL_TRANSCRIBE_SCRIPT
    || path.join(standaloneRoot, "scripts", "transcribe-audio.py"),
};
const child = spawn(process.execPath, [serverPath], {
  cwd: standaloneRoot,
  env: environment,
  stdio: "inherit",
  windowsHide: true,
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
