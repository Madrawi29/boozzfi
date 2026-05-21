import styles from "@/src/components/TokenIcon.module.css";

export type TokenIconSymbol = "USDC" | "EURC" | "cirBTC" | "BOOZZ";

type TokenIconSize = "sm" | "md" | "lg";

const TOKEN_LOGO_SRC: Record<TokenIconSymbol, string> = {
  BOOZZ: "/token-boozz.png",
  cirBTC: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=040",
  EURC: "https://cryptologos.cc/logos/euro-coin-euroc-logo.svg?v=040",
  USDC: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg?v=040",
};

function getTokenClass(symbol: TokenIconSymbol) {
  if (symbol === "USDC") return styles.usdc;
  if (symbol === "EURC") return styles.eurc;
  if (symbol === "cirBTC") return styles.cirbtc;
  return styles.boozz;
}

export function isTokenIconSymbol(value: string): value is TokenIconSymbol {
  return value === "USDC" || value === "EURC" || value === "cirBTC" || value === "BOOZZ";
}

export function getTokenIconSymbol(value: string): TokenIconSymbol | null {
  const normalized = value.toLowerCase();

  if (normalized.includes("boozz")) return "BOOZZ";
  if (normalized.includes("cirbtc") || normalized.includes("btc")) return "cirBTC";
  if (normalized.includes("eurc") || normalized.includes("euro")) return "EURC";
  if (normalized.includes("usdc") || normalized.includes("usd coin")) return "USDC";

  return null;
}

export function TokenIcon({
  className,
  size = "md",
  symbol,
}: {
  className?: string;
  size?: TokenIconSize;
  symbol: TokenIconSymbol;
}) {
  const classNames = [
    styles.tokenIcon,
    styles[size],
    getTokenClass(symbol),
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span aria-label={`${symbol} token`} className={classNames} title={symbol}>
      <img alt="" aria-hidden="true" src={TOKEN_LOGO_SRC[symbol]} />
    </span>
  );
}

export function TokenPairIcon({
  left,
  right,
  size = "md",
}: {
  left: TokenIconSymbol;
  right: TokenIconSymbol;
  size?: TokenIconSize;
}) {
  return (
    <span className={styles.pair} title={`${left} / ${right}`}>
      <TokenIcon size={size} symbol={left} />
      <TokenIcon size={size} symbol={right} />
    </span>
  );
}
