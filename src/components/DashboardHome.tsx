"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Address, Hash } from "viem";
import type { WalletTokenBalance } from "@/src/lib/getBalances";
import { getTokenIconSymbol, TokenIcon } from "@/src/components/TokenIcon";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { getArcExplorerTxUrl } from "@/src/lib/explorers";
import {
  enrichTokensWithUsdPrices,
  type PortfolioTokenBalance,
} from "@/src/lib/portfolioPrices";
import type { BridgeChain } from "@/src/lib/bridgeUsdc";
import {
  getNetworkByChainId,
  getNetworkByKey,
  SUPPORTED_NETWORKS,
} from "@/src/lib/networks";
import styles from "./DashboardHome.module.css";

type Activity = {
  id: string;
  type: string;
  asset: string;
  amount: number;
  status: string;
  feeUsd: number;
  txHash: string;
  createdAt: string;
};

type DashboardResponse = {
  activities?: Activity[];
  formatted?: {
    totalValueUsd?: string;
    gasFeeUsd?: string;
  };
  integration?: {
    unifiedBalance?: {
      status?: string;
      balances?: Array<{
        chain: string;
        amount: string;
        status: string;
      }>;
    };
  };
};

type ArcStatus = {
  ok: boolean;
  blockNumber?: string;
  latencyMs: number;
  error?: string;
};

const ACTIONS = [
  {
    href: "/send",
    label: "Send",
    detail: "Move Arc Testnet tokens",
    icon: "send",
  },
  {
    href: "/swap",
    label: "Swap",
    detail: "USDC, EURC, cirBTC",
    icon: "swap",
  },
  {
    href: "/bridge",
    label: "Bridge",
    detail: "CCTP routes to Arc",
    icon: "bridge",
  },
  {
    href: "/gateway",
    label: "Gateway",
    detail: "Unified USDC balance",
    icon: "gateway",
  },
  {
    href: "/liquidity",
    label: "LP / Vault",
    detail: "USDC, EURC, cirBTC, BOOZZ",
    icon: "liquidity",
  },
  {
    href: "/lending",
    label: "Lending",
    detail: "Supply, borrow, repay",
    icon: "lending",
  },
  {
    href: "/buy-usdc",
    label: "Buy USDC",
    detail: "Xendit Test Mode",
    icon: "buy",
  },
] as const;

const DASHBOARD_FETCH_TIMEOUT_MS = 4000;
const REFRESH_INTERVAL_MS = 30000;

type ActionIconName = (typeof ACTIONS)[number]["icon"];

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7H5a3 3 0 0 0 0 6h15v7H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h13v4" />
      <path d="M16 13h5" />
      <path d="M18 11v4" />
    </svg>
  );
}

function TokenLogo({
  fallback,
  symbolOrAsset,
}: {
  fallback: string;
  symbolOrAsset: string;
}) {
  const symbol = getTokenIconSymbol(symbolOrAsset);

  if (symbol) {
    return <TokenIcon size="md" symbol={symbol} />;
  }

  return <span className={styles.tokenBadge}>{fallback}</span>;
}

function XLogoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25h6.826l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v14H4z" fill="#ffffff" />
      <path d="M4 5h16v3.2l-8 5.2-8-5.2z" fill="#EA4335" />
      <path d="M4 8.2v10.3c0 .28.22.5.5.5H7V10.15z" fill="#34A853" />
      <path d="M20 8.2v10.3c0 .28-.22.5-.5.5H17V10.15z" fill="#4285F4" />
      <path d="M7 10.15 4 8.2V6.4l8 5.2 8-5.2v1.8l-3 1.95-5 3.25z" fill="#FBBC04" />
      <path d="M4.5 5h15c.28 0 .5.22.5.5v.9l-8 5.2-8-5.2v-.9c0-.28.22-.5.5-.5Z" fill="#EA4335" />
    </svg>
  );
}

