'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { fetchWithToken } from '@/utils/fetchWithToken';
import { toast } from 'sonner';

interface StoreInfo {
  email: string;
  adminName: string;
  storeName: string;
  storeNameEn: string;
  kioskCount: number;
}

export default function Dashboard() {
  const [formData, setFormData] = useState({
    email: '',
    oldPassword: '',
    newPassword: '',
    storeName: '',
    storeNameEn: '',
    adminName: '',
    tableCount: '',
  });

  const fetchStoreInfo = async () => {
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/store-info`
      );

      const data: StoreInfo = await response.json();
      setFormData((prev) => ({
        ...prev,
        email: data.email,
        adminName: data.adminName,
        storeName: data.storeName,
        storeNameEn: data.storeNameEn,
        tableCount: data.kioskCount.toString(),
      }));
    } catch (error) {
      console.error('Error fetching store info:', error);
    }
  };

  useEffect(() => {
    fetchStoreInfo();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleStoreNameSubmit = async () => {
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/change-store-name`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            newName: formData.storeName,
            newNameEn: formData.storeNameEn,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to update store name');
      toast('가게 이름 변경 완료');
      await fetchStoreInfo(); // 정보 새로고침
    } catch (error: any) {
      console.error('Store name update failed:', error);
      toast.error(error.message || '가게 이름 변경 실패');
    }
  };

  const handleAdminNameSubmit = async () => {
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/change-admin-name`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newName: formData.adminName }),
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to update admin name');
      toast('사장님 이름 변경 완료');
      await fetchStoreInfo(); // 정보 새로고침
    } catch (error: any) {
      console.error('Admin name update failed:', error);
      toast.error(error.message || '사장님 이름 변경 실패');
    }
  };

  const handlePasswordChange = async () => {
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/change-password`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            oldPassword: formData.oldPassword,
            newPassword: formData.newPassword,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to update password');
      toast('비밀번호 변경 완료');
      setFormData((prev) => ({
        ...prev,
        oldPassword: '',
        newPassword: '',
      }));
    } catch (error: any) {
      console.error('Password update failed:', error);
      toast.error(error.message || '비밀번호 변경 실패');
    }
  };

  const handleTableCountSubmit = async () => {
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/kiosk/set`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ count: formData.tableCount }),
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to update table count');
      toast('테이블 수 설정 완료');
      await fetchStoreInfo(); // 정보 새로고침
    } catch (error: any) {
      console.error('Table count update failed:', error);
      toast.error(error.message || '테이블 수 설정 실패');
    }
  };

  return (
    <div className='h-full flex-1 p-8 flex flex-col gap-[30px] overflow-y-scroll min-w-[1080px]'>
      <div className='flex flex-col'>
        <h1 className='text-[32px] inter-semibold'>가게 관리</h1>
        <h2 className='text-[16px] inter-medium text-ml-gray-dark'>
          Store Management
        </h2>
      </div>

      <div className='bg-white rounded-3xl p-6 flex flex-col gap-8'>
        <h3 className='text-[18px] inter-semibold'>가게정보</h3>
        <div className='flex gap-4 w-full justify-between'>
          <div className='flex flex-col  gap-2'>
            <span className='inter-semibold'>Email</span>
            <div className='flex gap-8 w-full'>
              <span className='w-[400px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600 inter-regular'>
                {formData.email}
              </span>
              <div className='flex items-center justify-center gap-2 rounded-2xl  bg-white text-white p-4 w-[200px] h-[58px] '></div>
            </div>
          </div>

          <div className='flex flex-col  gap-2 md:mr-20'>
            <span className='inter-semibold'>기존 비밀번호</span>
            <div className='flex gap-8 w-full'>
              <input
                id='oldPassword'
                type='password'
                value={formData.oldPassword}
                onChange={handleChange}
                className='w-[300px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
              />
            </div>
          </div>
        </div>

        <div className='flex gap-4 w-full justify-between'>
          <div className='flex flex-col gap-2'>
            <span className='inter-semibold'>가게 이름</span>
            <div className='flex flex-col gap-4 w-full'>
              <input
                id='storeName'
                type='text'
                value={formData.storeName}
                onChange={handleChange}
                placeholder='가게 이름 (한글)'
                className='w-[400px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
              />

              <div className='flex flex-col gap-2'>
                <span className='inter-semibold'>가게 이름 (영문)</span>
                <div className='flex gap-8'>
                  <input
                    id='storeNameEn'
                    type='text'
                    value={formData.storeNameEn}
                    onChange={handleChange}
                    placeholder='가게 이름 (영문)'
                    className='w-[400px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                  />
                  <button
                    onClick={handleStoreNameSubmit}
                    className='flex items-center justify-center gap-2 rounded-2xl hover:cursor-pointer h-[58px] bg-indigo-500 text-white p-4 w-[200px]'
                  >
                    <Image src='Submit.svg' alt='add' width={16} height={16} />
                    <span className='inter-regular '>가게 이름 변경</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className='flex flex-col  gap-2 md:mr-20 relative'>
            <span className='inter-semibold'>변경할 비밀번호</span>
            <div className='flex gap-8 w-full'>
              <input
                id='newPassword'
                type='password'
                value={formData.newPassword}
                onChange={handleChange}
                className='w-[300px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
              />
            </div>
            <button
              onClick={handlePasswordChange}
              className='absolute right-0 top-35 flex items-center justify-center gap-2 rounded-2xl hover:cursor-pointer bg-indigo-500 text-white p-4 w-[200px] '
            >
              <Image src='Submit.svg' alt='add' width={16} height={16} />
              <span className='inter-regular '>비밀번호 변경</span>
            </button>
          </div>
        </div>

        <div className='flex gap-4 w-full'>
          <div className='flex flex-col  gap-2 w-full'>
            <span className='inter-semibold'>사장님 이름</span>
            <div className='flex w-full justify-between'>
              <div className='flex gap-8 '>
                <input
                  id='adminName'
                  type='text'
                  value={formData.adminName}
                  onChange={handleChange}
                  placeholder='사장님 이름'
                  className='w-[400px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                />
                <button
                  onClick={handleAdminNameSubmit}
                  className='flex items-center justify-center gap-2 rounded-2xl hover:cursor-pointer bg-indigo-500 text-white p-4 w-[200px]'
                >
                  <Image src='Submit.svg' alt='add' width={16} height={16} />
                  <span className='inter-regular '>사장님 이름 변경</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className='flex gap-4 w-full'>
          <div className='flex flex-col  gap-2'>
            <span className='inter-semibold'>테이블 수 설정</span>
            <div className='flex gap-8 w-full'>
              <input
                id='tableCount'
                type='number'
                value={formData.tableCount}
                onChange={handleChange}
                placeholder='테이블수'
                className='w-[400px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
              />
              <button
                onClick={handleTableCountSubmit}
                className='flex items-center justify-center gap-2 rounded-2xl hover:cursor-pointer bg-indigo-500 text-white p-4 w-[200px]'
              >
                <Image src='Submit.svg' alt='add' width={16} height={16} />
                <span className='inter-regular '>테이블 수 등록</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
