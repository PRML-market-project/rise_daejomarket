import { useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminStoreManager from './AdminStoreManager';
import './admin.css';

export default function AdminApp() {
  const isLogin = window.location.pathname === '/login';
  const token = localStorage.getItem('accessToken');
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const hasToken = Boolean(token) && (token !== 'local-admin' || isLocal);
  const redirectTo = isLogin ? (hasToken ? '/dashboard' : null) : (hasToken ? null : '/login');

  useEffect(() => {
    document.documentElement.classList.add('admin-page');
    document.title = '대조시장 관리자';
    if (redirectTo) window.location.replace(redirectTo);
    return () => document.documentElement.classList.remove('admin-page');
  }, [redirectTo]);

  if (redirectTo) return <p role="status">관리자 화면으로 이동 중…</p>;
  return isLogin
    ? <AdminLogin onAuthenticated={() => window.location.assign('/dashboard')} />
    : <AdminStoreManager />;
}
