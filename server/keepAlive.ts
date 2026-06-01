import http from "http";
import https from "https";
import { pool } from "./db";

const DEFAULT_INTERVAL_MINUTES = 5;
const DEFAULT_ENDPOINT = "/ping";

type KeepAliveOptions = {
  serviceUrl?: string;
  endpoint?: string;
  intervalMinutes?: number;
};

export function startProductionKeepAlive(options: KeepAliveOptions = {}) {
  const intervalMinutes = options.intervalMinutes || DEFAULT_INTERVAL_MINUTES;
  const endpoint = ensureLeadingSlash(options.endpoint || DEFAULT_ENDPOINT);
  const serviceUrl = options.serviceUrl ? stripTrailingSlash(options.serviceUrl) : "";

  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    log("keep-alive disabled: PING_INTERVAL_MINUTES must be a positive number", "keep-alive");
    return;
  }

  async function runHeartbeat() {
    await Promise.all([pingSupabase(), pingService(serviceUrl, endpoint)]);
  }

  log(`started; interval=${intervalMinutes}m`, "keep-alive");
  void runHeartbeat();
  setInterval(runHeartbeat, intervalMinutes * 60 * 1000);
}

async function pingSupabase() {
  try {
    await pool.query("select 1");
    log("Supabase database ping successful", "keep-alive");
  } catch (error) {
    log(`Supabase database ping failed: ${(error as Error).message}`, "keep-alive");
  }
}

async function pingService(serviceUrl: string, endpoint: string) {
  if (!serviceUrl) {
    log("web ping skipped: SERVICE_URL is not set", "keep-alive");
    return;
  }

  try {
    const targetUrl = new URL(`${serviceUrl}${endpoint}`);
    const statusCode = await request(targetUrl);
    if (statusCode >= 200 && statusCode < 300) {
      log(`web ping successful (${statusCode})`, "keep-alive");
      return;
    }
    log(`web ping returned ${statusCode}`, "keep-alive");
  } catch (error) {
    log(`web ping failed: ${(error as Error).message}`, "keep-alive");
  }
}

function request(url: URL): Promise<number> {
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
        res.resume();
        res.on("end", () => resolve(res.statusCode || 0));
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("request timed out after 10 seconds"));
    });
    req.on("error", reject);
    req.end();
  });
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function ensureLeadingSlash(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

function log(message: string, source = "keep-alive") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}
