'use client';
import { useState, useEffect } from 'react';
import { fetchWithToken } from '@/utils/fetchWithToken';
import Image from 'next/image';
import { toast } from 'sonner';
import AlertModal from '@/components/AlertModal';
import useModal from '@/hooks/useModal';

interface OrderItem {
  menuName: string;
  menuNameEn: string | null;
  menuPrice: number;
  quantity: number;
}

interface Order {
  orderId: number;
  createdAt: string;
  items: OrderItem[];
}

interface Kiosk {
  kioskId: number;
  kioskNumber: number;
  kioskIsActive: boolean;
  orders: Order[];
}

const useConfirm = () => {
  const { isOpen, open, close, data } = useModal<{
    onConfirm: () => void;
    message: string;
  }>();

  const ConfirmModal = () => (
    <AlertModal
      isOpen={isOpen}
      onClose={close}
      onConfirm={() => {
        if (data?.onConfirm) data.onConfirm();
        close();
      }}
      message={data?.message || ''}
    />
  );

  return {
    confirm: (message: string, onConfirm: () => void) =>
      open({ message, onConfirm }),
    ConfirmModal,
  };
};

export default function Orders() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [tableCount, setTableCount] = useState<number>(16);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { confirm: confirmAction, ConfirmModal } = useConfirm();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsRefreshing(true);
      const storeOrderResponse = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/orders`
      );
      if (!storeOrderResponse.ok) throw new Error('Failed to fetch orders');
      const orderData: Kiosk[] = await storeOrderResponse.json();
      setTableCount(orderData.length);
      setKiosks(orderData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('데이터를 불러오는데 실패했습니다');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearOrders = (kioskNumber: number) => {
    confirmAction('정말로 이 테이블의 주문을 비우시겠습니까?', async () => {
      setSubmitting(true);
      try {
        // Optimistic update
        setKiosks((prev) =>
          prev.map((kiosk) =>
            kiosk.kioskNumber === kioskNumber ? { ...kiosk, orders: [] } : kiosk
          )
        );

        const response = await fetchWithToken(
          `${process.env.NEXT_PUBLIC_API_URL}/api/order/by-kiosk/${kioskNumber}`,
          { method: 'DELETE' }
        );
        if (!response.ok) throw new Error('Failed to clear orders');
        toast.success('주문이 비워졌습니다');
        await fetchInitialData(); // Confirm with server
      } catch (error) {
        console.error('Failed to clear orders:', error);
        toast.error('주문 비우기에 실패했습니다');
        await fetchInitialData(); // Revert if failed
      } finally {
        setSubmitting(false);
      }
    });
  };

  const handleDeactivateKiosk = (kioskId: number) => {
    confirmAction('정말로 이 키오스크를 비활성화하시겠습니까?', async () => {
      setSubmitting(true);
      try {
        // Optimistic update
        setKiosks((prev) =>
          prev.map((kiosk) =>
            kiosk.kioskId === kioskId
              ? { ...kiosk, kioskIsActive: false }
              : kiosk
          )
        );

        const response = await fetchWithToken(
          `${process.env.NEXT_PUBLIC_API_URL}/api/kiosk/deactivate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ kioskId }),
          }
        );
        if (!response.ok) throw new Error('Failed to deactivate kiosk');
        toast.success('테이블이 비활성화되었습니다');
        await fetchInitialData(); // Confirm with server
      } catch (error) {
        console.error('Failed to deactivate kiosk:', error);
        toast.error('테이블 비활성화에 실패했습니다');
        await fetchInitialData(); // Revert if failed
      } finally {
        setSubmitting(false);
      }
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateTotalPrice = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + item.menuPrice * item.quantity, 0);
  };

  return (
    <div className='h-full flex-1 p-8 flex flex-col gap-[30px] overflow-y-scroll'>
      <ConfirmModal />
      <div className='flex flex-col'>
        <h1 className='text-[32px] inter-semibold'>주문 관리</h1>
        <h2 className='text-[16px] inter-medium text-ml-gray-dark'>
          Order Management
        </h2>
      </div>
      <div className='bg-white rounded-3xl p-6 flex flex-col gap-8'>
        <div className='flex justify-between items-center'>
          <h3 className='text-[18px] inter-semibold'>테이블별 주문 현황</h3>
          <button
            onClick={fetchInitialData}
            disabled={isRefreshing}
            className={
              'flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 text-white px-4 py-2 disabled:opacity-50 hover:cursor-pointer transition-opacity'
            }
          >
            <Image
              src='/Refresh.svg'
              alt='refresh'
              width={16}
              height={16}
              className={isRefreshing ? 'animate-spin' : ''}
            />
            <span className='inter-regular'>
              {isRefreshing ? '갱신 중...' : '새로고침'}
            </span>
          </button>
        </div>

        <div className='grid grid-cols-4 gap-4'>
          {Array.from({ length: tableCount }, (_, i) => i + 1).map(
            (tableNum) => {
              const kiosk = kiosks.find((k) => k.kioskNumber === tableNum) || {
                kioskId: 0,
                kioskNumber: tableNum,
                kioskIsActive: false,
                orders: [],
              };
              const hasActiveOrders = kiosk.orders.length > 0;

              return (
                <div
                  key={tableNum}
                  className={`p-4 rounded-xl border transition-all duration-300 ${
                    kiosk.kioskIsActive
                      ? 'border-indigo-300 bg-white'
                      : 'border-gray-300 bg-gray-100'
                  }`}
                >
                  <div className='flex gap-20 justify-center items-center bg-white p-4 w-full rounded-xl'>
                    <div className='flex gap-2'>
                      <Image
                        src='/ForkKnife.svg'
                        alt='fork-knife'
                        width={30}
                        height={30}
                      />
                      <span className='text-2xl'>{tableNum}</span>
                    </div>

                    <span
                      className={`p-4 rounded-2xl whitespace-nowrap transition-colors ${
                        kiosk.kioskIsActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {kiosk.kioskIsActive ? '사용중' : '미사용'}
                    </span>
                  </div>

                  <div className='mt-4 transition-all duration-300'>
                    {hasActiveOrders ? (
                      <div className='flex flex-col h-[300px]'>
                        <div className='flex-1 overflow-y-auto space-y-4 pr-2'>
                          {kiosk.orders.map((order) => (
                            <div
                              key={order.orderId}
                              className='border-t border-indigo-200 pt-4'
                            >
                              <div className='flex justify-between items-center mb-2'>
                                <div className='text-sm text-indigo-600'>
                                  {formatDate(order.createdAt)}
                                </div>
                              </div>
                              <div className='space-y-2'>
                                {order.items.map((item, index) => (
                                  <div
                                    key={index}
                                    className='flex justify-between text-sm'
                                  >
                                    <span>
                                      {item.menuName} x {item.quantity}
                                    </span>
                                    <span>
                                      {(
                                        item.menuPrice * item.quantity
                                      ).toLocaleString()}
                                      원
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className='flex flex-col gap-2 mt-4 pt-2 border-t border-indigo-200'>
                          <div className='flex justify-between font-semibold'>
                            <span>총 금액</span>
                            <span>
                              {kiosk.orders
                                .reduce(
                                  (sum, order) =>
                                    sum + calculateTotalPrice(order.items),
                                  0
                                )
                                .toLocaleString()}
                              원
                            </span>
                          </div>
                          <button
                            onClick={() => handleClearOrders(tableNum)}
                            disabled={submitting || isRefreshing}
                            className='w-full py-2 px-4 bg-indigo-500 hover:cursor-pointer text-white rounded-xl hover:opacity-80 disabled:opacity-50 transition-opacity'
                          >
                            {submitting ? '처리중...' : '주문 비우기'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className='flex flex-col gap-2 h-[300px]'>
                        <div className='text-center text-indigo-600 py-4 w-full border border-indigo-300 rounded-xl'>
                          주문 없음
                        </div>
                        {kiosk.kioskIsActive && (
                          <button
                            onClick={() => handleDeactivateKiosk(kiosk.kioskId)}
                            disabled={submitting || isRefreshing}
                            className='w-full py-2 px-4 bg-slate-500 hover:cursor-pointer text-white rounded-xl hover:opacity-80 disabled:opacity-50 transition-opacity'
                          >
                            {submitting ? '처리중...' : '키오스크 비활성화'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}
