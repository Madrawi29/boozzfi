const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const SEED_FILE = path.join(DATA_DIR, "seed.json");
const STORE_FILE = path.join(DATA_DIR, "store.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_FILE);
  } catch {
    const seed = await fs.readFile(SEED_FILE, "utf8");
    await fs.writeFile(STORE_FILE, seed);
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeStore(store) {
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2));
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function notFound(res) {
  sendJson(res, 404, {
    error: "not_found",
    message: "Route not found"
  });
}

function badRequest(res, message, details = {}) {
  sendJson(res, 400, {
    error: "bad_request",
    message,
    details
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function shortenHash(value) {
  if (!value || !value.startsWith("0x") || value.length < 14) {
    return value || "";
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function toCsv(rows) {
  const headers = ["type", "asset", "amount", "status", "feeUsd", "txHash", "createdAt"];
  const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(","))
  ];
  return lines.join("\n");
}

function filterActivities(activities, url) {
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");

  return activities.filter((activity) => {
    const matchesType = !type || activity.type.toLowerCase() === type.toLowerCase();
    const matchesStatus = !status || activity.status.toLowerCase() === status.toLowerCase();
    const haystack = `${activity.type} ${activity.asset} ${activity.status} ${activity.txHash}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });
}

function createDashboardPayload(store) {
  return {
    wallet: {
      ...store.wallet,
      shortAddress: shortenHash(store.wallet.address)
    },
    network: store.network,
    portfolio: store.portfolio,
    tokens: store.tokens,
    chainDistribution: store.chainDistribution,
    workflow: store.workflow,
    liquidityPool: store.liquidityPool,
    positions: store.positions,
    risk: store.risk,
    activities: store.activities,
    settings: store.settings,
    formatted: {
      totalValueUsd: `$${money(store.portfolio.totalValueUsd)}`,
      availableLiquidityUsd: `$${money(store.portfolio.availableLiquidityUsd)}`,
      gasFeeUsd: `$${Number(store.portfolio.gasFeeUsd).toFixed(3)}`,
      liquidityReserveUsd: `$${money(store.liquidityPool.reserveUsd)}`,
      chainTotalCompact: `$${Math.round(store.portfolio.totalValueUsd / 1000)}K`
    }
  };
}

function validateActivity(input) {
  const errors = {};
  if (!input.type) errors.type = "Transaction type is required";
  if (!input.asset) errors.asset = "Asset or route description is required";
  if (!Number.isFinite(Number(input.amount))) errors.amount = "Amount must be numeric";
  if (!input.status) errors.status = "Status is required";
  return errors;
}

function validatePreview(input) {
  const errors = {};
  if (!["send", "swap", "bridge", "stake", "vault"].includes(String(input.type || "").toLowerCase())) {
    errors.type = "Type must be one of send, swap, bridge, stake, or vault";
  }
  if (!input.tokenIn) errors.tokenIn = "Input token is required";
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) <= 0) {
    errors.amount = "Amount must be greater than zero";
  }
  if (input.type === "send" && !/^0x[a-fA-F0-9]{40}$/.test(String(input.recipient || ""))) {
    errors.recipient = "Recipient must be a valid EVM address";
  }
  return errors;
}

function buildTransactionPreview(input, store) {
  const type = String(input.type).toLowerCase();
  const amount = Number(input.amount);
  const feeUsd = type === "bridge" ? 1.42 : type === "swap" ? 0.02 : 0.018;
  const tokenOut = input.tokenOut || input.tokenIn;
  const finalitySeconds = type === "bridge" ? 45 : store.portfolio.finalitySeconds;

  return {
    id: `preview_${randomUUID()}`,
    type,
    network: store.network.name,
    amount,
    tokenIn: input.tokenIn,
    tokenOut,
    recipient: input.recipient || null,
    estimatedFeeUsd: feeUsd,
    estimatedFinalitySeconds: finalitySeconds,
    route: type === "bridge" ? `${input.sourceChain || "Source testnet"} -> Arc Testnet` : "Arc Testnet",
    warnings: [
      "You are using testnet. Tokens have no economic value.",
      ...(amount > 10000 ? ["Large testnet transaction. Confirm recipient and route before signing."] : [])
    ],
    createdAt: new Date().toISOString()
  };
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    sendText(res, 204, "");
    return;
  }

  const store = await readStore();
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      product: "B00ZZ FI",
      network: store.network.name,
      status: store.network.status,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/dashboard") {
    sendJson(res, 200, createDashboardPayload(store));
    return;
  }

  if (req.method === "GET" && pathname === "/api/tokens") {
    sendJson(res, 200, { tokens: store.tokens });
    return;
  }

  if (req.method === "GET" && pathname === "/api/chains") {
    sendJson(res, 200, {
      active: store.network,
      distribution: store.chainDistribution
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/activity/export.csv") {
    const rows = filterActivities(store.activities, url);
    sendText(res, 200, toCsv(rows), "text/csv; charset=utf-8");
    return;
  }

  if (req.method === "GET" && pathname === "/api/activity") {
    sendJson(res, 200, { activities: filterActivities(store.activities, url) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/activity") {
    const input = await parseBody(req);
    const errors = validateActivity(input);
    if (Object.keys(errors).length) {
      badRequest(res, "Activity payload is invalid", errors);
      return;
    }

    const activity = {
      id: `tx_${randomUUID()}`,
      walletAddress: input.walletAddress || store.wallet.address,
      type: input.type,
      asset: input.asset,
      amount: Number(input.amount),
      status: input.status,
      feeUsd: Number(input.feeUsd || 0),
      txHash: input.txHash || `0x${randomUUID().replaceAll("-", "")}`,
      createdAt: new Date().toISOString()
    };

    store.activities.unshift(activity);
    store.portfolio.pendingTransactions = store.activities.filter((item) => item.status === "Pending").length;
    await writeStore(store);
    sendJson(res, 201, { activity });
    return;
  }

  if (req.method === "POST" && pathname === "/api/transactions/preview") {
    const input = await parseBody(req);
    const errors = validatePreview(input);
    if (Object.keys(errors).length) {
      badRequest(res, "Transaction preview payload is invalid", errors);
      return;
    }

    sendJson(res, 200, { preview: buildTransactionPreview(input, store) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/workflows") {
    const input = await parseBody(req);
    const workflow = {
      id: `workflow_${randomUUID()}`,
      walletAddress: input.walletAddress || store.wallet.address,
      name: input.name || "Untitled workflow",
      templateType: input.templateType || "send",
      status: "not_started",
      createdAt: new Date().toISOString(),
      steps: Array.isArray(input.steps) ? input.steps : []
    };
    sendJson(res, 201, { workflow });
    return;
  }

  if (req.method === "PATCH" && pathname === "/api/settings") {
    const input = await parseBody(req);
    store.settings = {
      ...store.settings,
      ...input
    };
    await writeStore(store);
    sendJson(res, 200, { settings: store.settings });
    return;
  }

  notFound(res);
}

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    notFound(res);
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      notFound(res);
      return;
    }

    const body = await fs.readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": body.byteLength
    });
    res.end(body);
  } catch {
    notFound(res);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, {
      error: "internal_server_error",
      message: error.message
    });
  }
});

ensureStore()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`B00ZZ FI backend running at http://127.0.0.1:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
