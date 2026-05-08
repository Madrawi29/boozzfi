export function money(value: number, digits = 2) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function shortenHash(value: string | null | undefined) {
  if (!value || !value.startsWith("0x") || value.length < 14) {
    return value || "";
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
