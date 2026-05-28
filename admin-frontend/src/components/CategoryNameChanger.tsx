'use client';

import { Category } from '@/types/Category';
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { DropdownMenu, DropdownMenuTrigger } from './ui/dropdown-menu';
import Image from 'next/image';
import { useState } from 'react';
import { fetchWithToken } from '@/utils/fetchWithToken';
import { toast } from 'sonner';

interface CategoryDropdownProps {
  categories: Category[];
  onUpdate?: () => void; // 수정 후 목록 새로고침을 위한 콜백
}

export default function CategoryNameChanger({
  categories,
  onUpdate,
}: CategoryDropdownProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryNameEn, setNewCategoryNameEn] = useState('');
  const [loading, setLoading] = useState(false);

  // "전체" 카테고리를 제외한 카테고리 목록
  const filteredCategories = categories.filter(
    (cat) => cat.category_name !== '전체'
  );

  const handleUpdate = async () => {
    if (!selectedCategory) {
      toast.error('수정할 카테고리를 선택해주세요');
      return;
    }

    if (!newCategoryName.trim() || !newCategoryNameEn.trim()) {
      toast.error('새로운 카테고리 이름을 모두 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/category/${selectedCategory.category_id}`,
        {
          method: 'PUT',
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
        throw new Error(data.message || 'Failed to update category');

      toast.success('카테고리 이름이 수정되었습니다');
      setSelectedCategory(null);
      setNewCategoryName('');
      setNewCategoryNameEn('');
      onUpdate?.(); // 목록 새로고침
    } catch (error: any) {
      console.error('Failed to update category:', error);
      toast.error(error.message || '카테고리 수정에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex w-full gap-8'>
      <div className='flex flex-col gap-2'>
        <DropdownMenu>
          <span className='inter-semibold'>변경할 카테고리</span>
          <DropdownMenuTrigger
            className='outline-0 w-[400px] border border-indigo-300 text-black rounded-2xl flex disabled:opacity-50'
            disabled={loading || filteredCategories.length === 0}
          >
            {filteredCategories.length === 0 ? (
              <span className='inter-regular p-4'>
                생성된 카테고리가 없습니다
              </span>
            ) : (
              <>
                <span className='inter-regular w-full p-4 text-left'>
                  {selectedCategory
                    ? `${selectedCategory.category_name} (${selectedCategory.category_name_en})`
                    : '카테고리 선택'}
                </span>
                <Image
                  src='/DownArrow.svg'
                  alt='arrow-down'
                  width={16}
                  height={16}
                  className='mx-4'
                />
              </>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent className='w-[400px] left-0'>
            <DropdownMenuSeparator />
            {filteredCategories.length === 0 ? (
              <div className='p-4 text-center text-gray-500'>
                생성된 카테고리가 없습니다
              </div>
            ) : (
              filteredCategories.map((category) => (
                <DropdownMenuItem
                  className='w-[400px]'
                  key={category.category_id}
                  onSelect={() => {
                    setSelectedCategory(category);
                    setNewCategoryName(category.category_name);
                    setNewCategoryNameEn(category.category_name_en);
                  }}
                >
                  {`${category.category_name} (${category.category_name_en})`}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className='flex flex-col gap-2'>
        <label htmlFor='category-name' className='inter-semibold'>
          카테고리 이름 수정
        </label>
        <div className='flex flex-col gap-4 w-full'>
          <input
            id='category-name'
            type='text'
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder='새로운 카테고리 이름 (한글)'
            disabled={!selectedCategory || loading}
            className='w-[300px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600 disabled:opacity-50'
          />
          <div className='flex gap-8'>
            <input
              id='category-name-en'
              type='text'
              value={newCategoryNameEn}
              onChange={(e) => setNewCategoryNameEn(e.target.value)}
              placeholder='새로운 카테고리 이름 (영문)'
              disabled={!selectedCategory || loading}
              className='w-[300px] border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600 disabled:opacity-50'
            />
            <button
              onClick={handleUpdate}
              disabled={
                !selectedCategory ||
                !newCategoryName.trim() ||
                !newCategoryNameEn.trim() ||
                loading
              }
              className='flex items-center justify-center gap-2 rounded-2xl hover:cursor-pointer bg-indigo-500 text-white p-4 w-[200px] disabled:opacity-50'
            >
              <Image src='/Submit.svg' alt='add' width={16} height={16} />
              <span className='inter-regular'>
                {loading ? '처리중...' : '이름 변경하기'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
