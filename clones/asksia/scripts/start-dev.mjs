import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";

const root = process.cwd();
const localEnvPath = path.join(root, ".env.local");
if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);

const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const environment = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  STUDYPAL_TRANSCRIBE_SCRIPT: process.env.STUDYPAL_TRANSCRIBE_SCRIPT
    || path.join(root, "scripts", "transcribe-audio.py"),
};
const child = spawn(
  process.execPath,
  [
    nextCli,
    "dev",
    "--hostname",
    process.env.STUDYPAL_DEV_HOSTNAME?.trim() || "127.0.0.1",
    ...process.argv.slice(2),
  ],
  { cwd: root, env: environment, stdio: "inherit", windowsHide: true },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
