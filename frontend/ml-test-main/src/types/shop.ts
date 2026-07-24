// src/types/shop.ts
export type Shop = {
  id: string;
  number: string;
  name: string;
  nameEn?: string | null;
  nameVi?: string | null;
  category: string;
  section: string;

  x: number;
  y: number;
  width: number;
  height: number;

  guideX?: number;
  guideY?: number;

  hours?: string;

};
