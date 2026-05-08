import { ArcTestnet } from "@circle-fin/app-kit/chains";

const KIT_KEY_PATTERN = /^KIT_KEY:[^:]+:[^:]+$/;

export function isCircleKitKey(value: string | undefined) {
  return KIT_KEY_PATTERN.test(value?.trim() ?? "");
}

export function getCircleKitKey() {
  return [process.env.KIT_KEY, process.env.CIRCLE_KIT_KEY]
    .map((value) => value?.trim())
    .find((value): value is string => isCircleKitKey(value));
}

export const ARC_TESTNET = {
  id: "arc-testnet",
  appKitChain: "Arc_Testnet",
  name: "Arc Testnet",
  chainId: Number(process.env.NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID || ArcTestnet.chainId),
  rpcUrl: process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network",
  websocketUrl: process.env.NEXT_PUBLIC_ARC_TESTNET_WS_URL || "wss://rpc.testnet.arc.network",
  explorerUrl: process.env.NEXT_PUBLIC_ARC_TESTNET_EXPLORER_URL || "https://testnet.arcscan.app",
  faucetUrl: process.env.NEXT_PUBLIC_ARC_TESTNET_FAUCET_URL || "https://faucet.circle.com",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18
  },
  tokens: {
    USDC: ArcTestnet.usdcAddress,
    EURC: ArcTestnet.eurcAddress
  }
} as const;

export const PUBLIC_ARC_ENV = {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "B00ZZ FI",
  NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID: String(ARC_TESTNET.chainId),
  NEXT_PUBLIC_ARC_TESTNET_RPC_URL: ARC_TESTNET.rpcUrl,
  NEXT_PUBLIC_ARC_TESTNET_EXPLORER_URL: ARC_TESTNET.explorerUrl
};

export const SERVER_SECRET_READINESS = {
  CIRCLE_API_KEY: Boolean(process.env.CIRCLE_API_KEY),
  CIRCLE_ENTITY_SECRET: Boolean(process.env.CIRCLE_ENTITY_SECRET),
  CIRCLE_WEB3_API_KEY: Boolean(process.env.CIRCLE_WEB3_API_KEY),
  KIT_KEY: Boolean(getCircleKitKey()),
  DATABASE_URL: Boolean(process.env.DATABASE_URL),
  REDIS_URL: Boolean(process.env.REDIS_URL)
};

export type DashboardFeature =
  | "connect_wallet"
  | "portfolio"
  | "send"
  | "bridge_usdc"
  | "swap"
  | "cross_chain_swap"
  | "unified_balance"
  | "create_token"
  | "liquidity"
  | "staking"
  | "vault"
  | "creator_dashboard"
  | "activity";

