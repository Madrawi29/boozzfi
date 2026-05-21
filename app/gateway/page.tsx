"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import { AmountPercentControls } from "@/src/components/TokenBalanceControls";
import { TokenIcon } from "@/src/components/TokenIcon";
import { TransactionProcessing } from "@/src/components/TransactionNotice";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { recordActivity } from "@/src/lib/activity";
import { getBridgeExplorerTxUrl } from "@/src/lib/explorers";
import {
  depositGatewayUsdc,
  GATEWAY_CHAINS,
  getGatewayChainLabel,
  getGatewayUnifiedBalance,
  spendGatewayUsdc,
  type GatewayChain,
  type GatewaySourceChain,
} from "@/src/lib/gatewayUnifiedBalance";
import { getUsdcBalance } from "@/src/lib/getBalances";

type GatewayMode = "deposit" | "spend";
type GatewayBalance = Awaited<ReturnType<typeof getGatewayUnifiedBalance>>;

function formatUsdc(value: number | string | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);

  if (!Number.isFinite(parsed)) return "0.00";

  return parsed.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
  });
}

function shortAddress(value: string) {
  if (!isAddress(value)) return "Not ready";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function GatewayPage() {
  const { authenticated, login, wallet, address } = useAppWallet();
  const [mode, setMode] = useState<GatewayMode>("deposit");
  const [amount, setAmount] = useState("");
  const [depositChain, setDepositChain] = useState<GatewayChain>("Arc_Testnet");
  const [sourceChain, setSourceChain] = useState<GatewaySourceChain>("Auto");
  const [destinationChain, setDestinationChain] =
    useState<GatewayChain>("Arc_Testnet");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [unifiedBalance, setUnifiedBalance] =
    useState<GatewayBalance | null>(null);
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [txUrl, setTxUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const confirmedBalance = Number(unifiedBalance?.totalConfirmedBalance ?? 0);
  const pendingBalance = Number(unifiedBalance?.totalPendingBalance ?? 0);
  const actionBalance = mode === "deposit" ? walletBalance : confirmedBalance;
  const numericAmount = Number(amount);
  const amountReady = Number.isFinite(numericAmount) && numericAmount > 0;
  const recipientReady = isAddress(recipientAddress);
  const breakdown = useMemo(() => {
    return (
      unifiedBalance?.breakdown.flatMap((account) =>
        account.breakdown.map((chainBalance) => ({
          chain: String(chainBalance.chain),
          confirmed: chainBalance.confirmedBalance,
          depositor: account.depositor,
          pending: chainBalance.pendingBalance,
        })),
      ) ?? []
    );
  }, [unifiedBalance]);

  async function refreshGatewayBalance() {
    if (!wallet) {
      setUnifiedBalance(null);
      return;
    }

    const nextBalance = await getGatewayUnifiedBalance(wallet);
    setUnifiedBalance(nextBalance);
  }

  async function refreshWalletBalance(chain = depositChain) {
    if (!address) {
      setWalletBalance(0);
      return;
    }

    const nextBalance = await getUsdcBalance(address, chain);
    setWalletBalance(nextBalance);
  }

  async function refreshAll(chain = depositChain) {
    try {
      await Promise.all([refreshWalletBalance(chain), refreshGatewayBalance()]);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not refresh Gateway balance.",
      );
    }
  }

  useEffect(() => {
    if (address) {
      setRecipientAddress((current) => current || address);
    }
  }, [address]);

  useEffect(() => {
    void refreshAll(depositChain);
  }, [address, wallet, depositChain]);

  async function handleDeposit() {
    try {
      if (!authenticated || !wallet || !address) {
        login();
        setStatus("Connect with Privy first.");
        return;
      }

      if (!amountReady) {
        setStatus("Enter a valid USDC amount.");
        return;
      }

      setLoading(true);
      setTxHash("");
      setTxUrl("");
      setStatus(`Checking ${getGatewayChainLabel(depositChain)} USDC balance...`);

      const latestBalance = await getUsdcBalance(address, depositChain);
      setWalletBalance(latestBalance);

      if (latestBalance < numericAmount) {
        setStatus("Insufficient USDC on selected source chain.");
        return;
      }

      setStatus("Depositing USDC into Unified Balance...");
      const result = await depositGatewayUsdc(amount, depositChain, wallet);
      const explorerUrl =
        result.explorerUrl ?? getBridgeExplorerTxUrl(depositChain, result.txHash);

      setTxHash(result.txHash);
      setTxUrl(explorerUrl);
      await recordActivity({
        walletAddress: address,
        type: "Gateway Deposit",
        asset: `USDC Unified Balance from ${getGatewayChainLabel(depositChain)}`,
        amount: numericAmount,
        status: "Success",
        txHash: result.txHash,
      });
      await refreshAll(depositChain);
      setStatus("Gateway deposit confirmed.");
    } catch (error) {
      console.error(error);
      if (address) {
        await recordActivity({
          walletAddress: address,
          type: "Gateway Deposit",
          asset: `USDC Unified Balance from ${getGatewayChainLabel(depositChain)}`,
          amount: Number(amount) || 0,
          status: "Failed",
        });
      }
      setStatus(error instanceof Error ? error.message : "Gateway deposit failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSpend() {
    try {
      if (!authenticated || !wallet || !address) {
        login();
        setStatus("Connect with Privy first.");
        return;
      }

      if (!amountReady) {
        setStatus("Enter a valid USDC amount.");
        return;
      }

      if (!recipientReady) {
        setStatus("Enter a valid recipient address.");
        return;
      }

      setLoading(true);
      setTxHash("");
      setTxUrl("");
      setStatus("Checking Unified Balance...");

      const latestUnifiedBalance = await getGatewayUnifiedBalance(wallet);
      setUnifiedBalance(latestUnifiedBalance);
      const latestConfirmed = Number(latestUnifiedBalance.totalConfirmedBalance);

      if (!Number.isFinite(latestConfirmed) || latestConfirmed < numericAmount) {
        setStatus("Insufficient confirmed Unified Balance.");
        return;
      }

      setStatus("Spending USDC from Unified Balance...");
      const result = await spendGatewayUsdc(
        amount,
        sourceChain,
        destinationChain,
        recipientAddress as Address,
        wallet,
      );
      const explorerUrl =
        result.explorerUrl ??
        getBridgeExplorerTxUrl(destinationChain, result.txHash);

      setTxHash(result.txHash);
      setTxUrl(explorerUrl);
      await recordActivity({
        walletAddress: address,
        type: "Gateway Spend",
        asset: `USDC Unified Balance to ${getGatewayChainLabel(destinationChain)}`,
        amount: numericAmount,
        status: "Success",
        txHash: result.txHash,
      });
      await refreshAll(depositChain);
      setStatus("Gateway spend confirmed.");
    } catch (error) {
      console.error(error);
      if (address) {
        await recordActivity({
          walletAddress: address,
          type: "Gateway Spend",
          asset: `USDC Unified Balance to ${getGatewayChainLabel(destinationChain)}`,
          amount: Number(amount) || 0,
          status: "Failed",
        });
      }
      setStatus(error instanceof Error ? error.message : "Gateway spend failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <FeatureHeader title="Gateway" />

        <p className={styles.balanceLine}>
          <span className={styles.tokenSymbolLine}>
            <TokenIcon size="sm" symbol="USDC" />
            Unified Balance
          </span>{" "}
          <b className={styles.balanceValue}>
            {formatUsdc(confirmedBalance)} USDC
          </b>
        </p>

        <div className={styles.defiLayout}>
          <section className={styles.defiActionCard}>
            <div className={styles.lendingTabs}>
              <button
                className={
                  mode === "deposit" ? styles.lendingTabActive : styles.lendingTab
                }
                disabled={loading}
                onClick={() => setMode("deposit")}
              >
                Deposit
              </button>
              <button
                className={
                  mode === "spend" ? styles.lendingTabActive : styles.lendingTab
                }
                disabled={loading}
                onClick={() => setMode("spend")}
              >
                Spend
              </button>
              <button
                className={styles.lendingTab}
                disabled={loading || !wallet}
                onClick={() => refreshAll(depositChain)}
              >
                Refresh
              </button>
            </div>

            {mode === "deposit" ? (
              <label className={styles.defiFieldGroup}>
                <span>Deposit from</span>
                <select
                  value={depositChain}
                  onChange={(event) =>
                    setDepositChain(event.target.value as GatewayChain)
                  }
                >
                  {GATEWAY_CHAINS.map((chain) => (
                    <option key={chain.value} value={chain.value}>
                      {chain.label}
                    </option>
                  ))}
                </select>
                <small>
                  Balance {formatUsdc(walletBalance)} USDC on{" "}
                  {getGatewayChainLabel(depositChain)}
                </small>
              </label>
            ) : (
              <div className={styles.bridgeRouteGrid}>
                <label className={styles.defiFieldGroup}>
                  <span>Source</span>
                  <select
                    value={sourceChain}
                    onChange={(event) =>
                      setSourceChain(event.target.value as GatewaySourceChain)
                    }
                  >
                    <option value="Auto">Auto route</option>
                    {GATEWAY_CHAINS.map((chain) => (
                      <option key={chain.value} value={chain.value}>
                        {chain.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.defiFieldGroup}>
                  <span>Destination</span>
                  <select
                    value={destinationChain}
                    onChange={(event) =>
                      setDestinationChain(event.target.value as GatewayChain)
                    }
                  >
                    {GATEWAY_CHAINS.map((chain) => (
                      <option key={chain.value} value={chain.value}>
                        {chain.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {mode === "spend" && (
              <label className={styles.defiFieldGroup}>
                <span>Recipient</span>
                <input
                  placeholder="0x recipient address"
                  value={recipientAddress}
                  onChange={(event) => setRecipientAddress(event.target.value)}
                />
                <small
                  className={recipientReady ? styles.defiPositive : styles.defiMuted}
                >
                  {recipientReady ? "Valid EVM address" : "Paste a valid wallet address"}
                </small>
              </label>
            )}

            <div className={styles.swapTokenBox}>
              <div className={styles.defiTokenHeader}>
                <span>{mode === "deposit" ? "Deposit amount" : "Spend amount"}</span>
                <strong>Available {formatUsdc(actionBalance)} USDC</strong>
              </div>
              <div className={styles.defiTokenInputRow}>
                <div className={styles.defiAssetSelect}>
                  <TokenIcon symbol="USDC" />
                  <select value="USDC" disabled>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
                <input
                  inputMode="decimal"
                  placeholder="0.0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </div>
            </div>

            <AmountPercentControls
              amount={amount}
              balance={actionBalance}
              disabled={loading}
              onSelectAmount={setAmount}
              symbol="USDC"
            />

            <button
              className={styles.primaryButton}
              disabled={loading}
              onClick={mode === "deposit" ? handleDeposit : handleSpend}
            >
              {loading
                ? "Processing..."
                : mode === "deposit"
                  ? "Deposit to Gateway"
                  : "Spend from Gateway"}
            </button>

            <TransactionProcessing
              active={loading}
              label="Waiting for Gateway transaction to process..."
            />
          </section>

          <aside className={styles.defiQuotePanel}>
            <div className={styles.defiQuoteHero}>
              <span>Gateway Review</span>
              <strong className={styles.tokenHeroLine}>
                <TokenIcon size="sm" symbol="USDC" />
                {amountReady ? formatUsdc(numericAmount) : "0.00"} USDC
              </strong>
              <small>
                {mode === "deposit"
                  ? `${getGatewayChainLabel(depositChain)} to Unified Balance`
                  : `Unified Balance to ${getGatewayChainLabel(destinationChain)}`}
              </small>
            </div>

            <div className={styles.defiInfoList}>
              <div>
                <span>Confirmed</span>
                <strong>{formatUsdc(confirmedBalance)} USDC</strong>
              </div>
              <div>
                <span>Pending</span>
                <strong>{formatUsdc(pendingBalance)} USDC</strong>
              </div>
              <div>
                <span>Recipient</span>
                <strong>
                  {mode === "spend" ? shortAddress(recipientAddress) : "Own account"}
                </strong>
              </div>
              <div>
                <span>Route</span>
                <strong>
                  {mode === "deposit"
                    ? "Gateway deposit"
                    : `${getGatewayChainLabel(sourceChain)} source`}
                </strong>
              </div>
            </div>

            <div className={styles.bridgeSteps}>
              <span>Deposit</span>
              <span>Balance</span>
              <span>Spend</span>
              <span>Mint</span>
            </div>
          </aside>
        </div>

        {breakdown.length > 0 && (
          <section className={styles.lendingMarketTable}>
            <div className={styles.lendingTableHead}>
              <span>Chain</span>
              <span>Confirmed</span>
              <span>Pending</span>
              <span>Account</span>
              <span>Status</span>
            </div>
            {breakdown.map((item) => (
              <div
                className={styles.lendingTableRow}
                key={`${item.depositor}-${item.chain}`}
              >
                <strong>{item.chain}</strong>
                <span>{formatUsdc(item.confirmed)} USDC</span>
                <span>{formatUsdc(item.pending)} USDC</span>
                <span>{shortAddress(item.depositor)}</span>
                <span>Gateway</span>
              </div>
            ))}
          </section>
        )}

        {status && <p className={styles.statusText}>{status}</p>}

        {txHash && txUrl && (
          <p className={styles.txLine}>
            Tx:{" "}
            <a className={styles.link} href={txUrl} rel="noreferrer" target="_blank">
              View transaction
            </a>
          </p>
        )}
      </section>
    </main>
  );
}
