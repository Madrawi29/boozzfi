import styles from "@/src/components/FeaturePage.module.css";
import { TokenIcon, type TokenIconSymbol } from "@/src/components/TokenIcon";
import type { WalletTokenBalance } from "@/src/lib/getBalances";

const AMOUNT_PRESETS = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "Max", value: 1 },
] as const;

function formatTokenAmount(value: number, symbol: string) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: symbol === "cirBTC" ? 8 : 6,
    minimumFractionDigits: 0,
    useGrouping: false,
  });
}

function getTokenDisplayValue(value: number, symbol: string) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: symbol === "cirBTC" ? 8 : 6,
    minimumFractionDigits: symbol === "cirBTC" ? 8 : 2,
  });
}

export function TokenBalanceGrid({
  balances,
}: {
  balances: WalletTokenBalance[];
}) {
  const expectedSymbols: TokenIconSymbol[] = ["USDC", "EURC", "cirBTC", "BOOZZ"];

  return (
    <div className={styles.tokenBalanceGrid}>
      {expectedSymbols.map((symbol) => {
        const token = balances.find((item) => item.symbol === symbol);
        return (
          <div className={styles.tokenBalanceItem} key={symbol}>
            <span className={styles.tokenBalanceAsset}>
              <TokenIcon size="sm" symbol={symbol} />
              {symbol}
            </span>
            <strong>{getTokenDisplayValue(token?.balance ?? 0, symbol)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function AmountPercentControls({
  amount,
  balance,
  disabled,
  onSelectAmount,
  symbol,
}: {
  amount?: string;
  balance: number;
  disabled?: boolean;
  onSelectAmount: (amount: string) => void;
  symbol: string;
}) {
  const numericAmount = Number(amount);
  const selectedPercent =
    balance > 0 && Number.isFinite(numericAmount) && numericAmount > 0
      ? Math.min(100, (numericAmount / balance) * 100)
      : 0;

  return (
    <div className={styles.percentControlStack}>
      <div className={styles.percentMeta}>
        <span>
          {selectedPercent > 0
            ? `${selectedPercent.toFixed(selectedPercent < 1 ? 2 : 0)}% selected`
            : "Manual or percent"}
        </span>
        <strong>Max {formatTokenAmount(balance, symbol)} {symbol}</strong>
      </div>
      <div className={styles.percentControls}>
        {AMOUNT_PRESETS.map((preset) => {
          const presetAmount = formatTokenAmount(balance * preset.value, symbol);

          return (
            <button
              className={styles.percentButton}
              disabled={disabled || balance <= 0}
              key={preset.label}
              onClick={() => onSelectAmount(presetAmount)}
              type="button"
            >
              <span>{preset.label}</span>
              <small>{presetAmount}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
