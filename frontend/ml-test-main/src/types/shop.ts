// src/types/shop.ts
export type Shop = {
  id: string;
  number: string;
  name: string;
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
