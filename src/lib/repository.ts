import { randomUUID } from "node:crypto";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/src/db";
import { FEATURE_MATRIX, getArcAddChainParameters } from "@/src/lib/arc/config";
import { getAppKitReadiness } from "@/src/lib/arc/appKitClient";
import { ensureDatabase } from "@/src/lib/migrate";
import { money, shortenHash } from "@/src/lib/format";
import { getCircleManagedWalletReadiness } from "@/src/server/circle/wallets";
import { getUnifiedBalanceStatus } from "@/src/server/gateway/status";

export type ActivityInput = {
  walletAddress?: string;
  type?: string;
  asset?: string;
  amount?: number;
  status?: string;
  feeUsd?: number;
  txHash?: string;
};

export type TransactionPreviewInput = {
  type?: string;
  tokenIn?: string;
  tokenOut?: string;
  amount?: number;
  recipient?: string;
  sourceChain?: string;
};

export async function getDashboard() {
  await ensureDatabase();
  await seedIfNeeded();
  await ensureArcIntegrationDefaults();

  const [wallet] = await db.select().from(schema.wallets).limit(1);
  const [network] = await db.select().from(schema.chains).where(eq(schema.chains.id, "arc-testnet")).limit(1);
  const [portfolio] = await db.select().from(schema.portfolioSnapshots).limit(1);
  const tokens = await db.select().from(schema.tokens);
  const chainDistribution = await db.select().from(schema.chainDistribution);
  const [workflow] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, "workflow_bridge_send_001")).limit(1);
  const steps = await db.select().from(schema.workflowSteps).where(eq(schema.workflowSteps.workflowId, workflow.id)).orderBy(asc(schema.workflowSteps.order));
  const [liquidityPool] = await db.select().from(schema.liquidityPools).limit(1);
  const positionRows = await db.select().from(schema.positions);
  const riskItems = await db.select().from(schema.riskItems);
  const activities = await listActivities({});
  const [settings] = await db.select().from(schema.settings).limit(1);

  const positions = Object.fromEntries(positionRows.map((position) => [position.type, position]));

  return {
    wallet: {
      ...wallet,
      shortAddress: shortenHash(wallet.address)
    },
    network,
    portfolio,
    tokens,
    chainDistribution,
    workflow: {
      ...workflow,
      steps
    },
    liquidityPool,
    positions,
    risk: {
      warningCount: riskItems.filter((item) => item.level === "warning" || item.level === "danger").length,
      items: riskItems
    },
    activities,
    settings,
    integration: {
      arc: getArcAddChainParameters(),
      appKit: getAppKitReadiness(),
      managedWallet: getCircleManagedWalletReadiness(),
      unifiedBalance: getUnifiedBalanceStatus(),
      features: FEATURE_MATRIX
    },
    formatted: {
      totalValueUsd: `$${money(portfolio.totalValueUsd)}`,
      availableLiquidityUsd: `$${money(portfolio.availableLiquidityUsd)}`,
      gasFeeUsd: `$${Number(portfolio.gasFeeUsd).toFixed(3)}`,
      liquidityReserveUsd: `$${money(liquidityPool.reserveUsd)}`,
      chainTotalCompact: `$${Math.round(portfolio.totalValueUsd / 1000)}K`
    }
  };
}

export async function listActivities(filters: {
  type?: string | null;
  status?: string | null;
  search?: string | null;
  walletAddress?: string | null;
}) {
  await ensureDatabase();
  const rows = await db.select().from(schema.activities).orderBy(desc(schema.activities.createdAt));
  return rows.filter((activity) => {
    const matchesType = !filters.type || activity.type.toLowerCase() === filters.type.toLowerCase();
    const matchesStatus = !filters.status || activity.status.toLowerCase() === filters.status.toLowerCase();
    const matchesWallet =
      !filters.walletAddress ||
      activity.walletAddress.toLowerCase() === filters.walletAddress.toLowerCase();
    const haystack = `${activity.type} ${activity.asset} ${activity.status} ${activity.txHash}`.toLowerCase();
    const matchesSearch = !filters.search || haystack.includes(filters.search.toLowerCase());
    return matchesType && matchesStatus && matchesWallet && matchesSearch;
  });
}

