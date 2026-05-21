"use client";

import { useEffect, useMemo, useState } from "react";
import type { Address, Hash } from "viem";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import { AmountPercentControls } from "@/src/components/TokenBalanceControls";
import { TokenIcon, TokenPairIcon } from "@/src/components/TokenIcon";
import { TransactionProcessing } from "@/src/components/TransactionNotice";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { recordActivity, updateActivityStatus } from "@/src/lib/activity";
import { getArcExplorerTxUrl } from "@/src/lib/explorers";
import { getBalances, type WalletTokenBalance } from "@/src/lib/getBalances";
import {
  addLiquidityToPair,
  ARC_LIQUIDITY_PAIRS,
  getDefaultBoozzTokenAddress,
  getDefaultLiquidityVaultAddress,
  getLiquidityPosition,
  quoteEqualValueTokenAmount,
  TOKEN_USDC_REFERENCE_PRICE,
  type LiquidityTokenSymbol,
} from "@/src/lib/liquidity";
import { waitForArcTransactionStatus } from "@/src/lib/transactions";

const TOKEN_DISPLAY_NAMES: Record<LiquidityTokenSymbol, string> = {
  BOOZZ: "BOOZZ Token",
  cirBTC: "Circle Bitcoin",
  EURC: "Euro Coin",
  USDC: "USD Coin",
};

type LiquidityPosition = {
  lpShares: string;
  vaultIsLocked: boolean;
  vaultShares: string;
  vaultUnlockTimestamp: number;
};

type LiquidityPositionMap = Partial<Record<string, LiquidityPosition>>;

type Activity = {
  amount: number;
  asset: string;
  status: string;
  type: string;
};

function formatTokenAmount(value: number, symbol: LiquidityTokenSymbol) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: symbol === "cirBTC" ? 8 : 6,
    minimumFractionDigits: symbol === "cirBTC" ? 8 : 0,
  });
}

