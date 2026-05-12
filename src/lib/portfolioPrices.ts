import type { WalletTokenBalance } from "./getBalances";

export type PortfolioTokenBalance = WalletTokenBalance & {
  priceSource: "CoinGecko" | "Fallback" | "Unavailable";
  priceUpdatedAt?: string;
  priceUsd: number | null;
  valueUsd: number | null;
};

type CoinGeckoPrice = {
  last_updated_at?: number;
  usd?: number;
};

type CoinGeckoResponse = Record<string, CoinGeckoPrice | undefined>;

const COINGECKO_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,euro-coin,bitcoin&vs_currencies=usd&include_last_updated_at=true&precision=full";

const TOKEN_PRICE_IDS: Record<string, string> = {
  BTC: "bitcoin",
  // cirBTC is a wrapped/testnet representation, so portfolio value follows live BTC/USD.
  CIRBTC: "bitcoin",
  EURC: "euro-coin",
  USDC: "usd-coin",
};

const FALLBACK_PRICES_USD: Record<string, number> = {
  BTC: 0,
  CIRBTC: 0,
  EURC: 1.08,
  USDC: 1,
};

const PRICE_FETCH_TIMEOUT_MS = 2500;

function getPriceKey(symbol: string) {
  return TOKEN_PRICE_IDS[symbol.toUpperCase()];
}

function getFallbackPrice(symbol: string) {
  return FALLBACK_PRICES_USD[symbol.toUpperCase()];
}

function formatUpdatedAt(timestamp?: number) {
  if (!timestamp) return undefined;
  return new Date(timestamp * 1000).toISOString();
}

export async function enrichTokensWithUsdPrices(
  tokens: WalletTokenBalance[],
): Promise<PortfolioTokenBalance[]> {
  let prices: CoinGeckoResponse = {};

  try {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      PRICE_FETCH_TIMEOUT_MS,
    );
    const response = await fetch(COINGECKO_PRICE_URL, {
      cache: "no-store",
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (response.ok) {
      prices = (await response.json()) as CoinGeckoResponse;
    }
  } catch {
    prices = {};
  }

  return tokens.map((token) => {
    const priceKey = getPriceKey(token.symbol);
    const livePrice = priceKey ? prices[priceKey] : undefined;
    const fallbackPrice = getFallbackPrice(token.symbol);
    const priceUsd =
      typeof livePrice?.usd === "number" && Number.isFinite(livePrice.usd)
        ? livePrice.usd
        : typeof fallbackPrice === "number" && fallbackPrice > 0
          ? fallbackPrice
          : null;

    return {
      ...token,
      priceSource: livePrice?.usd
        ? "CoinGecko"
        : priceUsd
          ? "Fallback"
          : "Unavailable",
      priceUpdatedAt: formatUpdatedAt(livePrice?.last_updated_at),
      priceUsd,
      valueUsd: priceUsd === null ? null : token.balance * priceUsd,
    };
  });
}
