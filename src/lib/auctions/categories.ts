export const AUCTION_CATEGORY_VALUES = [
  "PAINTING",
  "SCULPTURE",
  "PHOTOGRAPHY",
  "DIGITAL_ART",
  "MIXED_MEDIA",
  "DRAWING",
] as const;

export type AuctionCategoryValue = (typeof AUCTION_CATEGORY_VALUES)[number];

export const AUCTION_CATEGORY_LABELS: Record<AuctionCategoryValue, string> = {
  PAINTING: "Painting",
  SCULPTURE: "Sculpture",
  PHOTOGRAPHY: "Photography",
  DIGITAL_ART: "Digital Art",
  MIXED_MEDIA: "Mixed Media",
  DRAWING: "Drawing",
};

export const AUCTION_CATEGORY_OPTIONS = AUCTION_CATEGORY_VALUES.map((value) => ({
  value,
  label: AUCTION_CATEGORY_LABELS[value],
}));

export function getAuctionCategoryLabel(value: AuctionCategoryValue): string {
  return AUCTION_CATEGORY_LABELS[value];
}
