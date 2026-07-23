export interface Menu {
  menuId: number;
  menuName: string;
  menuNameEn: string;
  menuNameVi?: string | null;
  menuPrice: number;
  imageUrl: string;
  menuCount?: string; // 수량/무게 정보
  menuCountVi?: string | null;
}

export interface Category {
  categoryId: number;
  categoryName: string;
  categoryNameEn: string;
  categoryNameVi?: string | null;
  categoryType: string;
  menus: Menu[];
}

export type MenuResponse = Category[];
