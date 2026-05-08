import { createPublicClient, formatUnits, http, isAddress, type Hash } from "viem";
import { arcTestnet } from "viem/chains";
import { ARC_TESTNET, getExplorerTxUrl } from "./config";

export const arcTestnetChain = arcTestnet;

export const arcPublicClient = createPublicClient({
  chain: arcTestnetChain,
  transport: http(ARC_TESTNET.rpcUrl, {
    retryCount: 2,
    timeout: 8000
  })
});

export async function getArcRpcStatus() {
  const startedAt = Date.now();
  try {
    const blockNumber = await arcPublicClient.getBlockNumber();
    return {
      ok: true,
      chainId: ARC_TESTNET.chainId,
      rpcUrl: ARC_TESTNET.rpcUrl,
      blockNumber: blockNumber.toString(),
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      ok: false,
      chainId: ARC_TESTNET.chainId,
      rpcUrl: ARC_TESTNET.rpcUrl,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown RPC error"
    };
  }
}

export async function getNativeUsdcBalance(address: string) {
  if (!isAddress(address)) {
    throw new Error("Invalid EVM address");
  }

  const balance = await arcPublicClient.getBalance({ address });
  return {
    address,
    raw: balance.toString(),
    formatted: formatUnits(balance, ARC_TESTNET.nativeCurrency.decimals),
    symbol: ARC_TESTNET.nativeCurrency.symbol
  };
}

export async function getTransactionStatus(txHash: Hash) {
  const receipt = await arcPublicClient.getTransactionReceipt({ hash: txHash });
  return {
    txHash,
    status: receipt.status,
    blockNumber: receipt.blockNumber.toString(),
    explorerUrl: getExplorerTxUrl(txHash)
  };
}
