import type { ConnectedWallet } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  isAddress,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { arcPublicClient, arcTestnetChain } from "@/src/lib/arc/viem";

export type LiquidityTokenSymbol = "USDC" | "EURC" | "cirBTC" | "BOOZZ";

export type LiquidityPair = {
  aprPercent: number;
  estimatedShareValueUsdc: number;
  id: string;
  label: string;
  lpProviderSharePercent: number;
  protocolSharePercent: number;
  reserveSharePercent: number;
  tokenA: LiquidityTokenSymbol;
  tokenB: LiquidityTokenSymbol;
  vaultName: string;
};

export const TOKEN_USDC_REFERENCE_PRICE: Record<LiquidityTokenSymbol, number> = {
  BOOZZ: 0.3,
  cirBTC: 100000,
  EURC: 1,
  USDC: 1,
};

export const ARC_LIQUIDITY_PAIRS: LiquidityPair[] = [
  {
    aprPercent: 8.4,
    estimatedShareValueUsdc: 1,
    id: "USDC-EURC",
    label: "USDC / EURC",
    lpProviderSharePercent: 82,
    protocolSharePercent: 10,
    reserveSharePercent: 8,
    tokenA: "USDC",
    tokenB: "EURC",
    vaultName: "Stable Balance Vault",
  },
  {
    aprPercent: 18.2,
    estimatedShareValueUsdc: 1.18,
    id: "USDC-cirBTC",
    label: "USDC / cirBTC",
    lpProviderSharePercent: 76,
    protocolSharePercent: 14,
    reserveSharePercent: 10,
    tokenA: "USDC",
    tokenB: "cirBTC",
    vaultName: "BTC Dollar Vault",
  },
  {
    aprPercent: 19.6,
    estimatedShareValueUsdc: 1.14,
    id: "EURC-cirBTC",
    label: "EURC / cirBTC",
    lpProviderSharePercent: 75,
    protocolSharePercent: 15,
    reserveSharePercent: 10,
    tokenA: "EURC",
    tokenB: "cirBTC",
    vaultName: "BTC Euro Vault",
  },
  {
    aprPercent: 31.5,
    estimatedShareValueUsdc: 0.72,
    id: "USDC-BOOZZ",
    label: "USDC / BOOZZ",
    lpProviderSharePercent: 72,
    protocolSharePercent: 18,
    reserveSharePercent: 10,
    tokenA: "USDC",
    tokenB: "BOOZZ",
    vaultName: "BOOZZ Dollar Vault",
  },
  {
    aprPercent: 34.8,
    estimatedShareValueUsdc: 0.68,
    id: "EURC-BOOZZ",
    label: "EURC / BOOZZ",
    lpProviderSharePercent: 70,
    protocolSharePercent: 20,
    reserveSharePercent: 10,
    tokenA: "EURC",
    tokenB: "BOOZZ",
    vaultName: "BOOZZ Euro Vault",
  },
];

const ARC_TOKEN_REGISTRY: Record<
  Exclude<LiquidityTokenSymbol, "BOOZZ">,
  { address: Address; decimals: number; name: string }
> = {
  USDC: {
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
    name: "USD Coin",
  },
  EURC: {
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
    name: "Euro Coin",
  },
  cirBTC: {
    address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    decimals: 8,
    name: "Circle Bitcoin",
  },
};

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

type TokenMeta = {
  address: Address;
  decimals: number;
  name: string;
  symbol: LiquidityTokenSymbol;
};

const VERIFIED_LIQUIDITY_VAULT_ADDRESS =
  "0x7ab35d4242e5009b12213a058fec1e927d07ad45";
const VERIFIED_BOOZZ_TOKEN_ADDRESS =
  "0xd6b443e56293ce991b17086acf5ec5545e7e1272";

export function getDefaultBoozzTokenAddress() {
  const value = process.env.NEXT_PUBLIC_BOOZZ_TOKEN_ADDRESS;
  return value && isAddress(value) ? value : VERIFIED_BOOZZ_TOKEN_ADDRESS;
}

export function getDefaultLiquidityVaultAddress() {
  return VERIFIED_LIQUIDITY_VAULT_ADDRESS;
}

export function quoteEqualValueTokenAmount(input: {
  amount: string;
  fromToken: LiquidityTokenSymbol;
  toToken: LiquidityTokenSymbol;
}) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "";

  const fromPrice = TOKEN_USDC_REFERENCE_PRICE[input.fromToken];
  const toPrice = TOKEN_USDC_REFERENCE_PRICE[input.toToken];
  const quotedAmount = (amount * fromPrice) / toPrice;

  return quotedAmount.toLocaleString("en-US", {
    maximumFractionDigits: input.toToken === "cirBTC" ? 8 : 6,
    minimumFractionDigits: input.toToken === "cirBTC" ? 8 : 0,
    useGrouping: false,
  });
}

