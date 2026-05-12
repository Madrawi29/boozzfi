import {
  ArbitrumSepolia,
  ArcTestnet,
  AvalancheFuji,
  BaseSepolia,
  EthereumSepolia,
  OptimismSepolia,
} from "@circle-fin/app-kit/chains";
import {
  createCircleAppKit,
  getCircleAppKitConfigStatus,
} from "@/src/lib/circleAppKit";
import { ARC_TESTNET, FEATURE_MATRIX, SERVER_SECRET_READINESS, getExplorerTxUrl } from "./config";

export const appKit = createCircleAppKit();

export const SUPPORTED_APP_KIT_ROUTES = {
  send: {
    chains: [
      ArcTestnet.chain,
      EthereumSepolia.chain,
      BaseSepolia.chain,
      ArbitrumSepolia.chain,
      AvalancheFuji.chain,
      OptimismSepolia.chain,
    ],
    tokens: ["USDC", "EURC", "custom-erc20"],
    execution: "user-signed wallet adapter"
  },
  swap: {
    chains: [ArcTestnet.chain],
    tokens: ["USDC", "EURC", "cirBTC"],
    execution: "App Kit quote requires server KIT_KEY"
  },
  bridge: {
    chains: [
      ArcTestnet.chain,
      EthereumSepolia.chain,
      BaseSepolia.chain,
      ArbitrumSepolia.chain,
      AvalancheFuji.chain,
      OptimismSepolia.chain,
    ],
    tokens: ["USDC"],
    execution: "App Kit bridge / CCTP with step tracking"
  },
  unifiedBalance: {
    chains: [
      ArcTestnet.chain,
      EthereumSepolia.chain,
      BaseSepolia.chain,
      ArbitrumSepolia.chain,
      AvalancheFuji.chain,
      OptimismSepolia.chain,
    ],
    tokens: ["USDC"],
    execution: "Gateway deposit/spend status model"
  }
};

export function getAppKitReadiness() {
  return {
    packageReady: true,
    kitKeyConfigured: SERVER_SECRET_READINESS.KIT_KEY,
    arcChain: {
      name: ArcTestnet.name,
      chain: ArcTestnet.chain,
      chainId: ArcTestnet.chainId,
      usdcAddress: ArcTestnet.usdcAddress,
      eurcAddress: ArcTestnet.eurcAddress,
      rpcEndpoint: ARC_TESTNET.rpcUrl,
      explorerUrl: ARC_TESTNET.explorerUrl
    },
    routes: SUPPORTED_APP_KIT_ROUTES,
    telemetry: getCircleAppKitConfigStatus(),
    featureMatrix: FEATURE_MATRIX
  };
}

export function buildFeatureEnablementPlan(feature: string, input: Record<string, unknown> = {}) {
  const amount = String(input.amount || "0.00");
  const tokenIn = String(input.tokenIn || "USDC");
  const tokenOut = String(input.tokenOut || tokenIn);
  const sourceChain = String(input.sourceChain || "Arc_Testnet");
  const destinationChain = String(input.destinationChain || "Arc_Testnet");
  const txHash = typeof input.txHash === "string" ? input.txHash : undefined;

  const common = {
    feature,
    enabled: true,
    network: ARC_TESTNET.name,
    chainId: ARC_TESTNET.chainId,
    custodyMode: input.custodyMode || "user_wallet",
    requiresWalletSignature: true,
    requiresServerSecret: false,
    explorerUrl: txHash ? getExplorerTxUrl(txHash) : null
  };

  if (feature === "bridge_usdc") {
    return {
      ...common,
      primaryIntegration: "App Kit bridge / CCTP",
      sourceChain,
      destinationChain,
      tokenIn: "USDC",
      amountIn: amount,
      requiresServerSecret: false,
      steps: [
        { type: "BRIDGE_SOURCE_CONFIRMATION", status: "WAITING_FOR_SIGNATURE" },
        { type: "ATTESTATION_OR_RELAY", status: "DRAFT" },
        { type: "DESTINATION_MINT", status: "DRAFT" }
      ]
    };
  }

  if (feature === "cross_chain_swap") {
    return {
      ...common,
      primaryIntegration: "App Kit swap + bridge",
      sourceChain,
      destinationChain,
      tokenIn,
      tokenOut,
      amountIn: amount,
      estimatedAmountOut: input.estimatedAmountOut || "pending quote",
      requiresServerSecret: true,
      serverSecretReady: SERVER_SECRET_READINESS.KIT_KEY,
      steps: [
        { type: "SWAP", status: "DRAFT" },
        { type: "BRIDGE", status: "DRAFT" }
      ]
    };
  }

  if (feature === "swap") {
    return {
      ...common,
      primaryIntegration: tokenIn === "USDC" || tokenOut === "USDC" ? "App Kit swap / B00ZZ router fallback" : "B00ZZ router",
      tokenIn,
      tokenOut,
      amountIn: amount,
      slippageBps: Number(input.slippageBps || 50),
      requiresServerSecret: tokenIn !== "USDC" && tokenOut !== "USDC" ? false : true,
      serverSecretReady: SERVER_SECRET_READINESS.KIT_KEY,
      checks: ["pool_exists", "minimum_liquidity", "allowance", "price_impact"]
    };
  }

  return {
    ...common,
    primaryIntegration: "Viem contract interaction",
    tokenIn,
    amountIn: amount,
    steps: [{ type: feature.toUpperCase(), status: "WAITING_FOR_SIGNATURE" }]
  };
}
