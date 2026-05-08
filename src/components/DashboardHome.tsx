"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Address, Hash } from "viem";
import {
  getArcWalletTokenBalances,
  getBalances,
  getUsdcBalance,
  type WalletTokenBalance,
} from "@/src/lib/getBalances";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { verifyDeployedToken } from "@/src/lib/deployToken";
import { getArcExplorerTxUrl } from "@/src/lib/explorers";
import { arcPublicClient } from "@/src/lib/arc/viem";
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
] as const;

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

function ActionIcon({ name }: { name: (typeof ACTIONS)[number]["icon"] }) {
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

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 18v-4a7 7 0 0 1 14 0v4" />
      <path d="M3 18h18" />
      <path d="M8 18v-4a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function formatAmount(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0.000000";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
  });
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
  const [arcUsdc, setArcUsdc] = useState<number | null>(null);
  const [walletTokens, setWalletTokens] = useState<WalletTokenBalance[]>([]);
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const activityUrl = address
        ? `/api/activity?walletAddress=${encodeURIComponent(address)}`
        : "/api/activity";
      const [dashboardResponse, statusResponse, activityResponse] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/arc/status", { cache: "no-store" }),
        fetch(activityUrl, { cache: "no-store" }),
      ]);

      if (!dashboardResponse.ok) throw new Error("Dashboard API unavailable");
      if (!statusResponse.ok) throw new Error("Arc status API unavailable");
      if (!activityResponse.ok) throw new Error("Activity API unavailable");

      const nextDashboard =
        (await dashboardResponse.json()) as DashboardResponse;
      const nextStatus = (await statusResponse.json()) as ArcStatus;
      const nextActivity = (await activityResponse.json()) as {
        activities?: Activity[];
      };
      const nextActivities = nextActivity.activities ?? [];

      setDashboard(nextDashboard);
      setArcStatus(nextStatus);
      setActivities(nextActivities.slice(0, 5));

      if (address) {
        try {
          const arcWalletTokens = await getArcWalletTokenBalances(address);
          const deployedTokens = await getDeployedTokenBalances(
            address,
            nextActivities,
          );
          setWalletTokens([...arcWalletTokens, ...deployedTokens]);

          if (selectedNetwork === "Arc_Testnet") {
            const balances = await getBalances(address);
            setArcUsdc(balances.usdc);
          } else {
            setArcUsdc(await getUsdcBalance(address, selectedNetwork));
          }
        } catch {
          setArcUsdc(null);
          setWalletTokens([]);
        }
      } else {
        setArcUsdc(null);
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
  }, [address, selectedNetwork]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const unifiedBalances =
    dashboard?.integration?.unifiedBalance?.balances?.slice(0, 3) ?? [];
  const selectedNetworkMeta =
    getNetworkByKey(selectedNetwork) ?? SUPPORTED_NETWORKS[0];

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
            <span className={styles.navIcon}>⌁</span>
            Bridge
          </Link>
          <Link className={styles.navItem} href="/create">
            <span className={styles.navIcon}>+</span>
            Deploy
          </Link>
        </nav>

        <div className={styles.socialLinks}>
          <a
            className={styles.xLink}
            href="https://x.com/BoozzFi"
            rel="noreferrer"
            target="_blank"
          >
            <span>X</span>
            Official Boozz FI
          </a>
          <a
            className={styles.xLink}
            href="https://x.com/tomatpan"
            rel="noreferrer"
            target="_blank"
          >
            <span>X</span>
            Builder
          </a>
        </div>

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
          <div>
            <h1>Portfolio Overview</h1>
          </div>

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
                <p className={styles.cardLabel}>Total Balance</p>
                <h2>{formatAmount(arcUsdc ?? 0)} USDC</h2>
                <span className={styles.muted}>
                  {address
                    ? `Live ${selectedNetworkMeta.label} wallet ${shortAddress}`
                    : `Connect wallet to read ${selectedNetworkMeta.label} balance`}
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
                    <span className={styles.assetIcon}>{activity.type.slice(0, 1)}</span>
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

          <section className={`${styles.panel} ${styles.assetsPanel}`}>
            <div className={styles.panelHeaderCompact}>
              <p className={styles.cardLabel}>Wallet Assets</p>
            </div>

            <div className={styles.tokenList}>
              {walletTokens.length > 0 ? (
                walletTokens.map((token) => (
                  <div className={styles.tokenItem} key={token.address}>
                    <span className={styles.tokenBadge}>
                      {token.symbol.slice(0, 2).toUpperCase()}
                    </span>
                    <span className={styles.tokenMeta}>
                      <strong>{token.symbol}</strong>
                      <small>{token.name}</small>
                    </span>
                    <strong>{formatAmount(token.balance)}</strong>
                  </div>
                ))
              ) : (
                <div className={styles.emptyAssets}>
                  Connect wallet to read Arc Testnet assets.
                </div>
              )}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.networkPanel}`}>
            <div className={styles.panelHeaderCompact}>
              <p className={styles.cardLabel}>Realtime Network</p>
              <select
                className={styles.networkSelect}
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
            </div>
            <div className={styles.metricGrid}>
              <div>
                <span>Network</span>
                <strong>{selectedNetworkMeta.label}</strong>
              </div>
              <div>
                <span>Arc RPC</span>
                <strong>{arcStatus?.ok ? "Online" : "Degraded"}</strong>
              </div>
              <div>
                <span>Wallet Chain</span>
                <strong>{chainId ?? "..."}</strong>
              </div>
              <div>
                <span>Selected ID</span>
                <strong>{selectedNetworkMeta.chainId}</strong>
              </div>
            </div>
            <p className={styles.statusLine}>
              {authenticated
                ? status
                : "Connect Privy wallet to switch networks automatically."}
            </p>
          </section>

          <section className={`${styles.panel} ${styles.unifiedPanel}`}>
            <p className={styles.cardLabel}>Unified Balance</p>
            <div className={styles.balanceList}>
              {unifiedBalances.length > 0 ? (
                unifiedBalances.map((item) => (
                  <div className={styles.balanceItem} key={`${item.chain}-${item.status}`}>
                    <span>{item.chain}</span>
                    <strong>{item.amount}</strong>
                  </div>
                ))
              ) : (
                <div className={styles.balanceItem}>
                  <span>Gateway</span>
                  <strong>Ready</strong>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