export function getLiquidityToken(
  symbol: LiquidityTokenSymbol,
  boozzTokenAddress: string,
): TokenMeta {
  if (symbol !== "BOOZZ") {
    return {
      ...ARC_TOKEN_REGISTRY[symbol],
      symbol,
    };
  }

  if (!isAddress(boozzTokenAddress)) {
    throw new Error("Enter the deployed BOOZZ token address before using a BOOZZ pair.");
  }

  return {
    address: boozzTokenAddress,
    decimals: 18,
    name: "BOOZZ Token",
    symbol: "BOOZZ",
  };
}

function getVaultAddress(value: string): Address {
  if (!isAddress(value)) {
    throw new Error("Enter a valid BoozzLiquidityVault contract address.");
  }

  return value;
}

async function getWalletClients(wallet: ConnectedWallet) {
  await wallet.switchChain(arcTestnetChain.id);
  const provider = await wallet.getEthereumProvider();
  const walletClient = createWalletClient({
    chain: arcTestnetChain,
    transport: custom(provider),
  });
  const publicClient = createPublicClient({
    chain: arcTestnetChain,
    transport: custom(provider),
  });
  const [account] = await walletClient.getAddresses();

  return { account, publicClient, walletClient };
}

async function approveToken(input: {
  account: Address;
  amount: bigint;
  spender: Address;
  token: TokenMeta;
  walletClient: Awaited<ReturnType<typeof getWalletClients>>["walletClient"];
  publicClient: Awaited<ReturnType<typeof getWalletClients>>["publicClient"];
}) {
  const hash = await input.walletClient.writeContract({
    account: input.account,
    address: input.token.address,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [input.spender, input.amount],
  });

  await input.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function addLiquidityToPair(input: {
  amountA: string;
  amountB: string;
  boozzTokenAddress: string;
  pair: LiquidityPair;
  vaultAddress: string;
  wallet: ConnectedWallet;
}) {
  const vaultAddress = getVaultAddress(input.vaultAddress);
  const tokenA = getLiquidityToken(input.pair.tokenA, input.boozzTokenAddress);
  const tokenB = getLiquidityToken(input.pair.tokenB, input.boozzTokenAddress);
  const amountA = parseUnits(input.amountA, tokenA.decimals);
  const amountB = parseUnits(input.amountB, tokenB.decimals);

  if (amountA <= 0n || amountB <= 0n) {
    throw new Error("Both LP amounts must be greater than zero.");
  }

  const { account, publicClient, walletClient } = await getWalletClients(input.wallet);
  const artifact = await import("../../artifacts/BoozzLiquidityVault.json");
  const [balanceA, balanceB] = await Promise.all([
    publicClient.readContract({
      address: tokenA.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account],
    }),
    publicClient.readContract({
      address: tokenB.address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account],
    }),
  ]);

  if ((balanceA as bigint) < amountA) {
    throw new Error(`Insufficient ${tokenA.symbol} balance for this LP amount.`);
  }
  if ((balanceB as bigint) < amountB) {
    throw new Error(`Insufficient ${tokenB.symbol} balance for this LP amount.`);
  }

  const approvalHashes = [
    await approveToken({
      account,
      amount: amountA,
      spender: vaultAddress,
      token: tokenA,
      walletClient,
      publicClient,
    }),
    await approveToken({
      account,
      amount: amountB,
      spender: vaultAddress,
      token: tokenB,
      walletClient,
      publicClient,
    }),
  ];

  const txHash = await walletClient.writeContract({
    account,
    address: vaultAddress,
    abi: artifact.abi,
    functionName: "addLiquidity",
    args: [tokenA.address, tokenB.address, amountA, amountB, account],
  });

  return {
    approvalHashes,
    txHash,
  };
}

