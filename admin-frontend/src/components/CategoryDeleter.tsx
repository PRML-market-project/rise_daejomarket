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

interface CategoryDeleterProps {
  categories: Category[];
  onDelete?: () => void; // 삭제 후 목록 새로고침을 위한 콜백
}

export default function CategoryDeleter({
  categories,
  onDelete,
}: CategoryDeleterProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // "전체" 카테고리를 제외한 카테고리 목록
  const filteredCategories = categories.filter(
    (cat) => cat.category_name !== '전체'
  );

  const handleDelete = async () => {
    if (!selectedCategory) {
      toast.error('삭제할 카테고리를 선택해주세요');
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/category/${selectedCategory.category_id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) throw new Error('Failed to delete category');

      toast.success('카테고리가 삭제되었습니다');
      setSelectedCategory(null);
      onDelete?.(); // 목록 새로고침
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('카테고리 삭제에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex w-full gap-8'>
      <div className='flex flex-col gap-2'>
        <DropdownMenu>
          <span className='inter-semibold'>삭제할 카테고리</span>
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
                  onSelect={() => setSelectedCategory(category)}
                >
                  {`${category.category_name} (${category.category_name_en})`}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className='flex flex-col gap-2'>
        <span className='inter-semibold'>카테고리 삭제</span>
        <button
          onClick={handleDelete}
          disabled={!selectedCategory || loading}
          className='flex items-center justify-center gap-2 rounded-2xl hover:cursor-pointer bg-slate-500 text-white p-4 w-[200px] disabled:opacity-50'
        >
          <Image src='/Submit.svg' alt='delete' width={16} height={16} />
          <span className='inter-regular'>
            {loading ? '처리중...' : '삭제하기'}
          </span>
        </button>
      </div>
    </div>
  );
}
