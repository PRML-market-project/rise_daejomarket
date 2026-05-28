// ===========================
// MarketMapPage.tsx
// ===========================
import React from "react";
import { MapView } from "@/components/market/MapView";
import { ShopDetailsPanel } from "@/components/market/ShopDetailsPanel";
import { marketShops } from "@/data/market-shops";
import { useMapStore } from "@/store/mapStore";

export default function MarketMapPage() {
  const { selectedShopId, isNavigationActive, selectShop, setNavigation } =
    useMapStore();

  const currentShop = marketShops.find((s) => s.id === selectedShopId) || null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--color-map-bg)] touch-none overscroll-none">
      <div className="absolute inset-0 w-full h-full">
        <MapView
          shops={marketShops}
          selectedShopId={selectedShopId}
          onShopSelect={selectShop}
          showNavigation={isNavigationActive}
          // ✅ SVG 안에 팝업을 넣기 위해 JSX를 전달
          overlay={
            currentShop ? (
              <ShopDetailsPanel
                shop={currentShop}
                isNavigating={isNavigationActive}
                onStartNavigation={() => setNavigation(!isNavigationActive)}
                onClose={() => selectShop(null)}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}
