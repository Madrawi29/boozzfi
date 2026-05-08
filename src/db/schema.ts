import { relations } from "drizzle-orm";
import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)]
);

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    token: text("token").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [uniqueIndex("session_token_unique").on(table.token)]
);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
});

export const wallets = sqliteTable("wallets", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  label: text("label").notNull(),
  lastConnectedAt: integer("lastConnectedAt", { mode: "timestamp" }).notNull()
});

export const chains = sqliteTable("chains", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  chainId: integer("chainId").notNull(),
  rpcLatencyMs: integer("rpcLatencyMs").notNull(),
  status: text("status").notNull(),
  isTestnet: integer("isTestnet", { mode: "boolean" }).notNull(),
  explorerUrl: text("explorerUrl").notNull()
});

export const portfolioSnapshots = sqliteTable("portfolio_snapshots", {
  id: text("id").primaryKey(),
  walletAddress: text("walletAddress").notNull(),
  totalValueUsd: real("totalValueUsd").notNull(),
  simulatedYieldPercent: real("simulatedYieldPercent").notNull(),
  trackedChains: integer("trackedChains").notNull(),
  availableLiquidityUsd: real("availableLiquidityUsd").notNull(),
  liquidityDepthPercent: integer("liquidityDepthPercent").notNull(),
  pendingTransactions: integer("pendingTransactions").notNull(),
  pendingStatus: text("pendingStatus").notNull(),
  statusPollSeconds: integer("statusPollSeconds").notNull(),
  gasFeeUsd: real("gasFeeUsd").notNull(),
  finalitySeconds: real("finalitySeconds").notNull(),
  gasTrend: text("gasTrend").notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull()
});

export const tokens = sqliteTable("tokens", {
  id: text("id").primaryKey(),
  chainId: integer("chainId").notNull(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  contractAddress: text("contractAddress").notNull(),
  decimals: integer("decimals").notNull(),
  balance: real("balance").notNull(),
  priceUsd: real("priceUsd").notNull(),
  valueUsd: real("valueUsd").notNull(),
  label: text("label").notNull(),
  badge: text("badge").notNull(),
  riskLevel: text("riskLevel").notNull(),
  kind: text("kind").notNull()
});

export const chainDistribution = sqliteTable("chain_distribution", {
  id: text("id").primaryKey(),
  chain: text("chain").notNull(),
  percent: integer("percent").notNull(),
  valueUsd: real("valueUsd").notNull()
});

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  walletAddress: text("walletAddress").notNull(),
  name: text("name").notNull(),
  templateType: text("templateType").notNull(),
  status: text("status").notNull(),
  mode: text("mode").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
});

export const workflowSteps = sqliteTable("workflow_steps", {
  id: text("id").primaryKey(),
  workflowId: text("workflowId").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  stepType: text("stepType").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull(),
  txHash: text("txHash")
});

export const liquidityPools = sqliteTable("liquidity_pools", {
  id: text("id").primaryKey(),
  pair: text("pair").notNull(),
  status: text("status").notNull(),
  reserveUsd: real("reserveUsd").notNull(),
  poolSharePercent: real("poolSharePercent").notNull(),
  priceImpactGuardPercent: real("priceImpactGuardPercent").notNull(),
  volume24hUsd: real("volume24hUsd").notNull(),
  lpTokenAddress: text("lpTokenAddress").notNull()
});

export const positions = sqliteTable("positions", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  detail: text("detail").notNull()
});

export const riskItems = sqliteTable("risk_items", {
  id: text("id").primaryKey(),
  level: text("level").notNull(),
  message: text("message").notNull()
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  walletAddress: text("walletAddress").notNull(),
  type: text("type").notNull(),
  asset: text("asset").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull(),
  feeUsd: real("feeUsd").notNull(),
  txHash: text("txHash").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull()
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  defaultSlippagePercent: real("defaultSlippagePercent").notNull(),
  preferredCurrency: text("preferredCurrency").notNull(),
  theme: text("theme").notNull(),
  developerMode: integer("developerMode", { mode: "boolean" }).notNull(),
  reducedMotion: integer("reducedMotion", { mode: "boolean" }).notNull(),
  notifications: text("notifications").notNull()
});

export const workflowRelations = relations(workflows, ({ many }) => ({
  steps: many(workflowSteps)
}));

export const workflowStepRelations = relations(workflowSteps, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowSteps.workflowId],
    references: [workflows.id]
  })
}));
