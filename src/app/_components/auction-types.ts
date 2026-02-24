import { type AuctionCategoryValue } from "~/lib/auctions/categories";

export type OpenAuction = {
  id: string;
  title: string;
  description: string | null;
  category: AuctionCategoryValue;
  dimensions: string | null;
  condition: string | null;
  artworkYear: number | null;
  imagePath: string;
  imageUrl: string | null;
  startPriceCents: number;
  currentPriceCents: number;
  minIncrementCents: number;
  endsAt: Date;
  createdAt: Date;
  bidCount: number;
  seller: {
    id: string;
    name: string | null;
    image: string | null;
  };
};
