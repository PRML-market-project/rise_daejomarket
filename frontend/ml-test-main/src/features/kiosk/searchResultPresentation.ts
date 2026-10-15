import type { Shop } from "../../types/shop";

export type ResultSortMode = "relevance" | "distance";
export type SearchResult = { shop: Shop; number: number; distanceMeters: number };
export const RESULT_PAGE_SIZE = 6;

export function getSearchResultPresentation(shops: Shop[], sortMode: ResultSortMode, distanceForShop: (shop: Shop) => number): SearchResult[] {
  const results = shops.map((shop, relevanceIndex) => ({ shop, relevanceIndex, distanceMeters: distanceForShop(shop) }));
  if (sortMode === "distance") results.sort((a, b) => a.distanceMeters - b.distanceMeters || a.relevanceIndex - b.relevanceIndex);
  return results.map(({ shop, distanceMeters }, index) => ({ shop, distanceMeters, number: index + 1 }));
}

export function getSearchResultPage(results: SearchResult[], page: number) {
  const pageCount = Math.max(1, Math.ceil(results.length / RESULT_PAGE_SIZE));
  const currentPage = Math.max(1, Math.min(page, pageCount));
  const startIndex = (currentPage - 1) * RESULT_PAGE_SIZE;
  // Both the result cards and map tags use this page's global result numbers.
  const visible = results.slice(startIndex, startIndex + RESULT_PAGE_SIZE)
    .map((result, index) => ({ ...result, number: startIndex + index + 1 }));
  return { pageCount, currentPage, visible };
}
