"use client";

import { useEffect, useState } from "react";
import { parseUnits, type Address } from "viem";
import { FeatureHeader } from "@/src/components/FeatureHeader";
import styles from "@/src/components/FeaturePage.module.css";
import { TransactionProcessing } from "@/src/components/TransactionNotice";
import { useAppWallet } from "@/src/hooks/useAppWallet";
import { recordActivity } from "@/src/lib/activity";
import {
  addTokenToWallet,
  deployToken,
  verifyDeployedToken,
  type DeployedTokenDetails,
} from "@/src/lib/deployToken";
import {
  getArcExplorerAddressUrl,
  getArcExplorerTxUrl,
} from "@/src/lib/explorers";
import { getBalances } from "@/src/lib/getBalances";

const DEPLOY_STEPS = ["Token", "Deploy", "Verify", "Launch"] as const;

function normalizeSupply(value: string) {
  return value.trim().replaceAll(",", "");
}

export default function CreatePage() {
  const { address: walletAddress, login, wallet, switchToArc } = useAppWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000");
  const [status, setStatus] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verifiedToken, setVerifiedToken] =
    useState<DeployedTokenDetails | null>(null);
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setUsdcBalance(0);
      return;
    }

    getBalances(walletAddress)
      .then((balances) => setUsdcBalance(balances.usdc))
      .catch(() => setUsdcBalance(0));
  }, [walletAddress]);

  async function handleDeploy() {
    try {
      if (!wallet) {
        login();
        setStatus("Connect with Privy first.");
        return;
      }

      setLoading(true);
      setActiveStep(1);
      setStatus("Deploying token contract...");
      setContractAddress("");
      setTxHash("");
      setVerifiedToken(null);
      setLaunched(false);

      await switchToArc();
      const normalizedSupply = normalizeSupply(supply);
      const { contractAddress: nextContractAddress, txHash: deployTxHash } =
        await deployToken(name, symbol, normalizedSupply, wallet);

      setContractAddress(nextContractAddress || "");
      setTxHash(deployTxHash);
      setActiveStep(2);
      await recordActivity({
        walletAddress: wallet.address,
        type: "Create",
        asset: `${symbol.trim().toUpperCase() || name.trim()} deploy on Arc Testnet`,
        amount: Number(normalizedSupply),
        status: "Success",
        txHash: deployTxHash,
      });
      setStatus("Token deployed. Verify token details before launch.");
    } catch (error) {
      console.error(error);
      if (wallet) {
        await recordActivity({
          walletAddress: wallet.address,
          type: "Create",
          asset: `${symbol.trim().toUpperCase() || name.trim() || "Token"} deploy on Arc Testnet`,
          amount: Number(normalizeSupply(supply)) || 0,
          status: "Failed",
        });
      }
      setStatus(error instanceof Error ? error.message : "Deploy failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    try {
      if (!contractAddress || !walletAddress) {
        setStatus("Deploy a token before verification.");
        return;
      }

      setLoading(true);
      setStatus("Reading token contract on Arc Testnet...");
      const token = await verifyDeployedToken(
        contractAddress as Address,
        walletAddress,
      );

      const expectedSupply = parseUnits(
        normalizeSupply(supply),
        token.decimals,
      );
      const matchesName = token.name === name.trim();
      const matchesSymbol = token.symbol === symbol.trim().toUpperCase();
      const matchesSupply = token.totalSupplyRaw === expectedSupply;

      setVerifiedToken(token);

      if (!matchesName || !matchesSymbol || !matchesSupply) {
        setStatus("Verification mismatch. Check name, symbol, and supply.");
        return;
      }

      setActiveStep(3);
      setStatus("Token verified. Ready to launch and add asset to wallet.");
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Verify failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    try {
      if (!wallet || !contractAddress || !verifiedToken) {
        setStatus("Verify the deployed token before launch.");
        return;
      }

      setLoading(true);
      setStatus("Adding token asset to the owner wallet...");
      await addTokenToWallet(
        contractAddress as Address,
        verifiedToken.symbol,
        verifiedToken.decimals,
        wallet,
      );
      setLaunched(true);
      setStatus("Token launched and asset request sent to wallet.");
    } catch (error) {
      console.error(error);
      setStatus(
        error instanceof Error
          ? error.message
          : "Wallet did not add the token asset.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <FeatureHeader title="Create Token" />

        <p className={styles.balanceLine}>
          USDC Balance{" "}
          <b className={styles.balanceValue}>{usdcBalance.toFixed(6)} USDC</b>
        </p>

        <div className={styles.wizardGrid}>
          {DEPLOY_STEPS.map((step, index) => (
            <div
              className={index <= activeStep ? styles.stepPillActive : styles.stepPill}
              key={step}
            >
              {step}
            </div>
          ))}
        </div>

        <div className={styles.sectionStack}>
          <section className={styles.sectionCard}>
            <h2>Token</h2>
            <div className={styles.formGrid}>
              <input
                className={styles.field}
                placeholder="Token Name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />

              <input
                className={styles.field}
                placeholder="Symbol"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
              />

              <input
                className={styles.field}
                inputMode="decimal"
                placeholder="Supply"
                value={supply}
                onChange={(event) => setSupply(event.target.value)}
              />
            </div>
          </section>

          <section className={styles.sectionCard}>
            <h2>Deploy</h2>
            <div className={styles.buttonRow}>
              <button
                className={styles.primaryButton}
                disabled={loading}
                onClick={handleDeploy}
              >
                {loading && activeStep <= 1 ? "Deploying..." : "Deploy Token"}
              </button>
            </div>
          </section>

          <section className={styles.sectionCard}>
            <h2>Verify</h2>
            <div className={styles.buttonRow}>
              <button
                className={styles.secondaryButton}
                disabled={loading || !contractAddress}
                onClick={handleVerify}
              >
                Verify Name, Symbol, and Supply
              </button>
            </div>

            {verifiedToken && (
              <div className={styles.verifyGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Name</span>
                  <span className={styles.detailValue}>{verifiedToken.name}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Symbol</span>
                  <span className={styles.detailValue}>
                    {verifiedToken.symbol}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Supply</span>
                  <span className={styles.detailValue}>
                    {verifiedToken.totalSupply}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Owner Balance</span>
                  <span className={styles.detailValue}>
                    {verifiedToken.ownerBalance}
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className={styles.sectionCard}>
            <h2>Launch</h2>
            <div className={styles.buttonRow}>
              <button
                className={styles.primaryButton}
                disabled={loading || !verifiedToken || launched}
                onClick={handleLaunch}
              >
                {launched ? "Launched" : "Add Asset to Owner Wallet"}
              </button>
            </div>
          </section>

          <TransactionProcessing
            active={loading}
            label="Waiting for the deploy workflow to process..."
          />
        </div>

        {status && <p className={styles.statusText}>{status}</p>}

        {contractAddress && (
          <p className={styles.txLine}>
            Contract:{" "}
            <a
              className={styles.link}
              href={getArcExplorerAddressUrl(contractAddress)}
              rel="noreferrer"
              target="_blank"
            >
              View contract
            </a>
          </p>
        )}

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
