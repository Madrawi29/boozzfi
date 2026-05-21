"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import { AmountPercentControls } from "@/src/components/TokenBalanceControls";
import { TokenIcon } from "@/src/components/TokenIcon";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { recordActivity } from "@/src/lib/activity";
import { getArcExplorerTxUrl } from "@/src/lib/explorers";
import { getBalances, type WalletTokenBalance } from "@/src/lib/getBalances";
import {
  borrowFromLendingVault,
  getLendingContractPosition,
  isLendingVaultConfigured,
  repayLendingVault,
  supplyToLendingVault,
} from "@/src/lib/lending";

type LendingMode = "supply" | "borrow" | "repay";
type LendingSymbol = "USDC" | "EURC" | "cirBTC" | "BOOZZ";

type LendingMarket = {
  borrowApy: number;
  collateralFactor: number;
  liquidityUsd: number;
  priceUsd: number;
  supplyApy: number;
  symbol: LendingSymbol;
};

type LendingLedger = {
  borrowed: Record<LendingSymbol, number>;
  supplied: Record<LendingSymbol, number>;
  walletDelta: Record<LendingSymbol, number>;
};

type Activity = {
  amount: number;
  asset: string;
  status: string;
  type: string;
};

const LENDING_MARKETS: LendingMarket[] = [
  {
    borrowApy: 7.8,
    collateralFactor: 0.82,
    liquidityUsd: 1285000,
    priceUsd: 1,
    supplyApy: 4.2,
    symbol: "USDC",
  },
  {
    borrowApy: 8.1,
    collateralFactor: 0.78,
    liquidityUsd: 718000,
    priceUsd: 1,
    supplyApy: 3.9,
    symbol: "EURC",
  },
  {
    borrowApy: 5.4,
    collateralFactor: 0.64,
    liquidityUsd: 496000,
    priceUsd: 100000,
    supplyApy: 2.6,
    symbol: "cirBTC",
  },
  {
    borrowApy: 18.6,
    collateralFactor: 0.42,
    liquidityUsd: 184000,
    priceUsd: 0.3,
    supplyApy: 12.4,
    symbol: "BOOZZ",
  },
];

const EMPTY_POSITION: Record<LendingSymbol, number> = {
  BOOZZ: 0,
  cirBTC: 0,
  EURC: 0,
  USDC: 0,
};

const DEMO_BALANCE: Record<LendingSymbol, number> = {
  BOOZZ: 1000,
  cirBTC: 0.01,
  EURC: 1000,
  USDC: 1000,
};

function formatAmount(value: number, symbol?: LendingSymbol) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: symbol === "cirBTC" ? 8 : 6,
    minimumFractionDigits: symbol === "cirBTC" ? 8 : 2,
  });
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  });
}

function getRiskLabel(healthFactor: number) {
  if (!Number.isFinite(healthFactor)) return "No debt";
  if (healthFactor >= 1.7) return "Healthy";
  if (healthFactor >= 1.2) return "Watch";
  return "Risk";
}

function createEmptyPosition() {
  return { ...EMPTY_POSITION };
}

function createEmptyLedger(): LendingLedger {
  return {
    borrowed: createEmptyPosition(),
    supplied: createEmptyPosition(),
    walletDelta: createEmptyPosition(),
  };
}

function getStorageKey(address?: string | null) {
  return `boozzfi:lending:${address ?? "preview"}`;
}

function normalizePosition(value: unknown): Record<LendingSymbol, number> {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    BOOZZ: Number(record.BOOZZ) || 0,
    cirBTC: Number(record.cirBTC) || 0,
    EURC: Number(record.EURC) || 0,
    USDC: Number(record.USDC) || 0,
  };
}

