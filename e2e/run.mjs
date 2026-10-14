// Runs the end-to-end suites against a production build with mocked Google,
// Claude, weather and push services. Usage:
//
//   DATABASE_URL=postgres://… npm run build      # once (runs the migrations too)
//   DATABASE_URL=postgres://… npm run e2e         # all suites
//   DATABASE_URL=postgres://… npm run e2e -- m5 m9
//
// The suites wipe the database they run against – never point this at real data.
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HERE = fileURLToPath(new URL(".", import.meta.url));
const ALL = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12", "m13", "m14", "m15", "m17", "m18", "m19", "m20", "m21"];
const suites = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (a throwaway test database – the suites wipe it).");
  process.exit(2);
}

// Self-signed certificate for the fake push service (web-push only talks https).
const certs = `${HERE}.tmp/certs`;
if (!existsSync(`${certs}/cert.pem`)) {
  mkdirSync(certs, { recursive: true });
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "30", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost", "-keyout", `${certs}/key.pem`, "-out", `${certs}/cert.pem`], { stdio: "ignore" });
}

const vapid = webpush.generateVAPIDKeys();
const shared = {
  DATABASE_URL: process.env.DATABASE_URL,
  TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
};
const serverEnv = {
  ...process.env,
  ...shared,
  NODE_ENV: "production",
  PORT: "3000",
  APP_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "e2e-client",
  GOOGLE_CLIENT_SECRET: "e2e-secret",
  ALLOWED_EMAILS: "jonas@example.com,partnerin@example.com,eve@example.com",
  CRON_SECRET: "test-cron-secret-123456",
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "mailto:test@example.com",
  NODE_EXTRA_CA_CERTS: `${certs}/cert.pem`,
  ENABLE_DEV_TOOLS: "1",
  GOOGLE_API_BASE_URL: "http://localhost:4010",
  GOOGLE_OAUTH_TOKEN_URL: "http://localhost:4010/token",
  ANTHROPIC_API_KEY: "e2e-key",
  ANTHROPIC_BASE_URL: "http://localhost:4030",
  WEATHER_API_BASE_URL: "http://localhost:4050",
  ALLOW_PRIVATE_EVENT_URLS: "1",
  TIKTOK_OEMBED_URL: "http://localhost:4060/oembed",
};
delete serverEnv.VERCEL_ENV;
delete serverEnv.BLOB_READ_WRITE_TOKEN;

// A server left over from an earlier run would have other keys – refuse to test against it.
const portTaken = await fetch("http://localhost:3000/login", { redirect: "manual" }).then(() => true, () => false);
if (portTaken) {
  console.error("Port 3000 is already in use – stop the other server first.");
  process.exit(2);
}

// Own process group, so stopping it also stops next-server (npx only starts it).
const server = spawn("npx", ["next", "start", "-p", "3000"], { cwd: ROOT, env: serverEnv, stdio: ["ignore", "pipe", "pipe"], detached: true });
const stopServer = () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
};
process.on("SIGINT", () => {
  stopServer();
  process.exit(130);
});
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch("http://localhost:3000/login", { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start:\n${serverLog}`);
}

function runSuite(name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [`${HERE}${name}.mjs`], {
      cwd: HERE,
      env: { ...process.env, ...shared },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (out += chunk));
    const timer = setTimeout(() => child.kill("SIGKILL"), 6 * 60_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ name, ok: code === 0, out });
    });
  });
}

let failed = 0;
try {
  await waitForServer();
  for (const name of suites) {
    const started = Date.now();
    const result = await runSuite(name);
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`${result.ok ? "✓" : "✗"} ${name} (${seconds}s)`);
    if (!result.ok) {
      failed++;
      console.log(result.out.split("\n").map((line) => `    ${line}`).join("\n"));
    }
  }
} finally {
  stopServer();
}
if (failed) console.log(`\nServer log (tail):\n${serverLog.split("\n").slice(-40).join("\n")}`);
console.log(failed ? `\n${failed} of ${suites.length} suites failed` : `\nAll ${suites.length} suites passed`);
process.exit(failed ? 1 : 0);
