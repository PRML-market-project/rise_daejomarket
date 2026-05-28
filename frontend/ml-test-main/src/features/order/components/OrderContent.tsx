import { useEffect } from 'react';
import MarketMap from '@/pages/market-map';
import MenuContent from './MenuContent';
import { useNavigationStore } from '@/store/navigationStore';
import { useParams } from 'react-router-dom';
import { useKioskStore } from '@/store/kioskStore';
import { useMenuStore } from '@/store/menuStore';

const OrderContent = () => {
  const { currentView } = useNavigationStore();
  const { kioskId } = useParams();
  const { kioskId: storeKioskId } = useKioskStore();
  const fetchMenusByCategory = useMenuStore(
    (state) => state.fetchMenusByCategory
  );

  useEffect(() => {
    if (kioskId) {
      fetchMenusByCategory(Number(kioskId));
    }
  }, [kioskId, fetchMenusByCategory]);

  return currentView === 'menu' ? <MenuContent /> : <MarketMap />;
};

export default OrderContent;