export async function addActivity(input: ActivityInput) {
  await ensureDatabase();
  const errors = validateActivity(input);
  if (Object.keys(errors).length) {
    return { errors };
  }

  const [wallet] = await db.select().from(schema.wallets).limit(1);
  const activity = {
    id: `tx_${randomUUID()}`,
    walletAddress: input.walletAddress || wallet.address,
    type: input.type!,
    asset: input.asset!,
    amount: Number(input.amount),
    status: input.status!,
    feeUsd: Number(input.feeUsd || 0),
    txHash: input.txHash || `0x${randomUUID().replaceAll("-", "")}`,
    createdAt: new Date()
  };

  await db.insert(schema.activities).values(activity);
  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)` })
    .from(schema.activities)
    .where(eq(schema.activities.status, "Pending"));
  await db.update(schema.portfolioSnapshots).set({ pendingTransactions: Number(pending) }).where(eq(schema.portfolioSnapshots.id, "portfolio_demo_001"));
  return { activity };
}

export async function updateActivityStatus(input: {
  txHash?: string;
  status?: string;
}) {
  await ensureDatabase();

  if (!input.txHash) {
    return { errors: { txHash: "Transaction hash is required" } };
  }
  if (!input.status) {
    return { errors: { status: "Status is required" } };
  }

  const [activity] = await db
    .select()
    .from(schema.activities)
    .where(eq(schema.activities.txHash, input.txHash))
    .limit(1);

  if (!activity) {
    return { errors: { txHash: "Activity not found" } };
  }

  await db
    .update(schema.activities)
    .set({ status: input.status })
    .where(eq(schema.activities.txHash, input.txHash));

  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)` })
    .from(schema.activities)
    .where(eq(schema.activities.status, "Pending"));

  await db
    .update(schema.portfolioSnapshots)
    .set({ pendingTransactions: Number(pending) })
    .where(eq(schema.portfolioSnapshots.id, "portfolio_demo_001"));

  return {
    activity: {
      ...activity,
      status: input.status,
    },
  };
}