function ActionIcon({ name }: { name: ActionIconName }) {
  if (name === "buy") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16" />
        <path d="M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M9 13h6" />
        <path d="M12 10v6" />
      </svg>
    );
  }

  if (name === "send") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 11.5 15-7-6.7 15-2.2-6-6.1-2Z" />
        <path d="m10.1 13.5 4.2-4.2" />
      </svg>
    );
  }

  if (name === "swap") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7h11l-3-3" />
        <path d="m18 7-3 3" />
        <path d="M17 17H6l3 3" />
        <path d="m6 17 3-3" />
      </svg>
    );
  }

  if (name === "liquidity") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17c3-5 5-5 8 0s5 5 8 0" />
        <path d="M4 7c3 5 5 5 8 0s5-5 8 0" />
        <path d="M12 7v10" />
      </svg>
    );
  }

  if (name === "gateway") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8h16" />
        <path d="M4 16h16" />
        <path d="M7 5v14" />
        <path d="M17 5v14" />
        <path d="M9 12h6" />
      </svg>
    );
  }

  if (name === "lending") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17h16" />
        <path d="M7 17V9" />
        <path d="M12 17V5" />
        <path d="M17 17v-6" />
        <path d="m8 9 4-4 4 4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18v-4a7 7 0 0 1 14 0v4" />
      <path d="M3 18h18" />
      <path d="M8 18v-4a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function getActivityIconName(activity: Activity): ActionIconName | null {
  const value = `${activity.type} ${activity.asset}`.toLowerCase();

  if (value.includes("swap")) return "swap";
  if (value.includes("lp") || value.includes("vault") || value.includes("liquidity")) return "liquidity";
  if (
    value.includes("lend") ||
    value.includes("borrow") ||
    value.includes("repay")
  ) {
    return "lending";
  }
  if (value.includes("bridge")) return "bridge";
  if (value.includes("send") || value.includes("transfer")) return "send";
  if (
    value.includes("buy") ||
    value.includes("xendit") ||
    value.includes("payment")
  ) {
    return "buy";
  }

  return null;
}

function ActivityLogo({ activity }: { activity: Activity }) {
  const iconName = getActivityIconName(activity);

  if (iconName) {
    return (
      <span className={styles.activityActionIcon}>
        <ActionIcon name={iconName} />
      </span>
    );
  }

  return (
    <TokenLogo
      fallback={activity.type.slice(0, 1)}
      symbolOrAsset={activity.asset}
    />
  );
}

function formatAmount(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.000000";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
  });
}

function formatUsd(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "$0.00";
  return value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  });
}

function formatPriceUsd(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "No price";
  return value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 2 : 8,
    minimumFractionDigits: value >= 1 ? 2 : 2,
    style: "currency",
  });
}

function getPriceDisplaySymbol(symbol: string) {
  return symbol.toUpperCase() === "CIRBTC" ? "BTC" : symbol;
}

function formatPriceTime(value?: string) {
  if (!value) return "Live market price";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Live market price";
  return `Price updated ${date.toLocaleTimeString()}`;
}

function formatTime(value?: string) {
  if (!value) return "Live";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Live";
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) {
    return formatter.format(diffHours, "hour");
  }

  return formatter.format(Math.round(diffHours / 24), "day");
}

function hasExplorerHash(txHash: string) {
  return /^0x[a-fA-F0-9]{16,}$/.test(txHash);
}