function parseStoredLedger(value: string | null): LendingLedger {
  if (!value) return createEmptyLedger();

  try {
    const parsed = JSON.parse(value) as Partial<LendingLedger>;

    return {
      borrowed: normalizePosition(parsed.borrowed),
      supplied: normalizePosition(parsed.supplied),
      walletDelta: normalizePosition(parsed.walletDelta),
    };
  } catch {
    return createEmptyLedger();
  }
}

function hasAnyPosition(
  supplied: Record<LendingSymbol, number>,
  borrowed: Record<LendingSymbol, number>,
) {
  return LENDING_MARKETS.some(
    (market) =>
      supplied[market.symbol] > 0 ||
      borrowed[market.symbol] > 0,
  );
}

function getActivitySymbol(activity: Activity): LendingSymbol | null {
  const value = `${activity.asset} ${activity.type}`.toUpperCase();

  if (value.includes("USDC")) return "USDC";
  if (value.includes("EURC")) return "EURC";
  if (value.includes("CIRBTC")) return "cirBTC";
  if (value.includes("BOOZZ")) return "BOOZZ";

  return null;
}

export default function LendingPage() {
  const { address, wallet } = useAppWallet();
  const [mode, setMode] = useState<LendingMode>("supply");
  const [selectedSymbol, setSelectedSymbol] = useState<LendingSymbol>("USDC");
  const [amount, setAmount] = useState("");
  const [approvalHash, setApprovalHash] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<WalletTokenBalance[]>([]);
  const [supplied, setSupplied] =
    useState<Record<LendingSymbol, number>>(createEmptyPosition);
  const [borrowed, setBorrowed] =
    useState<Record<LendingSymbol, number>>(createEmptyPosition);
  const [walletDelta, setWalletDelta] =
    useState<Record<LendingSymbol, number>>(createEmptyPosition);

  const selectedMarket = useMemo(
    () =>
      LENDING_MARKETS.find((market) => market.symbol === selectedSymbol) ??
      LENDING_MARKETS[0],
    [selectedSymbol],
  );

  const chainWalletBalance =
    tokenBalances.find((token) => token.symbol === selectedSymbol)?.balance ?? 0;
  const contractMode = isLendingVaultConfigured();
  const walletBalance = Math.max(
    0,
    chainWalletBalance + walletDelta[selectedSymbol],
  );

  const totalCollateralUsd = LENDING_MARKETS.reduce(
    (total, market) => total + supplied[market.symbol] * market.priceUsd,
    0,
  );
  const borrowLimitUsd = LENDING_MARKETS.reduce(
    (total, market) =>
      total +
      supplied[market.symbol] * market.priceUsd * market.collateralFactor,
    0,
  );
  const borrowedUsd = LENDING_MARKETS.reduce(
    (total, market) => total + borrowed[market.symbol] * market.priceUsd,
    0,
  );
  const availableBorrowUsd = Math.max(0, borrowLimitUsd - borrowedUsd);
  const healthFactor =
    borrowedUsd > 0 ? borrowLimitUsd / borrowedUsd : Number.POSITIVE_INFINITY;
  const selectedDebt = borrowed[selectedSymbol];
  const amountValue = Number(amount) || 0;
  const amountUsd = amountValue * selectedMarket.priceUsd;
  const hasOpenPosition = hasAnyPosition(supplied, borrowed);

  const maxAmount =
    mode === "supply"
      ? walletBalance
      : mode === "borrow"
        ? Math.min(
            selectedMarket.liquidityUsd / selectedMarket.priceUsd,
            availableBorrowUsd / selectedMarket.priceUsd,
          )
        : selectedDebt;

  function saveLedger(nextLedger: LendingLedger) {
    setSupplied(nextLedger.supplied);
    setBorrowed(nextLedger.borrowed);
    setWalletDelta(nextLedger.walletDelta);
    window.localStorage.setItem(getStorageKey(address), JSON.stringify(nextLedger));
  }

  async function refreshBalances() {
    if (!address) {
      setTokenBalances([]);
      return;
    }

    try {
      const balances = await getBalances(address as Address);
      setTokenBalances(balances.tokens);
    } catch {
      setTokenBalances([]);
    }
  }

  async function refreshContractPosition() {
    if (!address || !contractMode) return;

    try {
      const position = await getLendingContractPosition(address as Address);
      if (hasAnyPosition(position.supplied, position.borrowed)) {
        setSupplied(position.supplied);
        setBorrowed(position.borrowed);
      } else {
        await refreshActivityPosition();
      }
      setWalletDelta(createEmptyPosition());
    } catch {
      await refreshActivityPosition();
    }
  }

  async function refreshActivityPosition() {
    if (!address) {
      setSupplied(createEmptyPosition());
      setBorrowed(createEmptyPosition());
      return;
    }

    try {
      const response = await fetch(
        `/api/activity?walletAddress=${encodeURIComponent(address)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { activities?: Activity[] };
      const nextSupplied = createEmptyPosition();
      const nextBorrowed = createEmptyPosition();

      for (const activity of payload.activities ?? []) {
        if (activity.status.toLowerCase() === "failed") continue;

        const symbol = getActivitySymbol(activity);
        if (!symbol) continue;

        if (activity.type.toLowerCase() === "lend") {
          nextSupplied[symbol] += Number(activity.amount) || 0;
        }

        if (activity.type.toLowerCase() === "borrow") {
          nextBorrowed[symbol] += Number(activity.amount) || 0;
        }

        if (activity.type.toLowerCase() === "repay") {
          nextBorrowed[symbol] = Math.max(
            0,
            nextBorrowed[symbol] - (Number(activity.amount) || 0),
          );
        }
      }

      setSupplied(nextSupplied);
      setBorrowed(nextBorrowed);
    } catch {
      setSupplied(createEmptyPosition());
      setBorrowed(createEmptyPosition());
    }
  }

  useEffect(() => {
    refreshBalances();
    refreshContractPosition();
  }, [address, contractMode]);

  useEffect(() => {
    if (contractMode) {
      if (!address) {
        setSupplied(createEmptyPosition());
        setBorrowed(createEmptyPosition());
        setWalletDelta(createEmptyPosition());
      }
      return;
    }

    const storedLedger = parseStoredLedger(
      window.localStorage.getItem(getStorageKey(address)),
    );
    setSupplied(storedLedger.supplied);
    setBorrowed(storedLedger.borrowed);
    setWalletDelta(storedLedger.walletDelta);
  }, [address, contractMode]);

  function updateMode(nextMode: LendingMode) {
    setMode(nextMode);
    setAmount("");
    setApprovalHash("");
    setStatus("");
    setTxHash("");
  }

  async function handleAction() {
    try {
      setApprovalHash("");
      setTxHash("");

      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setStatus("Enter a valid amount.");
        return;
      }

      if (mode === "supply" && amountValue > walletBalance) {
        setStatus(`Insufficient ${selectedSymbol} balance.`);
        return;
      }

      if (mode === "borrow" && amountUsd > availableBorrowUsd) {
        setStatus("Borrow amount is above your available limit.");
        return;
      }

      if (mode === "repay" && amountValue > selectedDebt) {
        setStatus(`Repay amount is above your ${selectedSymbol} debt.`);
        return;
      }

      if (mode === "repay" && amountValue > walletBalance) {
        setStatus(`Insufficient ${selectedSymbol} balance to repay.`);
        return;
      }

      setLoading(true);

      if (contractMode) {
        if (!wallet) {
          setStatus("Connect wallet before using on-chain lending.");
          return;
        }

        const result =
          mode === "supply"
            ? await supplyToLendingVault({
                amount,
                symbol: selectedSymbol,
                wallet,
              })
            : mode === "borrow"
              ? await borrowFromLendingVault({
                  amount,
                  symbol: selectedSymbol,
                  wallet,
                })
              : await repayLendingVault({
                  amount,
                  symbol: selectedSymbol,
                  wallet,
                });

        setApprovalHash(
          "approvalHash" in result && typeof result.approvalHash === "string"
            ? result.approvalHash
            : "",
        );
        setTxHash(result.txHash);
        await Promise.all([refreshBalances(), refreshContractPosition()]);
        await recordActivity({
          walletAddress: wallet.address ?? address ?? undefined,
          type:
            mode === "supply" ? "Lend" : mode === "borrow" ? "Borrow" : "Repay",
          asset: `${selectedSymbol} lending market on Arc Testnet`,
          amount: amountValue,
          status: "Success",
          txHash: result.txHash,
        });
        setStatus(
          `${mode === "supply" ? "Supply" : mode === "borrow" ? "Borrow" : "Repay"} transaction confirmed: ${result.txHash.slice(0, 10)}...`,
        );
        setAmount("");
        return;
      }

      const nextLedger: LendingLedger = {
        borrowed: { ...borrowed },
        supplied: { ...supplied },
        walletDelta: { ...walletDelta },
      };

      if (mode === "supply") {
        nextLedger.supplied[selectedSymbol] += amountValue;
        nextLedger.walletDelta[selectedSymbol] -= amountValue;
      }

      if (mode === "borrow") {
        nextLedger.borrowed[selectedSymbol] += amountValue;
        nextLedger.walletDelta[selectedSymbol] += amountValue;
      }

      if (mode === "repay") {
        nextLedger.borrowed[selectedSymbol] = Math.max(
          0,
          nextLedger.borrowed[selectedSymbol] - amountValue,
        );
        nextLedger.walletDelta[selectedSymbol] -= amountValue;
      }

      saveLedger(nextLedger);

      await recordActivity({
        walletAddress: wallet?.address ?? address ?? undefined,
        type:
          mode === "supply" ? "Lend" : mode === "borrow" ? "Borrow" : "Repay",
        asset: `${selectedSymbol} lending market on Arc Testnet`,
        amount: amountValue,
        status: "Success",
      });

      setStatus(
        mode === "supply"
          ? `${formatAmount(amountValue, selectedSymbol)} ${selectedSymbol} supplied.`
          : mode === "borrow"
            ? `${formatAmount(amountValue, selectedSymbol)} ${selectedSymbol} borrowed.`
            : `${formatAmount(amountValue, selectedSymbol)} ${selectedSymbol} repaid.`,
      );
      setAmount("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Lending action failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleDemoFund() {
    const nextLedger: LendingLedger = {
      borrowed: { ...borrowed },
      supplied: { ...supplied },
      walletDelta: { ...walletDelta },
    };
    nextLedger.walletDelta[selectedSymbol] += DEMO_BALANCE[selectedSymbol];
    saveLedger(nextLedger);
    setStatus(
      `${formatAmount(DEMO_BALANCE[selectedSymbol], selectedSymbol)} ${selectedSymbol} test balance added.`,
    );
  }

  function handleResetPosition() {
    saveLedger(createEmptyLedger());
    setAmount("");
    setApprovalHash("");
    setStatus("Lending position reset.");
    setTxHash("");
  }

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <FeatureHeader title="Lending & Borrowing" />

        <div className={styles.lendingShell}>
          <section className={styles.lendingActionCard}>
            <div className={styles.lendingTabs}>
              {(["supply", "borrow", "repay"] as const).map((item) => (
                <button
                  className={
                    mode === item ? styles.lendingTabActive : styles.lendingTab
                  }
                  key={item}
                  onClick={() => updateMode(item)}
                  type="button"
                >
                  {item === "supply" ? "Supply" : item === "borrow" ? "Borrow" : "Repay"}
                </button>
              ))}
            </div>

            <p className={styles.statusText}>
              {contractMode
                ? "On-chain mode active. Supply, borrow, and repay will use BoozzLendingVault."
                : "Preview mode active. Deploy the lending vault and add NEXT_PUBLIC_BOOZZ_LENDING_VAULT_ADDRESS to enable on-chain lending."}
            </p>

            <div className={styles.lendingMarketGrid}>
              {LENDING_MARKETS.map((market) => (
                <button
                  className={
                    market.symbol === selectedSymbol
                      ? styles.lendingMarketActive
                      : styles.lendingMarket
                  }
                  key={market.symbol}
                  onClick={() => {
                    setSelectedSymbol(market.symbol);
                    setAmount("");
                  }}
                  type="button"
                >
                  <strong className={styles.lendingTokenLine}>
                    <TokenIcon size="sm" symbol={market.symbol} />
                    {market.symbol}
                  </strong>
                  <span>{market.supplyApy.toFixed(1)}% / {market.borrowApy.toFixed(1)}%</span>
                </button>
              ))}
            </div>

            <label className={styles.lendingAmountBox}>
              <span>
                <b className={styles.tokenSymbolLine}>
                  <TokenIcon size="sm" symbol={selectedSymbol} />
                  {selectedSymbol}
                </b>
                <small>
                  {mode === "supply"
                    ? `Wallet ${formatAmount(walletBalance, selectedSymbol)}`
                    : mode === "borrow"
                      ? `Available ${formatAmount(maxAmount, selectedSymbol)}`
                      : `Debt ${formatAmount(selectedDebt, selectedSymbol)}`}
                </small>
              </span>
              <input
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.0"
                value={amount}
              />
            </label>

            <AmountPercentControls
              amount={amount}
              balance={maxAmount}
              disabled={loading}
              onSelectAmount={setAmount}
              symbol={selectedSymbol}
            />

            {!contractMode && (
              <div className={styles.lendingUtilityRow}>
                <button
                  className={styles.secondaryButton}
                  disabled={loading}
                  onClick={handleDemoFund}
                  type="button"
                >
                  Add Test Balance
                </button>
                <button
                  className={styles.secondaryButton}
                  disabled={loading}
                  onClick={handleResetPosition}
                  type="button"
                >
                  Reset Position
                </button>
              </div>
            )}

            <div className={styles.lendingPreviewGrid}>
              <div>
                <span>Value</span>
                <strong>{formatUsd(amountUsd)}</strong>
              </div>
              <div>
                <span>{mode === "supply" ? "Supply APY" : "Borrow APY"}</span>
                <strong>
                  {(mode === "supply"
                    ? selectedMarket.supplyApy
                    : selectedMarket.borrowApy
                  ).toFixed(1)}
                  %
                </strong>
              </div>
              <div>
                <span>Collateral factor</span>
                <strong>{Math.round(selectedMarket.collateralFactor * 100)}%</strong>
              </div>
              <div>
                <span>After action</span>
                <strong>
                  {mode === "borrow"
                    ? formatUsd(Math.max(0, availableBorrowUsd - amountUsd))
                    : mode === "repay"
                      ? formatUsd(Math.min(borrowedUsd, amountUsd))
                      : formatUsd(amountUsd * selectedMarket.collateralFactor)}
                </strong>
              </div>
            </div>

            <button
              className={styles.primaryButton}
              disabled={loading}
              onClick={handleAction}
              type="button"
            >
              {loading
                ? "Processing..."
                : mode === "supply"
                  ? `Supply ${selectedSymbol}`
                  : mode === "borrow"
                    ? `Borrow ${selectedSymbol}`
                    : `Repay ${selectedSymbol}`}
            </button>
          </section>

          <aside className={styles.lendingRiskPanel}>
            <div className={styles.lendingHealthHero}>
              <span>Health Factor</span>
              <strong>
                {Number.isFinite(healthFactor) ? healthFactor.toFixed(2) : "--"}
              </strong>
              <small>{getRiskLabel(healthFactor)}</small>
            </div>

            <div className={styles.lendingMetricGrid}>
              <div>
                <span>Collateral</span>
                <strong>{formatUsd(totalCollateralUsd)}</strong>
              </div>
              <div>
                <span>Borrowed</span>
                <strong>{formatUsd(borrowedUsd)}</strong>
              </div>
              <div>
                <span>Borrow limit</span>
                <strong>{formatUsd(borrowLimitUsd)}</strong>
              </div>
              <div>
                <span>Available</span>
                <strong>{formatUsd(availableBorrowUsd)}</strong>
              </div>
            </div>

            <div className={styles.lendingPositionList}>
              {LENDING_MARKETS.map((market) => (
                <div key={market.symbol}>
                  <span className={styles.tokenSymbolLine}>
                    <TokenIcon size="sm" symbol={market.symbol} />
                    {market.symbol}
                  </span>
                  <strong>
                    Supplied {formatAmount(supplied[market.symbol], market.symbol)}
                  </strong>
                  <small>
                    Borrowed {formatAmount(borrowed[market.symbol], market.symbol)}
                  </small>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <section className={styles.lendingMarketTable}>
          <div className={styles.lendingTableHead}>
            <span>Your Position</span>
            <span>Supplied</span>
            <span>Borrowed</span>
            <span>Net Value</span>
            <span>Wallet</span>
          </div>
          {LENDING_MARKETS.map((market) => {
            const suppliedAmount = supplied[market.symbol];
            const borrowedAmount = borrowed[market.symbol];
            const walletAmount =
              tokenBalances.find((token) => token.symbol === market.symbol)
                ?.balance ?? 0;
            const netValueUsd =
              (suppliedAmount - borrowedAmount) * market.priceUsd;

            return (
              <button
                className={styles.lendingTableRow}
                key={`position-${market.symbol}`}
                onClick={() => setSelectedSymbol(market.symbol)}
                type="button"
              >
                <strong className={styles.tokenSymbolLine}>
                  <TokenIcon size="sm" symbol={market.symbol} />
                  {market.symbol}
                </strong>
                <span>{formatAmount(suppliedAmount, market.symbol)}</span>
                <span>{formatAmount(borrowedAmount, market.symbol)}</span>
                <span>{formatUsd(netValueUsd)}</span>
                <span>{formatAmount(walletAmount, market.symbol)}</span>
              </button>
            );
          })}
          {!hasOpenPosition && (
            <p className={styles.statusText}>
              No supplied or borrowed assets yet. Your positions will appear here after a confirmed transaction.
            </p>
          )}
        </section>

        <section className={styles.lendingMarketTable}>
          <div className={styles.lendingTableHead}>
            <span>Market</span>
            <span>Supply APY</span>
            <span>Borrow APY</span>
            <span>Liquidity</span>
            <span>Collateral</span>
          </div>
          {LENDING_MARKETS.map((market) => (
            <button
              className={styles.lendingTableRow}
              key={market.symbol}
              onClick={() => setSelectedSymbol(market.symbol)}
              type="button"
            >
              <strong className={styles.tokenSymbolLine}>
                <TokenIcon size="sm" symbol={market.symbol} />
                {market.symbol}
              </strong>
              <span>{market.supplyApy.toFixed(1)}%</span>
              <span>{market.borrowApy.toFixed(1)}%</span>
              <span>{formatUsd(market.liquidityUsd)}</span>
              <span>{Math.round(market.collateralFactor * 100)}%</span>
            </button>
          ))}
        </section>

        {status && <p className={styles.statusText}>{status}</p>}

        {(approvalHash || txHash) && (
          <div className={styles.txLine}>
            {approvalHash && (
              <span>
                Approval:{" "}
                <a
                  className={styles.link}
                  href={getArcExplorerTxUrl(approvalHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  View approval
                </a>
              </span>
            )}
            {txHash && (
              <span>
                Tx:{" "}
                <a
                  className={styles.link}
                  href={getArcExplorerTxUrl(txHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  View transaction
                </a>
              </span>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
