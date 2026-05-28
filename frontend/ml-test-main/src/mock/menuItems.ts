// src/mocks/menuStores.ts

type ResMenu = {
  menu_id: number;
  category_id: number;
  menu_name: string;
  menu_name_en: string;
  menu_price: number;
  menu_img_url: string;
};

export const mockMenuItems: ResMenu[] = [
  // 메인 메뉴 (category_id: 0)
  {
    menu_id: 0,
    category_id: 3,
    menu_name: '삼겹살',
    menu_name_en: 'porkbelly',
    menu_price: 18000,
    menu_img_url: 'https://via.placeholder.com/150/FFB6C1/FFFFFF?text=삼겹살',
  },
  {
    menu_id: 1,
    category_id: 3,
    menu_name: '목살',
    menu_name_en: 'porkneck',
    menu_price: 17000,
    menu_img_url: 'https://via.placeholder.com/150/FFB6C1/FFFFFF?text=목살',
  },
  {
    menu_id: 2,
    category_id: 3,
    menu_name: '볶음밥',
    menu_name_en: 'fried rice',
    menu_price: 8000,
    menu_img_url: 'https://via.placeholder.com/150/FFB6C1/FFFFFF?text=볶음밥',
  },

  // 음료 (category_id: 1)
  {
    menu_id: 3,
    category_id: 1,
    menu_name: '콜라',
    menu_name_en: 'coke',
    menu_price: 2000,
    menu_img_url: 'https://via.placeholder.com/150/87CEEB/FFFFFF?text=콜라',
  },
  {
    menu_id: 4,
    category_id: 1,
    menu_name: '사이다',
        menu_name_en: 'sprite',
    menu_price: 2000,
    menu_img_url: 'https://via.placeholder.com/150/87CEEB/FFFFFF?text=사이다',
  },
  {
    menu_id: 5,
    category_id: 1,
    menu_name: '물',
    menu_name_en: 'water',
    menu_price: 1000,
    menu_img_url: 'https://via.placeholder.com/150/87CEEB/FFFFFF?text=물',
  },
  {
    menu_id: 11,
    category_id: 1,
    menu_name: '테스트',
    menu_name_en: '테스트',
    menu_price: 1000,
    menu_img_url: 'https://via.placeholder.com/150/87CEEB/FFFFFF?text=물',
  },
  // 주류 (category_id: 2)
  {
    menu_id: 6,
    category_id: 2,
    menu_name: '참이슬',
    menu_name_en: 'chamiseul',
    menu_price: 4000,
    menu_img_url: 'https://via.placeholder.com/150/FFD700/FFFFFF?text=참이슬',
  },
  {
    menu_id: 7,
    category_id: 2,
    menu_name: '테라',
    menu_name_en:'terra',
    menu_price: 5000,
    menu_img_url: 'https://via.placeholder.com/150/FFD700/FFFFFF?text=테라',
  },
  {
    menu_id: 8,
    category_id: 2,
    menu_name: '하이볼',
    menu_name_en:'highball',
    menu_price: 8000,
    menu_img_url: 'https://via.placeholder.com/150/FFD700/FFFFFF?text=하이볼',
  },
];