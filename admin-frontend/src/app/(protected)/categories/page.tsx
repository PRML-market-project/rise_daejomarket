'use client';

import CategoryDeleter from '@/components/CategoryDeleter';
import CategoryNameChanger from '@/components/CategoryNameChanger';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { fetchWithToken } from '@/utils/fetchWithToken';
import { toast } from 'sonner';
import { Category as ComponentCategory } from '@/types/Category';

interface APICategory {
  categoryId: number;
  categoryName: string;
  categoryNameEn: string;
  adminId: number;
  menus: any[];
}

export default function Categories() {
  const [categories, setCategories] = useState<APICategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryNameEn, setNewCategoryNameEn] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/categories`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to fetch categories');

      console.log('Categories:', data);

      // 응답이 배열인지 확인
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        console.error('Unexpected response format:', data);
        toast.error('카테고리 정보 형식이 올바르지 않습니다');
      }
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to fetch categories:', error);
      toast.error(error.message || '카테고리 정보를 불러오는데 실패했습니다');
      setLoading(false);
    }
  };

  // API 응답 데이터를 컴포넌트 형식으로 변환 (Default 카테고리 제외)
  const transformCategories = (
    apiCategories: APICategory[]
  ): ComponentCategory[] => {
    return apiCategories
      .filter((cat) => cat.categoryName !== '전체')
      .map((cat) => ({
        category_id: cat.categoryId.toString(),
        category_name: cat.categoryName,
        category_name_en: cat.categoryNameEn,
      }));
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !newCategoryNameEn.trim()) {
      toast.error('카테고리 이름을 모두 입력해주세요');
      return;
    }

    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/category`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            categoryName: newCategoryName,
            categoryNameEn: newCategoryNameEn,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok)
        throw new Error(data.message || '카테고리 추가에 실패했습니다');

      toast.success('카테고리가 추가되었습니다');
      setNewCategoryName('');
      setNewCategoryNameEn('');
      fetchCategories(); // 목록 새로고침
    } catch (error: any) {
      console.error('Failed to add category:', error);
      toast.error(error.message || '카테고리 추가에 실패했습니다');
    }
  };

  return (
    <div className='h-full flex-1 p-8 flex flex-col gap-[30px] overflow-y-scroll'>
      <div>
        <h1 className='text-[32px] inter-semibold'>카테고리 관리</h1>
        <h2 className='text-[16px] inter-medium text-ml-gray-dark'>
          Category Management
        </h2>
      </div>
      <main className='flex flex-col gap-8 w-full'>
        <div className='bg-white rounded-3xl p-6 flex flex-col gap-8'>
          <h3 className='text-[18px] inter-semibold'>카테고리 추가</h3>
          <div className='flex gap-4 w-full'>
            <div className='flex flex-col gap-2'>
              <label htmlFor='category-name' className='inter-semibold'>
                카테고리 이름
              </label>
              <div className='flex flex-col gap-4 w-full'>
                <input
                  id='category-name'
                  type='text'
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder='카테고리 이름 (한글)'
                  className='w-[400px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600 placeholder:text-indigo-300'
                />
                <div className='flex gap-8'>
                  <input
                    id='category-name-en'
                    type='text'
                    value={newCategoryNameEn}
                    onChange={(e) => setNewCategoryNameEn(e.target.value)}
                    placeholder='카테고리 이름 (영문)'
                    className='w-[400px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600 placeholder:text-indigo-300'
                  />
                  <button
                    onClick={handleAddCategory}
                    disabled={
                      !newCategoryName.trim() ||
                      !newCategoryNameEn.trim() ||
                      loading
                    }
                    className='flex items-center justify-center gap-2 rounded-2xl hover:cursor-pointer bg-indigo-500 text-white p-4 w-[200px] disabled:opacity-50'
                  >
                    <Image src='/Submit.svg' alt='add' width={16} height={16} />
                    <span className='inter-regular'>
                      {loading ? '처리중...' : '카테고리 추가'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className='bg-white rounded-3xl p-6 flex justify-center items-center h-40'>
            <span className='text-ml-gray-dark'>
              카테고리 정보를 불러오는 중...
            </span>
          </div>
        ) : (
          <>
            <div className='bg-white rounded-3xl p-6 flex flex-col gap-8'>
              <h3 className='text-[18px] inter-semibold'>카테고리 수정</h3>
              <div className='flex gap-4 w-full'>
                <CategoryNameChanger
                  categories={transformCategories(categories)}
                  onUpdate={fetchCategories}
                />
              </div>
            </div>

            <div className='bg-white rounded-3xl p-6 flex flex-col gap-8'>
              <h3 className='text-[18px] inter-semibold'>카테고리 삭제</h3>
              <div className='flex gap-4 w-full'>
                <CategoryDeleter
                  categories={transformCategories(categories)}
                  onDelete={fetchCategories}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