function formatUsdc(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatUnlockTime(timestamp: number) {
  if (!timestamp) return "No active lock";

  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return "No active lock";

  return date.toLocaleString();
}

function formatReferenceRate(
  fromToken: LiquidityTokenSymbol,
  toToken: LiquidityTokenSymbol,
) {
  return quoteEqualValueTokenAmount({
    amount: "1",
    fromToken,
    toToken,
  });
}

export default function LiquidityPage() {
  const { address, login, wallet, switchToArc } = useAppWallet();
  const [selectedPairId, setSelectedPairId] = useState(ARC_LIQUIDITY_PAIRS[0].id);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<WalletTokenBalance[]>([]);
  const [liquidityPositions, setLiquidityPositions] =
    useState<LiquidityPositionMap>({});
  const [activityLiquidityPositions, setActivityLiquidityPositions] =
    useState<LiquidityPositionMap>({});
  const [positionLoading, setPositionLoading] = useState(false);

  const boozzTokenAddress = getDefaultBoozzTokenAddress();
  const vaultAddress = getDefaultLiquidityVaultAddress();

  const selectedPair = useMemo(
    () =>
      ARC_LIQUIDITY_PAIRS.find((pair) => pair.id === selectedPairId) ??
      ARC_LIQUIDITY_PAIRS[0],
    [selectedPairId],
  );

  const getTokenBalance = (symbol: LiquidityTokenSymbol) =>
    tokenBalances.find((token) => token.symbol === symbol)?.balance ?? 0;

  const maxAmountAForPair = Math.min(
    getTokenBalance(selectedPair.tokenA),
    (getTokenBalance(selectedPair.tokenB) *
      TOKEN_USDC_REFERENCE_PRICE[selectedPair.tokenB]) /
      TOKEN_USDC_REFERENCE_PRICE[selectedPair.tokenA],
  );

  const amountAValueUsdc =
    (Number(amountA) || 0) * TOKEN_USDC_REFERENCE_PRICE[selectedPair.tokenA];
  const amountBValueUsdc =
    (Number(amountB) || 0) * TOKEN_USDC_REFERENCE_PRICE[selectedPair.tokenB];
  const totalDepositValueUsdc = amountAValueUsdc + amountBValueUsdc;
  const estimatedLpShares =
    totalDepositValueUsdc > 0
      ? totalDepositValueUsdc / selectedPair.estimatedShareValueUsdc
      : 0;
  function getEffectiveLiquidityPosition(pairId: string) {
    const contractPosition = liquidityPositions[pairId];
    const activityPosition = activityLiquidityPositions[pairId];
    const contractShares =
      Number(contractPosition?.lpShares ?? 0) +
      Number(contractPosition?.vaultShares ?? 0);

    return contractShares > 0 ? contractPosition : activityPosition;
  }

  const selectedLiquidityPosition =
    getEffectiveLiquidityPosition(selectedPair.id) ?? null;
  const lpSharesValue = Number(selectedLiquidityPosition?.lpShares ?? 0);
  const vaultSharesValue = Number(selectedLiquidityPosition?.vaultShares ?? 0);
  const totalPositionShares = lpSharesValue + vaultSharesValue;
  const totalPositionValueUsdc =
    totalPositionShares * selectedPair.estimatedShareValueUsdc;
  const totalAllPositionValueUsdc = ARC_LIQUIDITY_PAIRS.reduce((total, pair) => {
    const position = getEffectiveLiquidityPosition(pair.id);
    const pairShares =
      Number(position?.lpShares ?? 0) + Number(position?.vaultShares ?? 0);

    return total + pairShares * pair.estimatedShareValueUsdc;
  }, 0);

  async function refreshBalances() {
    if (!address) {
      setTokenBalances([]);
      return;
    }

    getBalances(address as Address)
      .then((balances) => setTokenBalances(balances.tokens))
      .catch(() => setTokenBalances([]));
  }

  async function refreshLiquidityPosition() {
    if (!address) {
      setLiquidityPositions({});
      setActivityLiquidityPositions({});
      return;
    }

    setPositionLoading(true);
    try {
      const [entries] = await Promise.all([
        ARC_LIQUIDITY_PAIRS.map(async (pair) => {
          try {
            const position = await getLiquidityPosition({
              boozzTokenAddress,
              ownerAddress: address as Address,
              pair,
              vaultAddress,
            });

            return [pair.id, position] as const;
          } catch {
            return [pair.id, null] as const;
          }
        }),
        refreshActivityLiquidityPosition(),
      ]);
      const resolvedEntries = await Promise.all(entries);
      const nextPositions: LiquidityPositionMap = {};

      for (const [pairId, position] of resolvedEntries) {
        if (position) nextPositions[pairId] = position;
      }

      setLiquidityPositions(nextPositions);
    } catch {
      setLiquidityPositions({});
    } finally {
      setPositionLoading(false);
    }
  }

  async function refreshActivityLiquidityPosition() {
    if (!address) {
      setActivityLiquidityPositions({});
      return;
    }

    try {
      const response = await fetch(
        `/api/activity?walletAddress=${encodeURIComponent(address)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { activities?: Activity[] };
      const nextPositions: LiquidityPositionMap = {};

      for (const activity of payload.activities ?? []) {
        if (activity.status.toLowerCase() === "failed") continue;
        if (activity.type.toLowerCase() !== "add lp") continue;

        const pair = ARC_LIQUIDITY_PAIRS.find((item) =>
          activity.asset.toLowerCase().includes(item.label.toLowerCase()),
        );
        if (!pair) continue;

        const currentShares = Number(nextPositions[pair.id]?.lpShares ?? 0);
        const estimatedShares =
          (Number(activity.amount) || 0) / pair.estimatedShareValueUsdc;

        nextPositions[pair.id] = {
          lpShares: String(currentShares + estimatedShares),
          vaultIsLocked: false,
          vaultShares: "0",
          vaultUnlockTimestamp: 0,
        };
      }

      setActivityLiquidityPositions(nextPositions);
    } catch {
      setActivityLiquidityPositions({});
    }
  }

  function handleAmountAChange(value: string) {
    setAmountA(value);
    setAmountB(
      quoteEqualValueTokenAmount({
        amount: value,
        fromToken: selectedPair.tokenA,
        toToken: selectedPair.tokenB,
      }),
    );
  }

  function handleAmountBChange(value: string) {
    setAmountB(value);
    setAmountA(
      quoteEqualValueTokenAmount({
        amount: value,
        fromToken: selectedPair.tokenB,
        toToken: selectedPair.tokenA,
      }),
    );
  }

  function handlePairSelect(pairId: string) {
    const nextPair =
      ARC_LIQUIDITY_PAIRS.find((pair) => pair.id === pairId) ??
      ARC_LIQUIDITY_PAIRS[0];

    setSelectedPairId(pairId);
    setAmountB(
      quoteEqualValueTokenAmount({
        amount: amountA,
        fromToken: nextPair.tokenA,
        toToken: nextPair.tokenB,
      }),
    );
  }

  useEffect(() => {
    refreshBalances();
    refreshLiquidityPosition();
  }, [address, selectedPairId]);

  async function handleAddLiquidity() {
    try {
      if (!wallet) {
        login();
        setStatus("Connect with Privy first.");
        return;
      }

      if (!amountA || !amountB || Number(amountA) <= 0 || Number(amountB) <= 0) {
        setStatus("Enter valid amounts for both tokens.");
        return;
      }

      setLoading(true);
      setTxHash("");
      setStatus(`Approving ${selectedPair.label} tokens...`);
      await switchToArc();

      const result = await addLiquidityToPair({
        amountA,
        amountB,
        boozzTokenAddress,
        pair: selectedPair,
        vaultAddress,
        wallet,
      });

      setTxHash(result.txHash);
      await recordActivity({
        walletAddress: wallet.address,
        type: "Add LP",
        asset: `${selectedPair.label} on Arc Testnet`,
        amount: totalDepositValueUsdc,
        status: "Pending",
        txHash: result.txHash,
      });

      setStatus("LP transaction submitted. Waiting for confirmation...");
      const activityStatus = await waitForArcTransactionStatus(result.txHash as Hash);
      await updateActivityStatus(result.txHash, activityStatus);
      setStatus(activityStatus === "Success" ? "Liquidity added." : "Add liquidity failed.");
      await Promise.all([refreshBalances(), refreshLiquidityPosition()]);
    } catch (error) {
      if (wallet) {
        await recordActivity({
          walletAddress: wallet.address,
          type: "Add LP",
          asset: `${selectedPair.label} on Arc Testnet`,
          amount: totalDepositValueUsdc || 0,
          status: "Failed",
        });
      }
      setStatus(error instanceof Error ? error.message : "Add liquidity failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <FeatureHeader title="Liquidity" />

        <div className={styles.dexLiquidityLayout}>
          <section className={styles.dexLiquidityCard}>
            <div className={styles.dexCardHeader}>
              <div>
                <span>Pool</span>
                <strong className={styles.dexPairLabel}>
                  <TokenPairIcon
                    left={selectedPair.tokenA}
                    right={selectedPair.tokenB}
                    size="sm"
                  />
                  {selectedPair.label}
                </strong>
              </div>
              <button
                className={styles.secondaryButton}
                disabled={!address || loading}
                onClick={() => {
                  void refreshBalances();
                  void refreshLiquidityPosition();
                }}
                type="button"
              >
                Refresh
              </button>
            </div>

            <div className={styles.dexPairSelector}>
              {ARC_LIQUIDITY_PAIRS.map((pair) => (
                <button
                  className={
                    pair.id === selectedPair.id
                      ? styles.dexPairButtonActive
                      : styles.dexPairButton
                  }
                  key={pair.id}
                  onClick={() => handlePairSelect(pair.id)}
                  type="button"
                >
                  <strong className={styles.dexPairLabel}>
                    <TokenPairIcon left={pair.tokenA} right={pair.tokenB} size="sm" />
                    {pair.label}
                  </strong>
                  <span>{pair.aprPercent.toFixed(1)}% APR</span>
                </button>
              ))}
            </div>

            <div className={styles.dexTokenInputStack}>
              <label className={styles.dexTokenInput}>
                <span>
                  <b className={styles.tokenSymbolLine}>
                    <TokenIcon size="sm" symbol={selectedPair.tokenA} />
                    {selectedPair.tokenA}
                  </b>
                  <small>{TOKEN_DISPLAY_NAMES[selectedPair.tokenA]}</small>
                </span>
                <input
                  inputMode="decimal"
                  placeholder="0.0"
                  value={amountA}
                  onChange={(event) => handleAmountAChange(event.target.value)}
                />
                <em>
                  Balance {formatTokenAmount(getTokenBalance(selectedPair.tokenA), selectedPair.tokenA)}
                </em>
              </label>

              <div className={styles.dexPairJoin}>+</div>

              <label className={styles.dexTokenInput}>
                <span>
                  <b className={styles.tokenSymbolLine}>
                    <TokenIcon size="sm" symbol={selectedPair.tokenB} />
                    {selectedPair.tokenB}
                  </b>
                  <small>{TOKEN_DISPLAY_NAMES[selectedPair.tokenB]}</small>
                </span>
                <input
                  inputMode="decimal"
                  placeholder="0.0"
                  value={amountB}
                  onChange={(event) => handleAmountBChange(event.target.value)}
                />
                <em>
                  Balance {formatTokenAmount(getTokenBalance(selectedPair.tokenB), selectedPair.tokenB)}
                </em>
              </label>
            </div>

            <AmountPercentControls
              amount={amountA}
              balance={maxAmountAForPair}
              disabled={loading}
              onSelectAmount={handleAmountAChange}
              symbol={selectedPair.tokenA}
            />

            <div className={styles.dexRateBox}>
              <span>Rate</span>
              <strong>
                1 {selectedPair.tokenA} ={" "}
                {formatReferenceRate(selectedPair.tokenA, selectedPair.tokenB)}{" "}
                {selectedPair.tokenB}
              </strong>
            </div>

            <button
              className={styles.primaryButton}
              disabled={loading}
              onClick={handleAddLiquidity}
              type="button"
            >
              {loading ? "Processing..." : `Add Liquidity ${selectedPair.label}`}
            </button>

            <TransactionProcessing
              active={loading}
              label="Waiting for Arc Testnet transaction processing..."
            />
          </section>

          <aside className={styles.dexSummaryPanel}>
            <div className={styles.dexSummaryHero}>
              <span>Selected Pool</span>
              <strong className={styles.tokenHeroLine}>
                <TokenPairIcon
                  left={selectedPair.tokenA}
                  right={selectedPair.tokenB}
                  size="sm"
                />
                {selectedPair.label}
              </strong>
              <small>{selectedPair.vaultName}</small>
            </div>

            <div className={styles.dexSummaryGrid}>
              <div>
                <span>Total deposit</span>
                <strong>${formatUsdc(totalDepositValueUsdc)}</strong>
              </div>
              <div>
                <span>Estimated LP</span>
                <strong>{estimatedLpShares.toFixed(6)}</strong>
              </div>
              <div>
                <span>APR</span>
                <strong>{selectedPair.aprPercent.toFixed(1)}%</strong>
              </div>
              <div>
                <span>LP share</span>
                <strong>{selectedPair.lpProviderSharePercent}%</strong>
              </div>
            </div>

            <div className={styles.dexInfoList}>
              <div>
                <span>Your position</span>
                <strong>${formatUsdc(totalPositionValueUsdc)}</strong>
              </div>
              <div>
                <span>Total all pools</span>
                <strong>${formatUsdc(totalAllPositionValueUsdc)}</strong>
              </div>
              <div>
                <span>Available LP</span>
                <strong>{formatTokenAmount(lpSharesValue, "USDC")} shares</strong>
              </div>
              <div>
                <span>Vault shares</span>
                <strong>{formatTokenAmount(vaultSharesValue, "USDC")} shares</strong>
              </div>
              <div>
                <span>Vault status</span>
                <strong>
                  {positionLoading
                    ? "Reading..."
                    : selectedLiquidityPosition?.vaultIsLocked
                      ? "Locked"
                      : "Unlocked"}
                </strong>
              </div>
              <div>
                <span>Unlock time</span>
                <strong>
                  {formatUnlockTime(selectedLiquidityPosition?.vaultUnlockTimestamp ?? 0)}
                </strong>
              </div>
              <div>
                <span className={styles.tokenSymbolLine}>
                  <TokenIcon size="sm" symbol={selectedPair.tokenA} />
                  {selectedPair.tokenA} price
                </span>
                <strong>
                  ${formatUsdc(TOKEN_USDC_REFERENCE_PRICE[selectedPair.tokenA])}
                </strong>
              </div>
              <div>
                <span className={styles.tokenSymbolLine}>
                  <TokenIcon size="sm" symbol={selectedPair.tokenB} />
                  {selectedPair.tokenB} price
                </span>
                <strong>
                  ${formatUsdc(TOKEN_USDC_REFERENCE_PRICE[selectedPair.tokenB])}
                </strong>
              </div>
              <div>
                <span>Protocol / reserve</span>
                <strong>
                  {selectedPair.protocolSharePercent}% / {selectedPair.reserveSharePercent}%
                </strong>
              </div>
            </div>
          </aside>
        </div>

        <section className={styles.lendingMarketTable}>
          <div className={styles.lendingTableHead}>
            <span>Your LP Position</span>
            <span>Available LP</span>
            <span>Vault</span>
            <span>Value</span>
            <span>Status</span>
          </div>
          {ARC_LIQUIDITY_PAIRS.map((pair) => {
            const position = liquidityPositions[pair.id];
            const availableShares = Number(position?.lpShares ?? 0);
            const vaultShares = Number(position?.vaultShares ?? 0);
            const positionValue =
              (availableShares + vaultShares) * pair.estimatedShareValueUsdc;

            return (
              <button
                className={styles.lendingTableRow}
                key={`lp-position-${pair.id}`}
                onClick={() => handlePairSelect(pair.id)}
                type="button"
              >
                <strong className={styles.dexPairLabel}>
                  <TokenPairIcon left={pair.tokenA} right={pair.tokenB} size="sm" />
                  {pair.label}
                </strong>
                <span>{formatTokenAmount(availableShares, "USDC")}</span>
                <span>{formatTokenAmount(vaultShares, "USDC")}</span>
                <span>${formatUsdc(positionValue)}</span>
                <span>
                  {positionLoading
                    ? "Reading"
                    : position?.vaultIsLocked
                      ? "Locked"
                      : availableShares > 0 || vaultShares > 0
                        ? "Active"
                        : "Empty"}
                </span>
              </button>
            );
          })}
        </section>

        {status && <p className={styles.statusText}>{status}</p>}

        {txHash && (
          <p className={styles.txLine}>
            Tx:{" "}
            <a
              className={styles.link}
              href={getArcExplorerTxUrl(txHash)}
              rel="noreferrer"
              target="_blank"
            >
              View transaction
            </a>
          </p>
        )}
      </section>
    </main>
  );
}