export const FEATURE_MATRIX: Array<{
  id: DashboardFeature;
  label: string;
  primaryIntegration: string;
  secondaryIntegration: string;
  backendNeeded: boolean;
  enabled: boolean;
  mode: "user_wallet" | "managed_wallet" | "hybrid" | "server_indexed";
  requirements: string[];
}> = [
  {
    id: "connect_wallet",
    label: "Connect Wallet",
    primaryIntegration: "Viem browser wallet provider",
    secondaryIntegration: "Arc Testnet network guard",
    backendNeeded: false,
    enabled: true,
    mode: "user_wallet",
    requirements: ["Browser EIP-1193 provider", "Arc chain switch/add-network parameters"]
  },
  {
    id: "portfolio",
    label: "Portfolio",
    primaryIntegration: "Viem reads",
    secondaryIntegration: "Unified Balance Kit / local indexer",
    backendNeeded: true,
    enabled: true,
    mode: "server_indexed",
    requirements: ["Token registry", "balance readers", "activity-backed portfolio snapshot"]
  },
  {
    id: "send",
    label: "Send Token",
    primaryIntegration: "App Kit send",
    secondaryIntegration: "Viem wallet client",
    backendNeeded: false,
    enabled: true,
    mode: "user_wallet",
    requirements: ["Wallet signature", "recipient validation", "transaction preview"]
  },
  {
    id: "bridge_usdc",
    label: "Bridge USDC",
    primaryIntegration: "App Kit bridge / CCTP",
    secondaryIntegration: "Circle Gateway route tracking",
    backendNeeded: true,
    enabled: true,
    mode: "hybrid",
    requirements: ["USDC route support", "step timeline", "source and destination explorer URLs"]
  },
  {
    id: "swap",
    label: "Swap",
    primaryIntegration: "App Kit swap",
    secondaryIntegration: "B00ZZ router for custom token pairs",
    backendNeeded: true,
    enabled: true,
    mode: "hybrid",
    requirements: ["KIT_KEY for App Kit quotes", "slippage settings", "liquidity checks"]
  },
  {
    id: "cross_chain_swap",
    label: "Cross-chain Swap",
    primaryIntegration: "App Kit swap + bridge",
    secondaryIntegration: "Workflow step persistence",
    backendNeeded: true,
    enabled: true,
    mode: "hybrid",
    requirements: ["Swap step", "bridge step", "partial-completion recovery"]
  },
  {
    id: "unified_balance",
    label: "Unified Balance",
    primaryIntegration: "App Kit Unified Balance",
    secondaryIntegration: "Gateway deposit/spend state",
    backendNeeded: true,
    enabled: true,
    mode: "server_indexed",
    requirements: ["USDC chain balances", "Gateway balance labels", "testnet disclosure"]
  },
  {
    id: "create_token",
    label: "Create Token",
    primaryIntegration: "Viem deploy contract",
    secondaryIntegration: "Circle Contracts SDK for managed deployment",
    backendNeeded: true,
    enabled: true,
    mode: "hybrid",
    requirements: ["Template allowlist", "constructor validation", "deployment activity record"]
  },
  {
    id: "liquidity",
    label: "Liquidity",
    primaryIntegration: "Viem router/pool writes",
    secondaryIntegration: "B00ZZ pool factory",
    backendNeeded: true,
    enabled: true,
    mode: "hybrid",
    requirements: ["Pool existence", "minimum liquidity", "LP position tracking"]
  },
  {
    id: "staking",
    label: "Staking",
    primaryIntegration: "Viem staking contract writes",
    secondaryIntegration: "Circle managed execution",
    backendNeeded: true,
    enabled: true,
    mode: "hybrid",
    requirements: ["Pool config", "reward emission metadata", "unlock rules"]
  },
  {
    id: "vault",
    label: "Vault",
    primaryIntegration: "Viem vault contract writes",
    secondaryIntegration: "Circle managed execution",
    backendNeeded: true,
    enabled: true,
    mode: "hybrid",
    requirements: ["Strategy allowlist", "share accounting", "withdrawal rules"]
  },
  {
    id: "creator_dashboard",
    label: "Creator Dashboard",
    primaryIntegration: "Drizzle persisted deployment metadata",
    secondaryIntegration: "Viem contract reads / indexer",
    backendNeeded: true,
    enabled: true,
    mode: "server_indexed",
    requirements: ["Created token records", "pool/staking/vault records", "deployment history"]
  },
  {
    id: "activity",
    label: "Activity Feed",
    primaryIntegration: "Drizzle transaction records",
    secondaryIntegration: "Explorer/indexer status updates",
    backendNeeded: true,
    enabled: true,
    mode: "server_indexed",
    requirements: ["Every user-facing transaction creates an activity", "multi-step hashes for cross-chain flows"]
  }
];

export function getExplorerTxUrl(txHash: string) {
  return `${ARC_TESTNET.explorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

export function getArcAddChainParameters() {
  return {
    chainId: `0x${ARC_TESTNET.chainId.toString(16)}`,
    chainName: ARC_TESTNET.name,
    nativeCurrency: ARC_TESTNET.nativeCurrency,
    rpcUrls: [ARC_TESTNET.rpcUrl],
    blockExplorerUrls: [ARC_TESTNET.explorerUrl]
  };
}

export function getFeatureById(feature: string) {
  return FEATURE_MATRIX.find((item) => item.id === feature);
}
