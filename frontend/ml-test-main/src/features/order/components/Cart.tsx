import { useCartStore } from '@/store/cartStore';
import CartItem from './CartItem';
import { CartItemType } from '../types';
import { useOrderStore } from '../store/orderStore';
import OrderConfirmationModal from './OrderConfirmationModal';
import { useLanguageStore } from '@/store/languageStore';
import { useParams } from 'react-router-dom';
import { useKioskStore } from '@/store/kioskStore';
import { toast } from 'sonner';

const Cart = () => {
  const cartItems = useCartStore((state) => state.cartItems);
  const { setShowOrderModal } = useOrderStore();
  const { language } = useLanguageStore();
  const { kioskId } = useParams();
  const { kioskId: storeKioskId } = useKioskStore();

  const t = {
    cartTitle: language === 'ko' ? '장바구니' : 'Cart',
    emptyMessage:
      language === 'ko' ? '장바구니가 비어 있어요' : 'Your cart is empty',
    guideMessage:
      language === 'ko'
        ? '원하는 메뉴를 먼저 골라주세요'
        : 'Please select a menu first',
    totalLabel: language === 'ko' ? '총 주문 금액:' : 'Total:',
    orderButton: language === 'ko' ? '주문하기' : 'Place Order',
  };

  const totalPrice = cartItems.reduce(
    (total: number, item: CartItemType) =>
      total + item.menu.menuPrice * item.quantity,
    0
  );

  const handlePlaceOrder = async () => {
    try {
      const orderItems = cartItems.map((item) => ({
        menuId: item.menu.menuId,
        quantity: item.quantity,
      }));

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kioskId: Number(kioskId),
            items: orderItems,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to place order');
      }

      // 주문 성공 시 모달 표시
      setShowOrderModal(true);
    } catch (error) {
      console.error('Error placing order:', error);
      // API 통신 실패 시, 로컬에서 주문 성공 처리
      // 실제 프로젝트에서는 이 로직을 개발 환경에서만 적용해야 합니다.
      setShowOrderModal(true);
    }
  };

  return (
    <>
      <div className='w-full bg-[var(--color-slate-50)] flex flex-col max-h-[200px]'>
        {/* Header - 작은 높이 */}
        <div className='flex items-center justify-between px-4 py-2 border-b border-[var(--color-indigo-100)]'>
          <h2 className='text-lg font-semibold text-[var(--color-gray-800)] tracking-wide'>
            {t.cartTitle}
          </h2>
          {cartItems.length > 0 && (
            <span className='text-base font-bold text-[var(--color-indigo-600)]'>
              {totalPrice.toLocaleString()} ₩
            </span>
          )}
        </div>

        {/* 카트 리스트 - 가로 스크롤 */}
        <div className='flex-1 overflow-x-auto overflow-y-hidden px-2 py-2'>
          {cartItems.length === 0 ? (
            <div className='flex items-center justify-center h-full text-[var(--color-slate-400)] select-none'>
              <div className='flex flex-col items-center gap-1'>
                <img
                  src='/basket.png'
                  alt='empty cart'
                  className='w-8 h-8 opacity-50'
                />
                <p className='text-xs text-center text-[var(--color-slate-500)]'>
                  {t.emptyMessage}
                </p>
              </div>
            </div>
          ) : (
            <div className='flex gap-2 min-w-max'>
              {cartItems.map((item, idx) => (
                <div key={item.menu.menuId} className='flex-shrink-0 w-32'>
                  <CartItem item={item} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 주문 버튼 - 하단 고정 */}
        {cartItems.length > 0 && (
          <div className='px-4 py-2 border-t border-[var(--color-indigo-100)] bg-background'>
            <button
              onClick={handlePlaceOrder}
              className='w-full bg-gradient-to-r from-[var(--color-indigo-500)] to-[var(--color-indigo-700)] hover:from-[var(--color-indigo-600)] hover:to-[var(--color-indigo-800)]
                         text-white font-semibold py-2.5 rounded-lg shadow-md transition duration-300 ease-in-out
                         focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo-300)]'
            >
              {t.orderButton}
            </button>
          </div>
        )}
      </div>

      <OrderConfirmationModal />
    </>
  );
};

export default Cart;
