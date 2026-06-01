import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import pg from "pg";

/**
 * Keep-Alive Script for Render Free Tier
 *
 * Pings the /ping endpoint to prevent the service from idling.
 *
 * Usage:
 *   npm run keep-alive
 *   npm run keep-alive -- --once
 *
 * Optional env vars:
 *   SERVICE_URL=https://your-service.onrender.com
 *   RENDER_SERVICE_URL=https://your-service.onrender.com
 *   DATABASE_URL=postgresql://postgres...
 *   KEEP_ALIVE_ENDPOINT=/ping
 *   PING_INTERVAL_MINUTES=5
 */

loadDotEnv();

const SERVICE_URL = stripTrailingSlash(
  process.env.SERVICE_URL ||
    process.env.RENDER_SERVICE_URL ||
    "https://workflow-fhrw.onrender.com",
);
const ENDPOINT = ensureLeadingSlash(process.env.KEEP_ALIVE_ENDPOINT || "/ping");
const INTERVAL_MINUTES = Number.parseInt(process.env.PING_INTERVAL_MINUTES || "5", 10);
const RUN_ONCE = process.argv.includes("--once");
const DATABASE_URL = process.env.DATABASE_URL;
const { Pool } = pg;
const dbPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

if (!Number.isFinite(INTERVAL_MINUTES) || INTERVAL_MINUTES <= 0) {
  throw new Error("PING_INTERVAL_MINUTES must be a positive number");
}

const targetUrl = new URL(`${SERVICE_URL}${ENDPOINT}`);

async function pingAll() {
  const webOk = await pingWebService();
  const dbOk = await pingDatabase();
  return webOk && dbOk;
}

async function pingWebService() {
  const timestamp = new Date().toISOString();

  try {
    const response = await request(targetUrl);
    const body = response.body;

    let parsedBody = null;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      // Plain text responses are fine as long as the status is healthy.
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log(`OK [${timestamp}] Web ping successful (${response.statusCode})`);
      if (parsedBody) {
        console.log(`   Response: ${JSON.stringify(parsedBody)}`);
      }
      return true;
    }

    console.warn(`WARN [${timestamp}] Web ping returned ${response.statusCode}`);
    console.warn(`   Body: ${body.slice(0, 200)}`);
    return false;
  } catch (error) {
    console.error(`ERR [${timestamp}] Web ping failed: ${error.message}`);
    return false;
  }
}

async function pingDatabase() {
  const timestamp = new Date().toISOString();

  if (!dbPool) {
    console.log(`SKIP [${timestamp}] Database ping skipped: DATABASE_URL is not set`);
    return true;
  }

  try {
    await dbPool.query("select 1");
    console.log(`OK [${timestamp}] Supabase database ping successful`);
    return true;
  } catch (error) {
    console.error(`ERR [${timestamp}] Supabase database ping failed: ${error.message}`);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    return false;
  }
}

function request(url) {
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        timeout: 10_000,
      },
      (res) => {
        let body = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            body,
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("request timed out after 10 seconds"));
    });
    req.on("error", reject);
    req.end();
  });
}

function loadDotEnv() {
  if (!existsSync(".env")) {
    return;
  }

  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(value) {
  return value.startsWith("/") ? value : `/${value}`;
}

console.log(`Keep-alive target: ${targetUrl.toString()}`);

if (RUN_ONCE) {
  const ok = await pingAll();
  await closeDatabasePool();
  process.exit(ok ? 0 : 1);
}

console.log(`Interval: ${INTERVAL_MINUTES} minute(s)`);
console.log("First ping starts now.\n");

await pingAll();
setInterval(pingAll, INTERVAL_MINUTES * 60 * 1000);

async function closeDatabasePool() {
  if (dbPool) {
    await dbPool.end();
  }
}

process.on("SIGINT", () => {
  console.log("\nKeep-alive stopped");
  closeDatabasePool().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("\nKeep-alive stopped");
  closeDatabasePool().finally(() => process.exit(0));
});
