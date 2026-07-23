import React, { useEffect } from 'react';
import { useOrderHistoryStore } from '@/store/orderHistoryStore';
import { useLanguageStore } from '@/store/languageStore';
import { useParams } from 'react-router-dom';
import { localizedValue, speechRecognitionLocales } from '@/i18n/language';

const OrderHistoryPage: React.FC = () => {
  const { orders, fetchOrders, isLoading, error } = useOrderHistoryStore();
  const { language } = useLanguageStore();
  const { kioskId } = useParams();
  const labels = {
    ko: {
      title: '주문 내역',
      loading: '주문 내역을 불러오는 중...',
      empty: '주문 내역이 없습니다.',
      orderNumber: '주문번호',
      total: '총 금액',
      final: '최종 금액',
    },
    en: {
      title: 'Order History',
      loading: 'Loading orders...',
      empty: 'No orders found.',
      orderNumber: 'Order Number',
      total: 'Total Amount',
      final: 'Final Amount',
    },
    vi: {
      title: 'Lịch sử đơn hàng',
      loading: 'Đang tải đơn hàng...',
      empty: 'Không có đơn hàng.',
      orderNumber: 'Mã đơn hàng',
      total: 'Tổng tiền',
      final: 'Tổng cộng',
    },
  }[language];

  useEffect(() => {
    if (kioskId) {
      fetchOrders(Number(kioskId));
    }
  }, [fetchOrders, kioskId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // UTC 시간에 9시간을 더해 한국 시간으로 변환
    date.setHours(date.getHours() + 9);
    return date.toLocaleString(speechRecognitionLocales[language]);
  };

  // 전체 주문의 총합 금액 계산
  const totalAmount = orders.reduce((total, order) => {
    const orderTotal = order.items.reduce(
      (sum, item) => sum + item.menuPrice * item.quantity,
      0
    );
    return total + orderTotal;
  }, 0);

  return (
    <div className='h-full flex flex-col bg-[var(--color-gray-50)]'>
      <div className='p-4'>
        <h1 className='text-2xl font-bold mb-6'>
          {labels.title}
        </h1>

        {isLoading && (
          <p>
            {labels.loading}
          </p>
        )}
        {error && <p className='text-[var(--color-red-600)]'>{error}</p>}
      </div>

      <div className='flex flex-col gap-4 flex-1 overflow-y-auto px-4 pb-4'>
        {orders.length === 0 && !isLoading && (
          <p>
            {labels.empty}
          </p>
        )}

        <div className='flex flex-col gap-4'>
          {orders.map((order) => (
            <div key={order.orderId} className='bg-white rounded-lg shadow p-4'>
              <div className='flex justify-between items-start mb-3'>
                <div>
                  <h2 className='text-lg font-semibold'>
                    {labels.orderNumber}:{' '}
                    {order.orderId}
                  </h2>
                  <p className='text-sm text-[var(--color-gray-500)]'>
                    {formatDate(order.createdAt)}
                  </p>
                </div>
              </div>
              <div className='space-y-2 mb-3'>
                {order.items.map((item, idx) => (
                  <div key={idx} className='flex justify-between text-sm'>
                    <span>
                      {localizedValue(
                        language,
                        item.menuName,
                        item.menuNameEn,
                        item.menuNameVi
                      )}{' '}
                      x {item.quantity}
                    </span>
                    <span>
                      {(item.menuPrice * item.quantity).toLocaleString()} ₩
                    </span>
                  </div>
                ))}
              </div>
              <div className='border-t pt-3'>
                <div className='flex justify-between font-semibold'>
                  <span>{labels.total}</span>
                  <span>
                    {order.items
                      .reduce(
                        (total, item) => total + item.menuPrice * item.quantity,
                        0
                      )
                      .toLocaleString()}{' '}
                    ₩
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 전체 주문 총합 금액 - 하단 고정 */}
      {orders.length > 0 && (
        <div className='bg-white border-t border-[var(--color-gray-200)] p-4'>
          <div className='flex justify-between items-center'>
            <span className='text-lg font-semibold'>
              {labels.final}
            </span>
            <span className='text-2xl font-bold text-[var(--color-indigo-600)]'>
              {totalAmount.toLocaleString()} ₩
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistoryPage;
