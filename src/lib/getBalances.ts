import { createPublicClient, http, formatUnits, isAddress, type Address } from "viem";
import type { BridgeChain } from "./bridgeUsdc";
import { PHAROS_TESTNET } from "./pharos";

export type WalletTokenBalance = {
  address: `0x${string}`;
  balance: number;
  decimals: number;
  name: string;
  symbol: string;
};

const USDC_ADDRESS: Record<BridgeChain, `0x${string}`> = {
  Ethereum_Sepolia: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
  Base_Sepolia: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
  Arbitrum_Sepolia: "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d",
  Avalanche_Fuji: "0x5425890298aed601595a70ab815c96711a31bc65",
  Optimism_Sepolia: "0x5fd84259d66cd46123540766be93dfe6d43130d7",
  Pharos_Testnet: PHAROS_TESTNET.usdcAddress,
  Arc_Testnet: "0x3600000000000000000000000000000000000000",
};

const RPC_URL: Record<BridgeChain, string> = {
  Ethereum_Sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
  Base_Sepolia: "https://sepolia.base.org",
  Arbitrum_Sepolia: "https://sepolia-rollup.arbitrum.io/rpc",
  Avalanche_Fuji: "https://api.avax-test.network/ext/bc/C/rpc",
  Optimism_Sepolia: "https://sepolia.optimism.io",
  Pharos_Testnet: PHAROS_TESTNET.rpcUrl,
  Arc_Testnet: "https://rpc.testnet.arc.network",
};

const CHAIN_ID: Record<BridgeChain, number> = {
  Ethereum_Sepolia: 11155111,
  Base_Sepolia: 84532,
  Arbitrum_Sepolia: 421614,
  Avalanche_Fuji: 43113,
  Optimism_Sepolia: 11155420,
  Pharos_Testnet: PHAROS_TESTNET.chainId,
  Arc_Testnet: 5042002,
};

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const RPC_TIMEOUT_MS = 5000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function getArcWalletTokens(): Array<Omit<WalletTokenBalance, "balance">> {
  const boozzAddress = process.env.NEXT_PUBLIC_BOOZZ_TOKEN_ADDRESS;
  const tokens: Array<Omit<WalletTokenBalance, "balance">> = [
  {
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  {
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
    name: "Euro Coin",
    symbol: "EURC",
  },
  {
    address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    decimals: 8,
    name: "Circle Bitcoin",
    symbol: "cirBTC",
  },
  {
    address: boozzAddress && isAddress(boozzAddress) ? boozzAddress : ZERO_ADDRESS,
    decimals: 18,
    name: "BOOZZ Token",
    symbol: "BOOZZ",
  },
  ];

  return tokens;
}

export async function getUsdcBalance(
  address: Address,
  chain: BridgeChain
) {
  const client = createPublicClient({
    chain: {
      id: CHAIN_ID[chain],
      name: chain,
      nativeCurrency: {
        name: "Gas Token",
        symbol: "GAS",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: [RPC_URL[chain]],
        },
      },
    },
    transport: http(RPC_URL[chain], {
      retryCount: 1,
      timeout: RPC_TIMEOUT_MS,
    }),
  });

  const raw = await client.readContract({
    address: USDC_ADDRESS[chain],
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  return Number(formatUnits(raw, 6));
}

export async function getArcErc20Balance(
  ownerAddress: Address,
  tokenAddress: `0x${string}`,
  decimals: number,
) {
  const client = createPublicClient({
    chain: {
      id: CHAIN_ID.Arc_Testnet,
      name: "Arc Testnet",
      nativeCurrency: {
        name: "USDC",
        symbol: "USDC",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: [RPC_URL.Arc_Testnet],
        },
      },
    },
    transport: http(RPC_URL.Arc_Testnet, {
      retryCount: 1,
      timeout: RPC_TIMEOUT_MS,
    }),
  });

  const raw = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [ownerAddress],
  });

  return Number(formatUnits(raw, decimals));
}

export async function getArcWalletTokenBalances(address: Address) {
  const balances = await Promise.all(
    getArcWalletTokens().map(async (token) => {
      try {
        if (token.address === ZERO_ADDRESS) {
          return {
            ...token,
            balance: 0,
          };
        }

        return {
          ...token,
          balance: await getArcErc20Balance(
            address,
            token.address,
            token.decimals,
          ),
        };
      } catch {
        return {
          ...token,
          balance: 0,
        };
      }
    }),
  );

  return balances;
}

export async function getBalances(address: Address) {
  const arcTokens = await getArcWalletTokenBalances(address);
  const getTokenBalance = (symbol: string) =>
    arcTokens.find((token) => token.symbol === symbol)?.balance ?? 0;

  return {
    boozz: getTokenBalance("BOOZZ"),
    cirBTC: getTokenBalance("cirBTC"),
    eurc: getTokenBalance("EURC"),
    tokens: arcTokens,
    usdc: getTokenBalance("USDC"),
  };
}
