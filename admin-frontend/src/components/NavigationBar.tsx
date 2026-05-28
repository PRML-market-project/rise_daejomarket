'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchWithToken } from '@/utils/fetchWithToken';
import { toast } from 'sonner';

interface StoreInfo {
  email: string;
  adminName: string;
  storeName: string;
}

export default function NavigationBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchStoreInfo();
  }, []);

  const fetchStoreInfo = async () => {
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/store-info`
      );
      if (!response.ok) throw new Error('Failed to fetch store info');
      const data = await response.json();
      setStoreInfo(data);
    } catch (error) {
      console.error('Failed to fetch store info:', error);
      toast.error('가게 정보를 불러오는데 실패했습니다');
    }
  };

  const handleLogout = () => {
    // Remove tokens from localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    // Remove tokens from cookies
    document.cookie =
      'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie =
      'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    // Redirect to login page
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    if (!password) {
      toast.error('비밀번호를 입력해주세요');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/delete-admin`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // Remove tokens from localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');

      // Remove tokens from cookies
      document.cookie =
        'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie =
        'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

      toast.success('계정이 삭제되었습니다');
      router.push('/login');
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error('계정 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setPassword('');
    }
  };

  const navItems = [
    { href: '/dashboard', label: '가게 관리', icon: 'Dashboard' },
    { href: '/categories', label: '카테고리 관리', icon: 'Cate' },
    { href: '/menus', label: '메뉴 관리', icon: 'Menu' },
    { href: '/orders', label: '주문 관리', icon: 'Order' },
  ];

  return (
    <>
      <div className='w-[20%] rounded-r-[25px] text-white bg-indigo-600 h-full flex flex-col'>
        <div className='p-6 flex flex-col items-center gap-4'>
          {storeInfo && (
            <>
              <div
                className='w-16 h-16 rounded-full bg-indigo-100 bg-gradient-to-br from-indigo-200 to-indigo-400
               tracking-tight flex items-center justify-center
              shadow-[0_10px_30px_rgba(99,102,241,0.4)] border border-indigo-300 relative overflow-hidden '
              >
                <span
                  className='text-indigo-600 text-xl font-semibold'
                  style={{
                    background:
                      'linear-gradient(135deg, #5c6ac4 0%, #3b43a9 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
                  }}
                >
                  {storeInfo.adminName.slice(1, 3)}
                </span>
              </div>

              <div className='text-center'>
                <p className='font-semibold'>{storeInfo.adminName}</p>
                <p className='text-sm text-indigo-100'>{storeInfo.email}</p>
              </div>
            </>
          )}
        </div>

        <ul className='flex flex-col gap-2 w-[84%] mx-auto mt-4'>
          {navItems.map(({ href, label, icon }) => {
            const isSelected = pathname === href;
            const imageSrc = `/${icon}${isSelected ? 'S' : ''}.svg`;
            return (
              <li
                key={href}
                className={`w-full p-4 rounded-2xl ${
                  isSelected
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'hover:bg-indigo-500'
                }`}
              >
                <Link href={href} className='flex items-center gap-2'>
                  <Image src={imageSrc} alt={label} width={18} height={18} />
                  <p>{label}</p>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className='mt-auto mb-8 w-[84%] mx-auto flex items-center gap-2 text-sm'>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className='flex flex-1 items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-500 text-white hover:opacity-80 hover:cursor-pointer transition'
          >
            <Image src='/Delete-admin.svg' alt='탈퇴' width={18} height={18} />
            <span>탈퇴</span>
          </button>
          <button
            onClick={handleLogout}
            className='flex flex-1 items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-indigo-500 text-white hover:opacity-80 hover:cursor-pointer transition'
          >
            <Image src='/Logout.svg' alt='로그아웃' width={18} height={18} />
            <span>로그아웃</span>
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-2xl p-6 w-[400px]'>
            <h2 className='text-xl font-semibold mb-4'>계정 삭제</h2>
            <p className='text-gray-600 mb-4'>
              계정을 삭제하시려면 비밀번호를 입력해주세요.
            </p>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='비밀번호를 입력하세요'
              className='w-full p-3 border border-gray-300 rounded-xl mb-4 focus:outline-none focus:border-indigo-500'
            />
            <div className='flex gap-2 justify-end'>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setPassword('');
                }}
                className='px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl'
              >
                취소
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className='px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50'
              >
                {isDeleting ? '처리중...' : '탈퇴'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