function getActivityExplorerUrl(activity: Activity) {
  if (!hasExplorerHash(activity.txHash)) return undefined;

  const haystack = `${activity.asset} ${activity.type}`.toLowerCase();
  const network = SUPPORTED_NETWORKS.map((item) => ({
    item,
    index: haystack.indexOf(item.label.toLowerCase()),
  }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)[0]?.item;

  if (network) return `${network.explorerTxUrl}/${activity.txHash}`;
  return getArcExplorerTxUrl(activity.txHash);
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    DASHBOARD_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${url} unavailable`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function getDeployedTokenBalances(
  ownerAddress: Address,
  activities: Activity[],
) {
  const createTxHashes = Array.from(
    new Set(
      activities
        .filter(
          (activity) =>
            activity.type.toLowerCase() === "create" &&
            activity.status.toLowerCase() === "success" &&
            hasExplorerHash(activity.txHash),
        )
        .map((activity) => activity.txHash as Hash),
    ),
  );

  const deployedTokens = await Promise.all(
    createTxHashes.map(async (txHash) => {
      try {
        const [{ arcPublicClient }, { verifyDeployedToken }] =
          await Promise.all([
            import("@/src/lib/arc/viem"),
            import("@/src/lib/deployToken"),
          ]);
        const receipt = await arcPublicClient.getTransactionReceipt({ hash: txHash });
        if (!receipt.contractAddress) return null;

        const token = await verifyDeployedToken(
          receipt.contractAddress,
          ownerAddress,
        );

        return {
          address: receipt.contractAddress,
          balance: Number(token.ownerBalance),
          decimals: token.decimals,
          name: token.name,
          symbol: token.symbol,
        } satisfies WalletTokenBalance;
      } catch {
        return null;
      }
    }),
  );

  const uniqueByAddress = new Map<string, WalletTokenBalance>();
  for (const token of deployedTokens) {
    if (token) uniqueByAddress.set(token.address.toLowerCase(), token);
  }

  return Array.from(uniqueByAddress.values());
}

export function DashboardHome() {
  const {
    ready,
    authenticated,
    login,
    logout,
    address,
    shortAddress,
    chainId,
    switchChain,
  } = useAppWallet();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [arcStatus, setArcStatus] = useState<ArcStatus | null>(null);
  const [walletTokens, setWalletTokens] = useState<PortfolioTokenBalance[]>([]);
  const [selectedNetwork, setSelectedNetwork] =
    useState<BridgeChain>("Arc_Testnet");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Preparing Arc Testnet dashboard...");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);

  useEffect(() => {
    const walletNetwork = getNetworkByChainId(chainId);
    if (walletNetwork) {
      setSelectedNetwork(walletNetwork.key);
    }
  }, [chainId]);

  const refreshWalletAssets = useCallback(
    async (walletAddress: Address, nextActivities: Activity[]) => {
      try {
        const { getArcWalletTokenBalances } = await import(
          "@/src/lib/getBalances"
        );
        const arcWalletTokens = await getArcWalletTokenBalances(walletAddress);
        const deployedTokens = await getDeployedTokenBalances(
          walletAddress,
          nextActivities,
        );
        const pricedTokens = await enrichTokensWithUsdPrices([
          ...arcWalletTokens,
          ...deployedTokens,
        ]);
        setWalletTokens(pricedTokens);
      } catch {
        setWalletTokens([]);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const activityUrl = address
        ? `/api/activity?walletAddress=${encodeURIComponent(address)}`
        : "/api/activity";
      const [nextDashboard, nextStatus, nextActivity] = await Promise.all([
        fetchJsonWithTimeout<DashboardResponse>("/api/dashboard"),
        fetchJsonWithTimeout<ArcStatus>("/api/arc/status"),
        fetchJsonWithTimeout<{ activities?: Activity[] }>(activityUrl),
      ]);

      const nextActivities = nextActivity.activities ?? [];

      setDashboard(nextDashboard);
      setArcStatus(nextStatus);
      setActivities(nextActivities.slice(0, 5));

      if (address) {
        void refreshWalletAssets(address, nextActivities);
      } else {
        setWalletTokens([]);
      }

      setLastUpdated(new Date());
      setStatus(
        nextStatus.ok
          ? `${getNetworkByKey(selectedNetwork)?.label ?? "Selected network"} ready`
          : "Arc RPC degraded",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, [address, refreshWalletAssets, selectedNetwork]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selectedNetworkMeta =
    getNetworkByKey(selectedNetwork) ?? SUPPORTED_NETWORKS[0];
  const pricedTokens = walletTokens.filter(
    (token) => typeof token.valueUsd === "number",
  );
  const totalPortfolioValueUsd = pricedTokens.reduce(
    (total, token) => total + (token.valueUsd ?? 0),
    0,
  );
  const latestPriceUpdate = walletTokens
    .map((token) =>
      token.priceUpdatedAt ? new Date(token.priceUpdatedAt).getTime() : 0,
    )
    .sort((left, right) => right - left)[0];
  const latestPriceUpdateText = latestPriceUpdate
    ? formatPriceTime(new Date(latestPriceUpdate).toISOString())
    : "Live market prices";

  const switchSelectedNetwork = async (networkKey: BridgeChain) => {
    const network = getNetworkByKey(networkKey);
    setSelectedNetwork(networkKey);

    if (!network || !authenticated) return;

    try {
      setStatus(`Switching wallet to ${network.label}...`);
      await switchChain(network.chainId);
      setStatus(`${network.label} selected`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Network switch failed");
    }
  };

  const copyWalletAddress = async () => {
    if (!address) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = address;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1800);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Copy address failed");
    }
  };

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">
          <img
            alt="Boozz FI"
            className={styles.brandLogo}
            src="/boozz-fi-logo-transparent.png"
          />
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          <Link className={`${styles.navItem} ${styles.active}`} href="/">
            <span className={styles.navIcon}>◆</span>
            Dashboard
          </Link>
          <Link className={styles.navItem} href="/send">
            <span className={styles.navIcon}>↗</span>
            Send
          </Link>
          <Link className={styles.navItem} href="/swap">
            <span className={styles.navIcon}>⇄</span>
            Swap
          </Link>
          <Link className={styles.navItem} href="/bridge">
            <span className={styles.navIcon}>BR</span>
            Bridge
          </Link>
          <Link className={styles.navItem} href="/gateway">
            <span className={styles.navIcon}>GW</span>
            Gateway
          </Link>
          <Link className={styles.navItem} href="/liquidity">
            <span className={styles.navIcon}>LP</span>
            LP / Vault
          </Link>
          <Link className={styles.navItem} href="/lending">
            <span className={styles.navIcon}>LD</span>
            Lending
          </Link>
          <Link className={styles.navItem} href="/buy-usdc">
            <span className={styles.navIcon}>$</span>
            Buy USDC
          </Link>
        </nav>

        <div className={styles.sideStatus}>
          <span
            className={
              arcStatus?.ok ? styles.statusDotOnline : styles.statusDotOffline
            }
          />
          <div>
            <strong>{selectedNetworkMeta.label}</strong>
            <span>
              {arcStatus?.blockNumber
                ? selectedNetwork === "Arc_Testnet"
                  ? `Block ${arcStatus.blockNumber}`
                  : `Wallet chain ${chainId ?? "not connected"}`
                : "Syncing"}
            </span>
          </div>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.header}>
          <div className={styles.headerActions}>
            {authenticated ? (
              <>
                <select
                  aria-label="Select network"
                  className={styles.headerNetworkSelect}
                  value={selectedNetwork}
                  onChange={(event) =>
                    switchSelectedNetwork(event.target.value as BridgeChain)
                  }
                >
                  {SUPPORTED_NETWORKS.map((network) => (
                    <option key={network.key} value={network.key}>
                      {network.label}
                    </option>
                  ))}
                </select>
                <a
                  className={styles.faucetButton}
                  href="https://faucet.circle.com/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Faucet
                </a>
                <div className={styles.walletCluster}>
                  <div
                    className={styles.walletButton}
                    aria-label="Connected wallet"
                    title={address ?? "Connected wallet"}
                  >
                    <WalletIcon />
                    <span>{shortAddress ?? "Connected"}</span>
                  </div>
                  <button
                    className={styles.copyAddressButton}
                    disabled={!address}
                    onClick={copyWalletAddress}
                    title="Copy wallet address"
                  >
                    <CopyIcon />
                    <span>{addressCopied ? "Copied" : "Copy"}</span>
                  </button>
                  <button className={styles.disconnectButton} onClick={logout}>
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <select
                  aria-label="Preview network"
                  className={styles.headerNetworkSelect}
                  value={selectedNetwork}
                  onChange={(event) =>
                    setSelectedNetwork(event.target.value as BridgeChain)
                  }
                >
                  {SUPPORTED_NETWORKS.map((network) => (
                    <option key={network.key} value={network.key}>
                      {network.label}
                    </option>
                  ))}
                </select>
                <a
                  className={styles.faucetButton}
                  href="https://faucet.circle.com/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Faucet
                </a>
                <button
                  className={styles.connectButton}
                  disabled={!ready}
                  onClick={login}
                >
                  {ready ? "Connect Wallet" : "Loading Privy"}
                  <WalletIcon />
                </button>
              </>
            )}
          </div>
        </header>

        <div className={styles.grid}>
          <section className={`${styles.panel} ${styles.balancePanel}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.cardLabel}>Portfolio Assets</p>
                <h2>{formatUsd(totalPortfolioValueUsd)}</h2>
                <span className={styles.muted}>
                  {address
                    ? `${latestPriceUpdateText} for wallet ${shortAddress}`
                    : "Connect wallet to read USDC, EURC, and cirBTC value"}
                </span>
              </div>
              <button
                className={styles.pillButton}
                disabled={loading}
                onClick={refresh}
              >
                {loading ? "Refreshing" : "Refresh"}
              </button>
            </div>

            <div className={styles.chart} aria-hidden="true">
              <svg viewBox="0 0 760 180" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1769ff" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 124 C60 74 95 126 145 96 C205 58 218 130 275 98 C337 58 374 70 420 105 C476 147 501 56 569 70 C624 83 633 38 684 54 C720 64 730 35 760 39 L760 180 L0 180 Z"
                  fill="url(#lineFill)"
                />
                <path
                  d="M0 124 C60 74 95 126 145 96 C205 58 218 130 275 98 C337 58 374 70 420 105 C476 147 501 56 569 70 C624 83 633 38 684 54 C720 64 730 35 760 39"
                  fill="none"
                  stroke="#0f4fe6"
                  strokeLinecap="round"
                  strokeWidth="6"
                />
                <circle cx="760" cy="39" fill="#0f4fe6" r="9" />
              </svg>
            </div>

            <div className={styles.portfolioSummary}>
              <div>
                <span>Priced Assets</span>
                <strong>{pricedTokens.length}</strong>
              </div>
              <div>
                <span>Total Coins</span>
                <strong>{walletTokens.length}</strong>
              </div>
            </div>

            <div className={styles.tokenList}>
              {walletTokens.length > 0 ? (
                walletTokens.map((token) => (
                  <div className={styles.tokenItem} key={token.address}>
                    <TokenLogo
                      fallback={token.symbol.slice(0, 2).toUpperCase()}
                      symbolOrAsset={token.symbol}
                    />
                    <span className={styles.tokenMeta}>
                      <strong>{token.symbol}</strong>
                      <small>{token.name}</small>
                    </span>
                    <span className={styles.tokenNumbers}>
                      <strong>{formatUsd(token.valueUsd)}</strong>
                      <small>
                        {formatAmount(token.balance)} {token.symbol} @{" "}
                        {getPriceDisplaySymbol(token.symbol)}{" "}
                        {formatPriceUsd(token.priceUsd)}
                      </small>
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyAssets}>
                  Connect wallet to read Arc Testnet assets.
                </div>
              )}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.actionsPanel}`}>
            <p className={styles.cardLabel}>Quick Actions</p>
            <div className={styles.actions}>
              {ACTIONS.map((action) => (
                <Link className={styles.actionCard} href={action.href} key={action.href}>
                  <span>
                    <strong>{action.label}</strong>
                    <small>{action.detail}</small>
                  </span>
                  <ActionIcon name={action.icon} />
                </Link>
              ))}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.activityPanel}`}>
            <div className={styles.panelHeaderCompact}>
              <p className={styles.cardLabel}>Recent Activity</p>
              <span className={styles.muted}>
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : status}
              </span>
            </div>

            <div className={styles.activityTable}>
              <div className={styles.tableHead}>
                <span>Activity</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Time</span>
              </div>

              {activities.map((activity) => (
                <a
                  className={styles.activityRow}
                  href={getActivityExplorerUrl(activity)}
                  key={activity.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className={styles.assetCell}>
                    <ActivityLogo activity={activity} />
                    <span>
                      <strong>{activity.type}</strong>
                      <small>{activity.asset}</small>
                    </span>
                  </span>
                  <span>{formatAmount(activity.amount)}</span>
                  <span
                    className={
                      activity.status.toLowerCase() === "success"
                        ? styles.success
                        : activity.status.toLowerCase() === "pending"
                          ? styles.pending
                          : styles.failed
                    }
                  >
                    {activity.status}
                  </span>
                  <span>{formatTime(activity.createdAt)}</span>
                </a>
              ))}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.contactPanel}`}>
            <p className={styles.cardLabel}>Contact</p>
            <div className={styles.contactList}>
              <a
                className={styles.contactItem}
                href="https://x.com/BoozzFi"
                rel="noreferrer"
                target="_blank"
              >
                <span className={styles.contactIcon}>
                  <XLogoIcon />
                </span>
                <strong>Official Boozz FI</strong>
              </a>
              <a
                className={styles.contactItem}
                href="https://x.com/tomatpan"
                rel="noreferrer"
                target="_blank"
              >
                <span className={styles.contactIcon}>
                  <XLogoIcon />
                </span>
                <strong>Builder</strong>
              </a>
              <a
                className={styles.contactItem}
                href="mailto:boozzfi@gmail.com"
              >
                <span className={styles.contactIcon}>
                  <GmailIcon />
                </span>
                <strong>boozzfi@gmail.com</strong>
              </a>
            </div>

            <button
              className={styles.supportBubble}
              onClick={() =>
                setStatus("Support is coming soon. Contact Boozz FI by X or email for now.")
              }
            >
              <span>?</span>
              Support
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}