export async function deployLiquidityVault(wallet: ConnectedWallet) {
  const { account, publicClient, walletClient } = await getWalletClients(wallet);
  const artifact = await import("../../artifacts/BoozzLiquidityVault.json");

  const txHash = await walletClient.deployContract({
    account,
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    contractAddress: receipt.contractAddress,
    txHash,
  };
}

export async function depositLiquiditySharesToVault(input: {
  boozzTokenAddress: string;
  lockDays: string;
  pair: LiquidityPair;
  shares: string;
  vaultAddress: string;
  wallet: ConnectedWallet;
}) {
  const vaultAddress = getVaultAddress(input.vaultAddress);
  const tokenA = getLiquidityToken(input.pair.tokenA, input.boozzTokenAddress);
  const tokenB = getLiquidityToken(input.pair.tokenB, input.boozzTokenAddress);
  const shares = parseUnits(input.shares, 18);

  if (shares <= 0n) {
    throw new Error("Vault shares must be greater than zero.");
  }

  const lockDays = Number(input.lockDays);
  const lockDurationSeconds = BigInt(
    Math.max(0, Math.floor(Number.isFinite(lockDays) ? lockDays : 0)) * 86400,
  );
  const { account, walletClient } = await getWalletClients(input.wallet);
  const artifact = await import("../../artifacts/BoozzLiquidityVault.json");

  const txHash = await walletClient.writeContract({
    account,
    address: vaultAddress,
    abi: artifact.abi,
    functionName: "depositToVault",
    args: [tokenA.address, tokenB.address, shares, account, lockDurationSeconds],
  });

  return { txHash };
}

export async function withdrawLiquiditySharesFromVault(input: {
  boozzTokenAddress: string;
  pair: LiquidityPair;
  shares: string;
  vaultAddress: string;
  wallet: ConnectedWallet;
}) {
  const vaultAddress = getVaultAddress(input.vaultAddress);
  const tokenA = getLiquidityToken(input.pair.tokenA, input.boozzTokenAddress);
  const tokenB = getLiquidityToken(input.pair.tokenB, input.boozzTokenAddress);
  const shares = parseUnits(input.shares, 18);

  if (shares <= 0n) {
    throw new Error("Vault shares to withdraw must be greater than zero.");
  }

  const { account, walletClient } = await getWalletClients(input.wallet);
  const artifact = await import("../../artifacts/BoozzLiquidityVault.json");

  const txHash = await walletClient.writeContract({
    account,
    address: vaultAddress,
    abi: artifact.abi,
    functionName: "withdrawFromVault",
    args: [tokenA.address, tokenB.address, shares, account],
  });

  return { txHash };
}

export async function removeLiquidityFromPair(input: {
  boozzTokenAddress: string;
  pair: LiquidityPair;
  shares: string;
  vaultAddress: string;
  wallet: ConnectedWallet;
}) {
  const vaultAddress = getVaultAddress(input.vaultAddress);
  const tokenA = getLiquidityToken(input.pair.tokenA, input.boozzTokenAddress);
  const tokenB = getLiquidityToken(input.pair.tokenB, input.boozzTokenAddress);
  const shares = parseUnits(input.shares, 18);

  if (shares <= 0n) {
    throw new Error("LP shares to withdraw must be greater than zero.");
  }

  const { account, walletClient } = await getWalletClients(input.wallet);
  const artifact = await import("../../artifacts/BoozzLiquidityVault.json");

  const txHash = await walletClient.writeContract({
    account,
    address: vaultAddress,
    abi: artifact.abi,
    functionName: "removeLiquidity",
    args: [tokenA.address, tokenB.address, shares, account],
  });

  return { txHash };
}

export function estimateVaultUsdcEarn(input: {
  holdingDays: number;
  pair: LiquidityPair;
  vaultShares: string;
}) {
  const shares = Number(input.vaultShares);
  const holdingDays = Number(input.holdingDays);
  const safeShares = Number.isFinite(shares) && shares > 0 ? shares : 0;
  const safeDays = Number.isFinite(holdingDays) && holdingDays > 0 ? holdingDays : 0;
  const principalUsdc = safeShares * input.pair.estimatedShareValueUsdc;
  const grossAnnualUsdc = principalUsdc * (input.pair.aprPercent / 100);
  const lpAnnualUsdc =
    grossAnnualUsdc * (input.pair.lpProviderSharePercent / 100);
  const protocolAnnualUsdc =
    grossAnnualUsdc * (input.pair.protocolSharePercent / 100);
  const reserveAnnualUsdc =
    grossAnnualUsdc * (input.pair.reserveSharePercent / 100);
  const dailyUsdc = lpAnnualUsdc / 365;
  const holdingPeriodUsdc = dailyUsdc * safeDays;

  return {
    dailyUsdc,
    grossAnnualUsdc,
    holdingPeriodUsdc,
    lpAnnualUsdc,
    principalUsdc,
    protocolAnnualUsdc,
    reserveAnnualUsdc,
    thirtyDayUsdc: dailyUsdc * 30,
  };
}

export async function getLiquidityPosition(input: {
  boozzTokenAddress: string;
  ownerAddress: Address;
  pair: LiquidityPair;
  vaultAddress: string;
}) {
  const vaultAddress = getVaultAddress(input.vaultAddress);
  const tokenA = getLiquidityToken(input.pair.tokenA, input.boozzTokenAddress);
  const tokenB = getLiquidityToken(input.pair.tokenB, input.boozzTokenAddress);
  const artifact = await import("../../artifacts/BoozzLiquidityVault.json");

  const pairId = (await arcPublicClient.readContract({
    address: vaultAddress,
    abi: artifact.abi,
    functionName: "pairIdFor",
    args: [tokenA.address, tokenB.address],
  })) as Hash;

  const [lpBalance, vaultBalance, vaultUnlockTime] = await Promise.all([
    arcPublicClient.readContract({
      address: vaultAddress,
      abi: artifact.abi,
      functionName: "lpBalanceOf",
      args: [pairId, input.ownerAddress],
    }),
    arcPublicClient.readContract({
      address: vaultAddress,
      abi: artifact.abi,
      functionName: "vaultBalanceOf",
      args: [pairId, input.ownerAddress],
    }),
    arcPublicClient.readContract({
      address: vaultAddress,
      abi: artifact.abi,
      functionName: "vaultUnlockTime",
      args: [pairId, input.ownerAddress],
    }),
  ]);
  const unlockTimestamp = Number(vaultUnlockTime as bigint);
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    lpShares: formatUnits(lpBalance as bigint, 18),
    pairId,
    vaultIsLocked: unlockTimestamp > nowSeconds,
    vaultShares: formatUnits(vaultBalance as bigint, 18),
    vaultUnlockTimestamp: unlockTimestamp,
  };
}
