import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";

const root = process.cwd();
const localEnvPath = path.join(root, ".env.local");
if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);

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
if (existsSync(publicSource)) cpSync(publicSource, path.join(standaloneRoot, "public"), { recursive: true, force: true });
if (existsSync(staticSource)) cpSync(staticSource, path.join(standaloneRoot, ".next", "static"), { recursive: true, force: true });

const configuredDataDirectory = process.env.STUDYPAL_DATA_DIR?.trim();
const dataDirectory = configuredDataDirectory
  ? (path.isAbsolute(configuredDataDirectory) ? configuredDataDirectory : path.resolve(root, configuredDataDirectory))
  : path.join(root, ".studypal-data");

const environment = {
  ...process.env,
  HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
  PORT: process.env.PORT || "3000",
  NEXT_TELEMETRY_DISABLED: "1",
  STUDYPAL_DATA_DIR: dataDirectory,
};
const child = spawn(process.execPath, [serverPath], { cwd: standaloneRoot, env: environment, stdio: "inherit" });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
