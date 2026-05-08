export type Token = {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
};

export const TOKENS: Token[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
  },
  {
    symbol: "YOYO",
    name: "YOYO Token",
    address: "0xE4d7ea25cBbd9A05B831F4F33313512A98265c9E", // punyamu
    decimals: 18,
  },
];