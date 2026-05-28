export interface Menu {
  menuId: number;
  menuName: string;
  menuNameEn: string;
  menuPrice: number;
  imageUrl: string;
  menuCount?: string; // 수량/무게 정보
}

export interface Category {
  categoryId: number;
  categoryName: string;
  categoryNameEn: string;
  categoryType: string;
  menus: Menu[];
}

export type MenuResponse = Category[];
