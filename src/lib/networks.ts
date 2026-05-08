import type { BridgeChain } from "./bridgeUsdc";

export type SupportedNetwork = {
  key: BridgeChain;
  label: string;
  chainId: number;
  explorerTxUrl: string;
};

export const SUPPORTED_NETWORKS: SupportedNetwork[] = [
  {
    key: "Arc_Testnet",
    label: "Arc Testnet",
    chainId: 5042002,
    explorerTxUrl: "https://testnet.arcscan.app/tx",
  },
  {
    key: "Ethereum_Sepolia",
    label: "Ethereum Sepolia",
    chainId: 11155111,
    explorerTxUrl: "https://sepolia.etherscan.io/tx",
  },
  {
    key: "Base_Sepolia",
    label: "Base Sepolia",
    chainId: 84532,
    explorerTxUrl: "https://sepolia.basescan.org/tx",
  },
  {
    key: "Arbitrum_Sepolia",
    label: "Arbitrum Sepolia",
    chainId: 421614,
    explorerTxUrl: "https://sepolia.arbiscan.io/tx",
  },
  {
    key: "Optimism_Sepolia",
    label: "Optimism Sepolia",
    chainId: 11155420,
    explorerTxUrl: "https://sepolia-optimism.etherscan.io/tx",
  },
  {
    key: "Avalanche_Fuji",
    label: "Avalanche Fuji",
    chainId: 43113,
    explorerTxUrl: "https://testnet.snowtrace.io/tx",
  },
];

export function getNetworkByKey(key: BridgeChain) {
  return SUPPORTED_NETWORKS.find((network) => network.key === key);
}

export function getNetworkByChainId(chainId: number | null) {
  return SUPPORTED_NETWORKS.find((network) => network.chainId === chainId);
}
