import { Blockchain } from "@circle-fin/adapter-viem-v2";
import { defineChain } from "viem";

export const PHAROS_TESTNET = {
  chain: "Pharos_Testnet",
  chainId: 688689,
  explorerTxUrl: "https://atlantic.pharosscan.xyz/tx",
  explorerUrl: "https://atlantic.pharosscan.xyz/tx/{hash}",
  name: "Pharos Atlantic",
  rpcUrl: "https://atlantic.dplabs-internal.com",
  title: "Pharos Atlantic Testnet",
  usdcAddress: "0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B",
} as const;

export const pharosTestnetViemChain = defineChain({
  id: PHAROS_TESTNET.chainId,
  name: PHAROS_TESTNET.title,
  nativeCurrency: {
    decimals: 18,
    name: "Pharos",
    symbol: "PHAROS",
  },
  rpcUrls: {
    default: {
      http: [PHAROS_TESTNET.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "PharosScan",
      url: "https://atlantic.pharosscan.xyz",
    },
  },
  testnet: true,
});

export const pharosTestnetAppKitChain = {
  type: "evm",
  chain: Blockchain.Pharos_Testnet,
  name: PHAROS_TESTNET.name,
  title: PHAROS_TESTNET.title,
  nativeCurrency: {
    name: "Pharos",
    symbol: "PHAROS",
    decimals: 18,
  },
  chainId: PHAROS_TESTNET.chainId,
  isTestnet: true,
  explorerUrl: PHAROS_TESTNET.explorerUrl,
  rpcEndpoints: [PHAROS_TESTNET.rpcUrl],
  eurcAddress: null,
  usdcAddress: PHAROS_TESTNET.usdcAddress,
  usdtAddress: null,
  cctp: {
    domain: 31,
    contracts: {
      v2: {
        type: "split",
        tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
        messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
        confirmations: 1,
        fastConfirmations: 1,
      },
    },
    forwarderSupported: {
      source: false,
      destination: false,
    },
  },
  kitContracts: {
    bridge: "0xC5567a5E3370d4DBfB0540025078e283e36A363d",
  },
} as const;
