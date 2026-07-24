// ===========================
// MarketMapPage.tsx
// ===========================
import React, { useMemo } from "react";
import { MapView } from "@/components/market/MapView";
import { ShopDetailsPanel } from "@/components/market/ShopDetailsPanel";
import { marketShops } from "@/data/market-shops";
import { useMapStore } from "@/store/mapStore";
import { useMenuStore } from "@/store/menuStore";

export default function MarketMapPage() {
  const { selectedShopId, isNavigationActive, selectShop, setNavigation } =
    useMapStore();
  const categories = useMenuStore((state) => state.categories);

  const shops = useMemo(() => {
    const translations = new Map(
      categories.map((category) => [
        category.categoryName.replace(/\s+/g, ""),
        category,
      ])
    );

    return marketShops.map((shop) => {
      const category = translations.get(shop.name.replace(/\s+/g, ""));
      return {
        ...shop,
        nameEn: category?.categoryNameEn,
        nameVi: category?.categoryNameVi,
      };
    });
  }, [categories]);

  const currentShop = shops.find((s) => s.id === selectedShopId) || null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[var(--color-map-bg)] touch-none overscroll-none">
      <div className="absolute inset-0 w-full h-full">
        <MapView
          shops={shops}
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
