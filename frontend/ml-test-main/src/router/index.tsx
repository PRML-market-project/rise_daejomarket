// src/router/index.tsx

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import KioskSearchApp from '@/features/kiosk/KioskSearchApp';
import { Toaster } from 'sonner';

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<KioskSearchApp />} />
        <Route path='/:adminId/:kioskId/:kioskNumber/order' element={<KioskSearchApp />} />
        <Route path='*' element={<KioskSearchApp />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
};

export default AppRouter;
