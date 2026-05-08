import { client } from "@/src/db";

let migrationPromise: Promise<void> | null = null;

export function ensureDatabase() {
  migrationPromise ??= migrate();
  return migrationPromise;
}

async function migrate() {
  await client.batch([
    "CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)",
    "CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user (email)",
    "CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY NOT NULL, expiresAt INTEGER NOT NULL, token TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE)",
    "CREATE UNIQUE INDEX IF NOT EXISTS session_token_unique ON session (token)",
    "CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS wallets (id TEXT PRIMARY KEY NOT NULL, address TEXT NOT NULL, label TEXT NOT NULL, lastConnectedAt INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS chains (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, chainId INTEGER NOT NULL, rpcLatencyMs INTEGER NOT NULL, status TEXT NOT NULL, isTestnet INTEGER NOT NULL, explorerUrl TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS portfolio_snapshots (id TEXT PRIMARY KEY NOT NULL, walletAddress TEXT NOT NULL, totalValueUsd REAL NOT NULL, simulatedYieldPercent REAL NOT NULL, trackedChains INTEGER NOT NULL, availableLiquidityUsd REAL NOT NULL, liquidityDepthPercent INTEGER NOT NULL, pendingTransactions INTEGER NOT NULL, pendingStatus TEXT NOT NULL, statusPollSeconds INTEGER NOT NULL, gasFeeUsd REAL NOT NULL, finalitySeconds REAL NOT NULL, gasTrend TEXT NOT NULL, updatedAt INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS tokens (id TEXT PRIMARY KEY NOT NULL, chainId INTEGER NOT NULL, symbol TEXT NOT NULL, name TEXT NOT NULL, contractAddress TEXT NOT NULL, decimals INTEGER NOT NULL, balance REAL NOT NULL, priceUsd REAL NOT NULL, valueUsd REAL NOT NULL, label TEXT NOT NULL, badge TEXT NOT NULL, riskLevel TEXT NOT NULL, kind TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS chain_distribution (id TEXT PRIMARY KEY NOT NULL, chain TEXT NOT NULL, percent INTEGER NOT NULL, valueUsd REAL NOT NULL)",
    "CREATE TABLE IF NOT EXISTS workflows (id TEXT PRIMARY KEY NOT NULL, walletAddress TEXT NOT NULL, name TEXT NOT NULL, templateType TEXT NOT NULL, status TEXT NOT NULL, mode TEXT NOT NULL, createdAt INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS workflow_steps (id TEXT PRIMARY KEY NOT NULL, workflowId TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE, \"order\" INTEGER NOT NULL, stepType TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, detail TEXT NOT NULL, txHash TEXT)",
    "CREATE TABLE IF NOT EXISTS liquidity_pools (id TEXT PRIMARY KEY NOT NULL, pair TEXT NOT NULL, status TEXT NOT NULL, reserveUsd REAL NOT NULL, poolSharePercent REAL NOT NULL, priceImpactGuardPercent REAL NOT NULL, volume24hUsd REAL NOT NULL, lpTokenAddress TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS positions (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, label TEXT NOT NULL, value TEXT NOT NULL, detail TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS risk_items (id TEXT PRIMARY KEY NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY NOT NULL, walletAddress TEXT NOT NULL, type TEXT NOT NULL, asset TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL, feeUsd REAL NOT NULL, txHash TEXT NOT NULL, createdAt INTEGER NOT NULL)",
    "CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY NOT NULL, defaultSlippagePercent REAL NOT NULL, preferredCurrency TEXT NOT NULL, theme TEXT NOT NULL, developerMode INTEGER NOT NULL, reducedMotion INTEGER NOT NULL, notifications TEXT NOT NULL)"
  ]);
}
