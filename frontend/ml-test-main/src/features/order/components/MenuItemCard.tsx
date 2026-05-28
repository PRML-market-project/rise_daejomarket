import { Menu } from '@/types/menu';
import { useCartStore } from '@/store/cartStore';
import { useLanguageStore } from '@/store/languageStore';

interface MenuItemCardProps {
  menu: Menu;
  isSearched: boolean;
}

const MenuItemCard = ({ menu, isSearched }: MenuItemCardProps) => {
  const addItem = useCartStore((state) => state.addItem);
  const { language } = useLanguageStore();

  const translatedName =
    language === 'en' && menu.menuNameEn ? menu.menuNameEn : menu.menuName;

  const handleAddToCart = () => {
    console.log(`Adding ${translatedName} to cart`);
    addItem(menu);
  };

  return (
    <div
      onClick={handleAddToCart} // 카드 전체 클릭 시 장바구니 담기 (UX 개선 추천)
      className={`bg-[var(--color-indigo-100)] rounded-lg shadow hover:shadow-md transition-shadow duration-200 ease-in-out overflow-hidden flex flex-col cursor-pointer ${
        isSearched
          ? 'animate-[pulse_1s_ease-in-out_infinite] border-2 border-[var(--color-indigo-300)] ring-2 ring-[var(--color-indigo-300)]'
          : ''
      }`}
    >
      {/* 이미지 영역 */}
      <div className="w-full aspect-square bg-white flex items-center justify-center overflow-hidden">
        <img
          src={menu.imageUrl}
          alt={translatedName}
          // [핵심 변경사항]
          // aspect-square: 너비에 맞춰 높이를 1:1 비율로 자동 설정
          // object-contain: 이미지가 잘리지 않고 비율을 유지하며 전체가 다 보이도록 설정
          className='w-full h-full object-cover'
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/logo.png';
          }}
        />
      </div>
      
      {/* 텍스트 영역 */}
{/* 텍스트 영역 */}
<div className='flex flex-col flex-grow w-full p-4 items-center'> {/* items-center 추가 */}
        <div className='w-full mb-3 flex flex-col items-center'> {/* flex-col 및 items-center 추가 */}
          <h3
            className='w-full font-semibold text-md mb-1 truncate text-center text-[var(--color-indigo-900)]'
            title={translatedName}
          >
            {translatedName}
          </h3>
          
          {menu.menuCount && (
            <p className='w-full text-xs text-[var(--color-indigo-600)] text-center mb-1'>
              {menu.menuCount}
            </p>
          )}
          
          <p className='w-full text-sm text-[var(--color-indigo-700)] text-center'>
            {menu.menuPrice.toLocaleString()} ₩
          </p>
        </div>
      </div>
    </div>
  );
};

export default MenuItemCard;