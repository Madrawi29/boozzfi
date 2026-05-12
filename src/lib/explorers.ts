import type { BridgeChain } from "./bridgeUsdc";
import { PHAROS_TESTNET } from "./pharos";

const ARC_EXPLORER_URL = "https://testnet.arcscan.app";

const BRIDGE_EXPLORER_TX_URL: Record<BridgeChain, string> = {
  Ethereum_Sepolia: "https://sepolia.etherscan.io/tx",
  Base_Sepolia: "https://sepolia.basescan.org/tx",
  Arbitrum_Sepolia: "https://sepolia.arbiscan.io/tx",
  Avalanche_Fuji: "https://testnet.snowtrace.io/tx",
  Optimism_Sepolia: "https://sepolia-optimism.etherscan.io/tx",
  Pharos_Testnet: PHAROS_TESTNET.explorerTxUrl,
  Arc_Testnet: `${ARC_EXPLORER_URL}/tx`,
};

export function getArcExplorerTxUrl(txHash: string) {
  return `${ARC_EXPLORER_URL}/tx/${txHash}`;
}

export function getArcExplorerAddressUrl(address: string) {
  return `${ARC_EXPLORER_URL}/address/${address}`;
}

export function getBridgeExplorerTxUrl(chain: BridgeChain, txHash: string) {
  return `${BRIDGE_EXPLORER_TX_URL[chain]}/${txHash}`;
}
