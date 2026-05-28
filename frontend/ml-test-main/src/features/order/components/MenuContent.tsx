import { Menu } from '@/types/menu';
import MenuItemCard from './MenuItemCard';
import { useNavigationStore } from '@/store/navigationStore';
import { useMenuStore } from '@/store/menuStore';
import { useLanguageStore } from '@/store/languageStore';
import { useVoiceStore } from '../store/voiceStore';

const MenuContent = () => {
  const { currentCategoryId, currentMenuId } = useNavigationStore();
  const { getMenusByCategory } = useMenuStore();
  const { language } = useLanguageStore();


  // ✅ 0. 커버가 켜져 있으면 "메뉴를 절대 렌더링하지 않음"
  //const isCovered = useVoiceStore((s) => s.isCovered);
  //if (isCovered) return null;

  // 1. 가게(카테고리)가 선택되지 않음
  if (!currentCategoryId) return null;

  // 2. 선택된 가게의 메뉴 가져오기
  const currentMenus = getMenusByCategory(currentCategoryId);

  // 검색된 메뉴가 있다면 맨 앞으로 정렬
  const filteredItems = currentMenus.reduce<Menu[]>((items, item) => {
    if (currentMenuId !== null && item.menuId === currentMenuId) {
      return [item, ...items];
    }
    return [...items, item];
  }, []);

  // 3. 가게는 선택했는데 메뉴가 없음
  if (filteredItems.length === 0) {
    return (
      <div className='flex items-center justify-center h-full p-8'>
        <p className='text-[var(--color-gray-500)] text-lg'>
          {language === 'en'
            ? 'No menus available in this category'
            : '해당 점포에 품목이 없습니다'}
        </p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3'>
      {filteredItems.map((menu) => (
        <MenuItemCard
          key={menu.menuId}
          menu={menu}
          isSearched={menu.menuId === currentMenuId}
        />
      ))}
    </div>
  );
};

export default MenuContent;
