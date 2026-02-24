export const AUCTION_CONDITION_VALUES = [
  "MINT",
  "EXCELLENT",
  "VERY_GOOD",
  "GOOD",
  "FAIR",
  "POOR",
] as const;

export type AuctionConditionValue = (typeof AUCTION_CONDITION_VALUES)[number];

export const AUCTION_CONDITION_LABELS: Record<AuctionConditionValue, string> = {
  MINT: "Mint",
  EXCELLENT: "Excellent",
  VERY_GOOD: "Very Good",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

export const AUCTION_CONDITION_OPTIONS = AUCTION_CONDITION_VALUES.map((value) => ({
  value,
  label: AUCTION_CONDITION_LABELS[value],
}));

export function getAuctionConditionLabel(value: string | null | undefined): string {
  if (!value) return "Not specified";
  if (value in AUCTION_CONDITION_LABELS) {
    return AUCTION_CONDITION_LABELS[value as AuctionConditionValue];
  }
  return value;
}
