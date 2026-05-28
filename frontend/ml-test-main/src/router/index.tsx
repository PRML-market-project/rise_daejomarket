// src/router/index.tsx

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useNavigationStore } from '@/store/navigationStore';

// --- Layouts ---
import MainLayout from '../components/layout/MainLayout';

// --- Screen/Page Components ---

import OrderContent from '@/features/order/components/OrderContent';

import StoreEntry from '@/features/order/components/StoreEntry';
import { Toaster } from 'sonner';

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Route without MainLayout */}

        <Route path='/' element={<StoreEntry />} />

        {/* Routes that WILL use MainLayout */}
        <Route element={<MainLayout />}>
          {/* These routes will render inside MainLayout's <Outlet /> */}

          <Route
            path='/:adminId/:kioskId/:kioskNumber/order'
            element={<OrderContent />}
          />
        </Route>

        {/* Admin Routes */}

        {/* Other top-level routes can go here */}
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
};

export default AppRouter;
