import { lazy, Suspense } from 'react';
import KioskSearchApp from '@/features/kiosk/KioskSearchApp';

const AdminApp = lazy(() => import('./features/admin/AdminApp'));

const App = () => {
  const pathname = window.location.pathname;
  if (pathname === '/login' || pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return <Suspense fallback={<p role="status">관리자 화면을 불러오는 중…</p>}><AdminApp /></Suspense>;
  }
  return <KioskSearchApp />;
};

export default App;
