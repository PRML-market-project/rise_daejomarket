import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const assets = {
  logo: { path: ["figma", "daecho-logo.svg"], type: "image/svg+xml" },
  thumbnail: { path: ["figma", "search-result-food.png"], type: "image/png" },
  map: { path: ["images", "daejomarket-map.svg"], type: "image/svg+xml" },
} as const;

export async function GET(_: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const asset = assets[name as keyof typeof assets];
  if (!asset) return new NextResponse("Not found", { status: 404 });

  const assetPath = path.join(process.cwd(), "..", "frontend", "ml-test-main", "public", ...asset.path);
  try {
    const body = await readFile(assetPath);
    return new NextResponse(body, {
      headers: { "Content-Type": asset.type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new NextResponse("Asset unavailable", { status: 404 });
  }
}
