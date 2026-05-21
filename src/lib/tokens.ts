export type Token = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
};

const VERIFIED_BOOZZ_TOKEN_ADDRESS =
  "0xd6b443e56293ce991b17086acf5ec5545e7e1272";

export const TOKENS: Token[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
  },
  {
    symbol: "cirBTC",
    name: "Circle Bitcoin",
    address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
    decimals: 8,
  },
  {
    symbol: "BOOZZ",
    name: "BOOZZ Token",
    address:
      (process.env.NEXT_PUBLIC_BOOZZ_TOKEN_ADDRESS as `0x${string}` | undefined) ||
      VERIFIED_BOOZZ_TOKEN_ADDRESS,
    decimals: 18,
  },
];
