"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  useCreateWallet,
  usePrivy,
  useWallets,
  type ConnectedWallet,
  type EIP1193Provider,
  type User,
} from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { arcTestnetChain } from "@/src/lib/arc/viem";

export type AppWalletStatus =
  | "loading"
  | "unauthenticated"
  | "missing-wallet"
  | "connected";

export type AppWalletContextValue = {
  ready: boolean;
  walletsReady: boolean;
  authenticated: boolean;
  status: AppWalletStatus;
  user: User | null;
  wallets: ConnectedWallet[];
  wallet: ConnectedWallet | null;
  address: Address | null;
  shortAddress: string | null;
  chainId: number | null;
  isConnected: boolean;
  login: () => void;
  logout: () => Promise<void>;
  requireWallet: () => ConnectedWallet;
  switchChain: (chainId: number) => Promise<void>;
  switchToArc: () => Promise<void>;
  getProvider: () => Promise<EIP1193Provider>;
  getWalletClient: (chain?: Chain) => Promise<WalletClient>;
  getPublicClient: (chain?: Chain) => Promise<PublicClient>;
};

const AppWalletContext = createContext<AppWalletContextValue | null>(null);

type WalletSelectionAccount = {
  address?: string;
  firstVerifiedAt?: Date | string | null;
  latestVerifiedAt?: Date | string | null;
  type: string;
};

function parsePrivyChainId(chainId?: string) {
  if (!chainId) return null;
  if (chainId.startsWith("eip155:")) {
    return Number(chainId.slice("eip155:".length));
  }
  if (chainId.startsWith("0x")) {
    return Number.parseInt(chainId, 16);
  }
  return Number(chainId) || null;
}

function formatAddress(address: Address | null) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;
}

function isEthereumWallet(wallet: ConnectedWallet) {
  return wallet.type === "ethereum";
}

function isPrivyEmbeddedWallet(wallet: ConnectedWallet) {
  return wallet.walletClientType === "privy";
}

function getAccountTimestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getLatestLinkedAccount(user: User | null) {
  const accounts = user?.linkedAccounts as
    | WalletSelectionAccount[]
    | undefined;
  if (!accounts?.length) return null;

  let latest: WalletSelectionAccount | null = null;

  for (const account of accounts) {
    const accountTime =
      getAccountTimestamp(account.latestVerifiedAt) ||
      getAccountTimestamp(account.firstVerifiedAt);
    const latestTime =
      getAccountTimestamp(latest?.latestVerifiedAt) ||
      getAccountTimestamp(latest?.firstVerifiedAt);

    if (accountTime > latestTime) {
      latest = account;
    }
  }

  return latest;
}

function selectAppWallet(wallets: ConnectedWallet[], user: User | null) {
  const ethereumWallets = wallets.filter(isEthereumWallet);
  const embeddedWallet = ethereumWallets.find(isPrivyEmbeddedWallet);
  const externalWallets = ethereumWallets
    .filter((candidate) => !isPrivyEmbeddedWallet(candidate))
    .sort((left, right) => right.connectedAt - left.connectedAt);
  const latestLinkedAccount = getLatestLinkedAccount(user);

  if (latestLinkedAccount?.type === "wallet" && latestLinkedAccount.address) {
    const verifiedAddress = latestLinkedAccount.address.toLowerCase();
    const verifiedWallet = ethereumWallets.find(
      (candidate) => candidate.address.toLowerCase() === verifiedAddress,
    );

    if (verifiedWallet) return verifiedWallet;
  }

  return (
    embeddedWallet ??
    externalWallets.find((candidate) => candidate.linked) ??
    externalWallets[0] ??
    null
  );
}

export function AppWalletProvider({ children }: { children: ReactNode }) {
  const {
    ready,
    authenticated,
    login: openPrivyLogin,
    logout,
    user,
  } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const walletCreationAttempted = useRef(false);

  const wallet = useMemo(() => selectAppWallet(wallets, user), [user, wallets]);
  const address = (wallet?.address ?? null) as Address | null;
  const chainId = parsePrivyChainId(wallet?.chainId);

  useEffect(() => {
    if (!authenticated) {
      walletCreationAttempted.current = false;
      return;
    }

    if (!ready || !walletsReady) return;
    if (walletCreationAttempted.current) return;
    if (wallets.some(isPrivyEmbeddedWallet)) return;

    walletCreationAttempted.current = true;
    createWallet().catch((error) => {
      console.warn("Privy embedded wallet creation skipped", error);
    });
  }, [authenticated, createWallet, ready, wallets, walletsReady]);

  const status = useMemo<AppWalletStatus>(() => {
    if (!ready || !walletsReady) return "loading";
    if (!authenticated) return "unauthenticated";
    if (!wallet) return "missing-wallet";
    return "connected";
  }, [authenticated, ready, wallet, walletsReady]);

  const requireWallet = useCallback(() => {
    if (!wallet) {
      throw new Error("Connect with Privy before continuing.");
    }
    return wallet;
  }, [wallet]);

  const login = useCallback(() => {
    openPrivyLogin();
  }, [openPrivyLogin]);

  const getProvider = useCallback(async () => {
    return requireWallet().getEthereumProvider();
  }, [requireWallet]);

  const switchChain = useCallback(
    async (targetChainId: number) => {
      await requireWallet().switchChain(targetChainId);
    },
    [requireWallet],
  );

  const switchToArc = useCallback(
    async () => switchChain(arcTestnetChain.id),
    [switchChain],
  );

  const getWalletClient = useCallback(
    async (chain: Chain = arcTestnetChain) => {
      const currentWallet = requireWallet();
      const provider = await getProvider();

      return createWalletClient({
        account: currentWallet.address as Address,
        chain,
        transport: custom(provider),
      });
    },
    [getProvider, requireWallet],
  );

  const getPublicClient = useCallback(
    async (chain: Chain = arcTestnetChain) => {
      const provider = await getProvider();
      return createPublicClient({
        chain,
        transport: custom(provider),
      });
    },
    [getProvider],
  );

  const value = useMemo<AppWalletContextValue>(
    () => ({
      ready,
      walletsReady,
      authenticated,
      status,
      user,
      wallets,
      wallet,
      address,
      shortAddress: formatAddress(address),
      chainId,
      isConnected: status === "connected",
      login,
      logout,
      requireWallet,
      switchChain,
      switchToArc,
      getProvider,
      getWalletClient,
      getPublicClient,
    }),
    [
      address,
      authenticated,
      chainId,
      getProvider,
      getPublicClient,
      getWalletClient,
      login,
      logout,
      ready,
      requireWallet,
      status,
      switchChain,
      switchToArc,
      user,
      wallet,
      wallets,
      walletsReady,
    ],
  );

  return (
    <AppWalletContext.Provider value={value}>
      {children}
    </AppWalletContext.Provider>
  );
}

export function useAppWallet() {
  const context = useContext(AppWalletContext);
  if (!context) {
    throw new Error("useAppWallet must be used inside AppWalletProvider.");
  }
  return context;
}
