import type { ConnectedWallet } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  isAddress,
  parseUnits,
  type Address,
} from "viem";
import { arcPublicClient, arcTestnetChain } from "@/src/lib/arc/viem";
import { TOKENS } from "@/src/lib/tokens";

export type LendingTokenSymbol = "USDC" | "EURC" | "cirBTC" | "BOOZZ";

export type LendingContractPosition = {
  borrowLimitUsd: number;
  borrowed: Record<LendingTokenSymbol, number>;
  borrowedUsd: number;
  healthFactor: number;
  supplied: Record<LendingTokenSymbol, number>;
  totalCollateralUsd: number;
};

const LENDING_SYMBOLS: LendingTokenSymbol[] = ["USDC", "EURC", "cirBTC", "BOOZZ"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const VERIFIED_LENDING_VAULT_ADDRESS =
  "0x69f77e2fbb67581e303bec9d4d4ff56be168fcc6";

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

type LendingTokenMeta = {
  address: Address;
  decimals: number;
  symbol: LendingTokenSymbol;
};

export function getDefaultLendingVaultAddress() {
  const value = process.env.NEXT_PUBLIC_BOOZZ_LENDING_VAULT_ADDRESS;
  return value && isAddress(value) ? value : VERIFIED_LENDING_VAULT_ADDRESS;
}

export function isLendingVaultConfigured() {
  return isAddress(getDefaultLendingVaultAddress());
}

function createEmptyPosition() {
  return {
    BOOZZ: 0,
    cirBTC: 0,
    EURC: 0,
    USDC: 0,
  };
}

function getLendingToken(symbol: LendingTokenSymbol): LendingTokenMeta {
  const token = TOKENS.find((item) => item.symbol === symbol);
  if (!token || !isAddress(token.address) || token.address === ZERO_ADDRESS) {
    throw new Error(`${symbol} token address is not configured.`);
  }

  return {
    address: token.address,
    decimals: token.decimals,
    symbol,
  };
}

function getVaultAddress(value?: string): Address {
  const resolvedValue = value || getDefaultLendingVaultAddress();

  if (!isAddress(resolvedValue)) {
    throw new Error("Set NEXT_PUBLIC_BOOZZ_LENDING_VAULT_ADDRESS before using on-chain lending.");
  }

  return resolvedValue;
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
  publicClient: Awaited<ReturnType<typeof getWalletClients>>["publicClient"];
  spender: Address;
  token: LendingTokenMeta;
  walletClient: Awaited<ReturnType<typeof getWalletClients>>["walletClient"];
}) {
  const hash = await input.walletClient.writeContract({
    abi: ERC20_ABI,
    account: input.account,
    address: input.token.address,
    args: [input.spender, input.amount],
    functionName: "approve",
  });

  await input.publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

async function getLendingArtifact() {
  return import("../../artifacts/BoozzLendingVault.json");
}

export async function supplyToLendingVault(input: {
  amount: string;
  symbol: LendingTokenSymbol;
  vaultAddress?: string;
  wallet: ConnectedWallet;
}) {
  const vaultAddress = getVaultAddress(input.vaultAddress);
  const token = getLendingToken(input.symbol);
  const amount = parseUnits(input.amount, token.decimals);
  if (amount <= 0n) throw new Error("Supply amount must be greater than zero.");

  const { account, publicClient, walletClient } = await getWalletClients(input.wallet);
  const balance = await publicClient.readContract({
    abi: ERC20_ABI,
    address: token.address,
    args: [account],
    functionName: "balanceOf",
  });
  if ((balance as bigint) < amount) {
    throw new Error(`Insufficient ${token.symbol} balance.`);
  }

  const approvalHash = await approveToken({
    account,
    amount,
    publicClient,
    spender: vaultAddress,
    token,
    walletClient,
  });
  const artifact = await getLendingArtifact();
  const txHash = await walletClient.writeContract({
    abi: artifact.abi,
    account,
    address: vaultAddress,
    args: [token.address, amount, account],
    functionName: "supply",
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { approvalHash, txHash };
}

export async function borrowFromLendingVault(input: {
  amount: string;
  symbol: LendingTokenSymbol;
  vaultAddress?: string;
  wallet: ConnectedWallet;
}) {
  const vaultAddress = getVaultAddress(input.vaultAddress);
  const token = getLendingToken(input.symbol);
  const amount = parseUnits(input.amount, token.decimals);
  if (amount <= 0n) throw new Error("Borrow amount must be greater than zero.");

  const { account, publicClient, walletClient } = await getWalletClients(input.wallet);
  const artifact = await getLendingArtifact();
  const txHash = await walletClient.writeContract({
    abi: artifact.abi,
    account,
    address: vaultAddress,
    args: [token.address, amount, account],
    functionName: "borrow",
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { txHash };
}

export async function repayLendingVault(input: {
  amount: string;
  symbol: LendingTokenSymbol;
  vaultAddress?: string;
  wallet: ConnectedWallet;
}) {
  const vaultAddress = getVaultAddress(input.vaultAddress);
  const token = getLendingToken(input.symbol);
  const amount = parseUnits(input.amount, token.decimals);
  if (amount <= 0n) throw new Error("Repay amount must be greater than zero.");

  const { account, publicClient, walletClient } = await getWalletClients(input.wallet);
  const approvalHash = await approveToken({
    account,
    amount,
    publicClient,
    spender: vaultAddress,
    token,
    walletClient,
  });
  const artifact = await getLendingArtifact();
  const txHash = await walletClient.writeContract({
    abi: artifact.abi,
    account,
    address: vaultAddress,
    args: [token.address, amount, account],
    functionName: "repay",
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { approvalHash, txHash };
}

export async function getLendingContractPosition(ownerAddress: Address) {
  const vaultAddress = getVaultAddress();
  const artifact = await getLendingArtifact();
  const supplied = createEmptyPosition();
  const borrowed = createEmptyPosition();

  await Promise.all(
    LENDING_SYMBOLS.map(async (symbol) => {
      const token = getLendingToken(symbol);
      const [suppliedRaw, borrowedRaw] = await Promise.all([
        arcPublicClient.readContract({
          abi: artifact.abi,
          address: vaultAddress,
          args: [ownerAddress, token.address],
          functionName: "suppliedOf",
        }),
        arcPublicClient.readContract({
          abi: artifact.abi,
          address: vaultAddress,
          args: [ownerAddress, token.address],
          functionName: "borrowedOf",
        }),
      ]);

      supplied[symbol] = Number(formatUnits(suppliedRaw as bigint, token.decimals));
      borrowed[symbol] = Number(formatUnits(borrowedRaw as bigint, token.decimals));
    }),
  );

  const accountData = (await arcPublicClient.readContract({
    abi: artifact.abi,
    address: vaultAddress,
    args: [ownerAddress],
    functionName: "getAccountData",
  })) as [bigint, bigint, bigint, bigint];

  return {
    borrowLimitUsd: Number(formatUnits(accountData[2], 18)),
    borrowed,
    borrowedUsd: Number(formatUnits(accountData[1], 18)),
    healthFactor:
      accountData[3] === (2n ** 256n) - 1n
        ? Number.POSITIVE_INFINITY
        : Number(formatUnits(accountData[3], 18)),
    supplied,
    totalCollateralUsd: Number(formatUnits(accountData[0], 18)),
  } satisfies LendingContractPosition;
}