export async function finalizeActivityTransaction(input: {
  currentTxHash?: string;
  nextTxHash?: string;
  status?: string;
}) {
  await ensureDatabase();

  if (!input.currentTxHash) {
    return { errors: { currentTxHash: "Current transaction hash is required" } };
  }
  if (!input.status) {
    return { errors: { status: "Status is required" } };
  }

  const [activity] = await db
    .select()
    .from(schema.activities)
    .where(eq(schema.activities.txHash, input.currentTxHash))
    .limit(1);

  if (!activity) {
    return { errors: { currentTxHash: "Activity not found" } };
  }

  const txHash = input.nextTxHash || activity.txHash;

  await db
    .update(schema.activities)
    .set({
      status: input.status,
      txHash,
    })
    .where(eq(schema.activities.txHash, input.currentTxHash));

  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)` })
    .from(schema.activities)
    .where(eq(schema.activities.status, "Pending"));

  await db
    .update(schema.portfolioSnapshots)
    .set({ pendingTransactions: Number(pending) })
    .where(eq(schema.portfolioSnapshots.id, "portfolio_demo_001"));

  return {
    activity: {
      ...activity,
      status: input.status,
      txHash,
    },
  };
}

export async function buildTransactionPreview(input: TransactionPreviewInput) {
  await ensureDatabase();
  const errors = validatePreview(input);
  if (Object.keys(errors).length) {
    return { errors };
  }

  const [network] = await db.select().from(schema.chains).where(eq(schema.chains.id, "arc-testnet")).limit(1);
  const [portfolio] = await db.select().from(schema.portfolioSnapshots).limit(1);
  const type = String(input.type).toLowerCase();
  const amount = Number(input.amount);
  const feeUsd = type === "bridge" ? 1.42 : type === "swap" ? 0.02 : 0.018;

  return {
    preview: {
      id: `preview_${randomUUID()}`,
      type,
      network: network.name,
      amount,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut || input.tokenIn,
      recipient: input.recipient || null,
      estimatedFeeUsd: feeUsd,
      estimatedFinalitySeconds: type === "bridge" ? 45 : portfolio.finalitySeconds,
      route: type === "bridge" ? `${input.sourceChain || "Source testnet"} -> Arc Testnet` : "Arc Testnet",
      warnings: [
        "You are using testnet. Tokens have no economic value.",
        ...(amount > 10000 ? ["Large testnet transaction. Confirm recipient and route before signing."] : [])
      ],
      createdAt: new Date().toISOString()
    }
  };
}

export async function updateSettings(input: Record<string, unknown>) {
  await ensureDatabase();
  await seedIfNeeded();
  const patch = {
    defaultSlippagePercent: typeof input.defaultSlippagePercent === "number" ? input.defaultSlippagePercent : undefined,
    preferredCurrency: typeof input.preferredCurrency === "string" ? input.preferredCurrency : undefined,
    theme: typeof input.theme === "string" ? input.theme : undefined,
    developerMode: typeof input.developerMode === "boolean" ? input.developerMode : undefined,
    reducedMotion: typeof input.reducedMotion === "boolean" ? input.reducedMotion : undefined,
    notifications: typeof input.notifications === "string" ? input.notifications : undefined
  };

  await db.update(schema.settings).set(patch).where(eq(schema.settings.id, "settings_default"));
  const [settings] = await db.select().from(schema.settings).where(eq(schema.settings.id, "settings_default")).limit(1);
  return settings;
}

export async function createWorkflow(input: Record<string, unknown>) {
  await ensureDatabase();
  const [wallet] = await db.select().from(schema.wallets).limit(1);
  const workflow = {
    id: `workflow_${randomUUID()}`,
    walletAddress: typeof input.walletAddress === "string" ? input.walletAddress : wallet.address,
    name: typeof input.name === "string" ? input.name : "Untitled workflow",
    templateType: typeof input.templateType === "string" ? input.templateType : "send",
    status: "not_started",
    mode: "Manual steps",
    createdAt: new Date()
  };
  await db.insert(schema.workflows).values(workflow);
  return workflow;
}

export async function seedIfNeeded() {
  const existing = await db.select({ id: schema.wallets.id }).from(schema.wallets).limit(1);
  if (existing.length) return;

  const now = new Date();
  const walletAddress = "0x71C4B7D84EfB9D8E79E5832D1Cd7b7A42C9F02";
  await db.insert(schema.wallets).values({
    id: "wallet_demo_001",
    address: walletAddress,
    label: "Treasury Ops",
    lastConnectedAt: new Date("2026-04-29T00:58:12.000Z")
  });
  await db.insert(schema.chains).values({
    id: "arc-testnet",
    name: "Arc Testnet",
    chainId: 5042002,
    rpcLatencyMs: 142,
    status: "healthy",
    isTestnet: true,
    explorerUrl: "https://testnet.arcscan.app"
  });
  await db.insert(schema.portfolioSnapshots).values({
    id: "portfolio_demo_001",
    walletAddress,
    totalValueUsd: 128460.72,
    simulatedYieldPercent: 12.8,
    trackedChains: 5,
    availableLiquidityUsd: 52184.2,
    liquidityDepthPercent: 68,
    pendingTransactions: 3,
    pendingStatus: "Bridge relay pending",
    statusPollSeconds: 8,
    gasFeeUsd: 0.018,
    finalitySeconds: 1.4,
    gasTrend: "Stable",
    updatedAt: now
  });
  await db.insert(schema.tokens).values([
    { id: "token_usdc_arc", chainId: 5042002, symbol: "USDC", name: "USD Coin", contractAddress: "0x3600000000000000000000000000000000000000", decimals: 18, balance: 48250, priceUsd: 1, valueUsd: 48250, label: "Arc native stablecoin and gas token", badge: "US", riskLevel: "low", kind: "usdc" },
    { id: "token_eurc_arc", chainId: 5042002, symbol: "EURC", name: "Euro Coin", contractAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6, balance: 18420.5, priceUsd: 1.08, valueUsd: 19894.14, label: "Arc App Kit swap token", badge: "EU", riskLevel: "low", kind: "arc" },
    { id: "token_bzpay", chainId: 5042002, symbol: "BZPAY", name: "B00ZZ Pay", contractAddress: "0x6B00zz0000000000000000000000000000BzPay", decimals: 18, balance: 92000, priceUsd: 0.3, valueUsd: 27600, label: "Created by you", badge: "BZ", riskLevel: "custom", kind: "custom" },
    { id: "lp_bzpay_usdc", chainId: 5042002, symbol: "BZPAY/USDC LP", name: "BZPAY USDC Liquidity Position", contractAddress: "0x00000000000000000000000000000000B00zzLp", decimals: 18, balance: 1108.45, priceUsd: 14.2, valueUsd: 15742.72, label: "Liquidity position", badge: "LP", riskLevel: "medium", kind: "lp" }
  ]);
  await db.insert(schema.chainDistribution).values([
    { id: "chain_arc", chain: "Arc", percent: 62, valueUsd: 79645.65 },
    { id: "chain_ethereum", chain: "Ethereum", percent: 18, valueUsd: 23122.93 },
    { id: "chain_base", chain: "Base", percent: 13, valueUsd: 16700.89 },
    { id: "chain_optimism", chain: "Optimism", percent: 7, valueUsd: 8991.25 }
  ]);
  await db.insert(schema.workflows).values({
    id: "workflow_bridge_send_001",
    walletAddress,
    name: "Bridge + send progress",
    templateType: "bridge_send",
    status: "pending",
    mode: "Manual steps",
    createdAt: now
  });
  await db.insert(schema.workflowSteps).values([
    { id: "step_bridge", workflowId: "workflow_bridge_send_001", order: 1, stepType: "bridge", title: "Bridge USDC to Arc", status: "completed", detail: "Source confirmed on Sepolia", txHash: "0x9d12c4a11d4c6e00e8f1e1a0db98a8c1" },
    { id: "step_relay", workflowId: "workflow_bridge_send_001", order: 2, stepType: "relay", title: "Relay attestation", status: "pending", detail: "Waiting for bridge provider", txHash: null },
    { id: "step_send", workflowId: "workflow_bridge_send_001", order: 3, stepType: "send", title: "Send to treasury wallet", status: "not_started", detail: "Ready after bridge completion", txHash: null }
  ]);
  await db.insert(schema.liquidityPools).values({
    id: "pool_bzpay_usdc",
    pair: "BZPAY/USDC",
    status: "Healthy",
    reserveUsd: 36880,
    poolSharePercent: 24.7,
    priceImpactGuardPercent: 2.1,
    volume24hUsd: 18420.45,
    lpTokenAddress: "0x00000000000000000000000000000000B00zzLp"
  });
  await db.insert(schema.positions).values([
    { id: "position_staking", type: "staking", label: "Staked LP", value: "$8,920.00", detail: "APR estimate 18.4%" },
    { id: "position_vault", type: "vault", label: "Vault share", value: "7,412.18 vUSDC", detail: "Yield simulated" },
    { id: "position_rewards", type: "rewards", label: "Rewards", value: "284.70 BZPAY", detail: "Unlocks in 3d 08h" }
  ]);
  await db.insert(schema.riskItems).values([
    { id: "risk_custom_token", level: "warning", message: "BZPAY is a custom testnet token. Contract verification pending." },
    { id: "risk_allowance", level: "danger", message: "High allowance detected for router 0x93A2...01D4." },
    { id: "risk_network", level: "success", message: "Wallet is connected to the expected Arc Testnet chain ID." }
  ]);
  await db.insert(schema.activities).values([
    { id: "tx_bridge_001", walletAddress, type: "Bridge", asset: "USDC Sepolia to Arc", amount: 12500, status: "Pending", feeUsd: 1.42, txHash: "0x9d12c4a11d4c6e00e8f1e1a0db98a8c1", createdAt: new Date("2026-04-29T00:51:24.000Z") },
    { id: "tx_swap_001", walletAddress, type: "Swap", asset: "USDC to BZPAY", amount: 4000, status: "Success", feeUsd: 0.02, txHash: "0x3ef0ab18d5a22374e3a8a7ad5f5219bd", createdAt: new Date("2026-04-29T00:38:10.000Z") },
    { id: "tx_stake_001", walletAddress, type: "Stake", asset: "BZPAY/USDC LP", amount: 320.45, status: "Success", feeUsd: 0.01, txHash: "0x44bc119da4f3926b5ba54f53a77d902f", createdAt: new Date("2026-04-29T00:25:43.000Z") },
    { id: "tx_send_001", walletAddress, type: "Send", asset: "USDC", amount: 875, status: "Failed", feeUsd: 0, txHash: "Wallet rejected", createdAt: new Date("2026-04-29T00:12:02.000Z") }
  ]);
  await db.insert(schema.settings).values({
    id: "settings_default",
    defaultSlippagePercent: 0.5,
    preferredCurrency: "USD",
    theme: "blue-flame-dark",
    developerMode: true,
    reducedMotion: false,
    notifications: "in_app"
  });
}

export async function ensureArcIntegrationDefaults() {
  await db
    .update(schema.chains)
    .set({
      chainId: 5042002,
      explorerUrl: "https://testnet.arcscan.app",
      status: "healthy",
      isTestnet: true
    })
    .where(eq(schema.chains.id, "arc-testnet"));

  await db
    .update(schema.tokens)
    .set({
      chainId: 5042002,
      contractAddress: "0x3600000000000000000000000000000000000000",
      decimals: 18,
      label: "Arc native stablecoin and gas token"
    })
    .where(eq(schema.tokens.id, "token_usdc_arc"));

  const eurc = await db.select({ id: schema.tokens.id }).from(schema.tokens).where(eq(schema.tokens.id, "token_eurc_arc")).limit(1);
  if (!eurc.length) {
    await db.insert(schema.tokens).values({
      id: "token_eurc_arc",
      chainId: 5042002,
      symbol: "EURC",
      name: "Euro Coin",
      contractAddress: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
      decimals: 6,
      balance: 18420.5,
      priceUsd: 1.08,
      valueUsd: 19894.14,
      label: "Arc App Kit swap token",
      badge: "EU",
      riskLevel: "low",
      kind: "arc"
    });
  }
}

export function validateActivity(input: ActivityInput) {
  const errors: Record<string, string> = {};
  if (!input.type) errors.type = "Transaction type is required";
  if (!input.asset) errors.asset = "Asset or route description is required";
  if (!Number.isFinite(Number(input.amount))) errors.amount = "Amount must be numeric";
  if (!input.status) errors.status = "Status is required";
  return errors;
}

export function validatePreview(input: TransactionPreviewInput) {
  const errors: Record<string, string> = {};
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

export function activitiesToCsv(rows: Awaited<ReturnType<typeof listActivities>>) {
  const headers = ["type", "asset", "amount", "status", "feeUsd", "txHash", "createdAt"];
  const escapeCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header as keyof typeof row])).join(","))
  ].join("\n");
}
