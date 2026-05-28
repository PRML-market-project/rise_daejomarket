import { useCartStore } from '@/store/cartStore';
import { useLanguageStore } from '@/store/languageStore';
import { PlusIcon, MinusIcon } from '@heroicons/react/24/solid';
import { CartItemType } from '../types';

interface CartItemProps {
  item: CartItemType;
}

const CartItem = ({ item }: CartItemProps) => {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const { language } = useLanguageStore();

  const handleIncrease = () => {
    updateQuantity(item.menu.menuId, 1);
  };

  const handleDecrease = () => {
    if (item.quantity - 1 <= 0) {
      handleRemove();
    } else {
      updateQuantity(item.menu.menuId, -1);
    }
  };

  const handleRemove = () => {
    removeItem(item.menu.menuId);
  };

  const translatedName =
    language === 'en' && item.menu.menuNameEn
      ? item.menu.menuNameEn
      : item.menu.menuName;

  const translatedCurrency = language === 'en' ? '₩' : '₩';

  return (
    <div className='flex flex-col items-center bg-white rounded-lg p-2 border border-[var(--color-indigo-100)] shadow-sm h-full'>
      {/* Image */}
      {/* 변경사항: 
        1. object-cover: 이미지를 찌그러뜨리지 않고 영역을 꽉 채움 (넘치는 부분 잘림)
        2. object-center: 이미지가 잘릴 때 중앙을 기준으로 정렬
        3. aspect-square: 정사각형 비율 강제 (w-16 h-16이 있어서 필수는 아니지만 명시적 선언)
      */}
      <img
        src={item.menu.imageUrl}
        alt={translatedName}
        className='w-16 h-16 aspect-square object-cover object-center rounded mb-2 flex-shrink-0'
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = '/logo.png';
        }}
      />

      {/* Name - 짧게 표시 */}
      <p className='font-semibold text-xs mb-1 text-[var(--color-slate-800)] text-center line-clamp-2 h-8'>
        {translatedName}
      </p>

      {/* Price */}
      <p className='text-xs text-[var(--color-slate-600)] mb-2'>
        {item.menu.menuPrice.toLocaleString()} {translatedCurrency}
      </p>

      {/* Quantity Controls */}
      <div className='flex items-center justify-center gap-2 mt-auto'>
        <button
          onClick={handleDecrease}
          className='w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--color-indigo-100)] transition-colors'
          aria-label='Decrease quantity'
        >
          <MinusIcon className='w-3.5 h-3.5 text-[var(--color-indigo-500)]' />
        </button>
        <span className='text-center font-medium text-sm w-6 text-[var(--color-slate-700)]'>
          {item.quantity}
        </span>
        <button
          onClick={handleIncrease}
          className='w-6 h-6 flex items-center justify-center rounded-full hover:bg-[var(--color-indigo-100)] transition-colors'
          aria-label='Increase quantity'
        >
          <PlusIcon className='w-3.5 h-3.5 text-[var(--color-indigo-500)]' />
        </button>
      </div>
    </div>
  );
};

export default CartItem;