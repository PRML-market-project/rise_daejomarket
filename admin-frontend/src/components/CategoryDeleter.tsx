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
  onDelete?: () => void;
}

export default function CategoryDeleter({
  categories,
  onDelete,
}: CategoryDeleterProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const [loading, setLoading] = useState(false);

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
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete category');

      toast.success('카테고리가 삭제되었습니다');
      setSelectedCategory(null);
      onDelete?.();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('카테고리 삭제에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const outlineTrigger =
    'outline-none w-full sm:w-[300px] md:w-[400px] lg:w-[500px] xl:w-[600px] rounded-2xl flex items-center justify-between bg-card text-foreground border border-border transition focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed p-3 md:p-4 lg:p-5 xl:p-6 text-sm md:text-base lg:text-lg';

  const dangerBtn =
    'flex items-center justify-center gap-2 rounded-2xl p-3 md:p-4 lg:p-5 xl:p-6 w-full sm:w-[180px] md:w-[200px] lg:w-[240px] xl:w-[280px] h-[48px] sm:h-[52px] md:h-[56px] lg:h-[64px] xl:h-[72px] font-medium transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed bg-destructive text-white hover:opacity-95 text-sm sm:text-base md:text-lg lg:text-xl';

  return (
    <div className="flex flex-col lg:flex-row w-full gap-4 sm:gap-6 md:gap-8 lg:gap-10 xl:gap-12">
      <div className="flex flex-col gap-2 sm:gap-3">
        <DropdownMenu>
          <span className="inter-semibold text-foreground text-sm sm:text-base md:text-lg lg:text-xl">삭제할 점포</span>

          <DropdownMenuTrigger
            className={outlineTrigger}
            disabled={loading || filteredCategories.length === 0}
          >
            {filteredCategories.length === 0 ? (
              <span className="inter-regular text-muted-foreground">
                생성된 카테고리가 없습니다
              </span>
            ) : (
              <>
                <span className="inter-regular w-full text-left">
                  {selectedCategory
                    ? `${selectedCategory.category_name} (${selectedCategory.category_name_en})`
                    : '점포 선택'}
                </span>
                <Image
                  src="/DownArrow.svg"
                  alt="arrow-down"
                  width={16}
                  height={16}
                  className="ml-2 sm:ml-4 opacity-70 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                />
              </>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-full sm:w-[300px] md:w-[400px] lg:w-[500px] xl:w-[600px] left-0 bg-card text-foreground border border-border text-sm md:text-base lg:text-lg">
            <DropdownMenuSeparator />
            {filteredCategories.length === 0 ? (
              <div className="p-3 md:p-4 lg:p-5 text-center text-muted-foreground">
                생성된 카테고리가 없습니다
              </div>
            ) : (
              filteredCategories.map((category) => (
                <DropdownMenuItem
                  key={category.category_id}
                  className="w-full cursor-pointer focus:bg-accent focus:text-foreground p-3 md:p-4 lg:p-5"
                  onSelect={() => setSelectedCategory(category)}
                >
                  {`${category.category_name} (${category.category_name_en})`}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-2 sm:gap-3">
        <span className="inter-semibold text-foreground text-sm sm:text-base md:text-lg lg:text-xl">점포 삭제</span>

        <button
          onClick={handleDelete}
          disabled={!selectedCategory || loading}
          className={dangerBtn}
        >
          <Image src="/Submit.svg" alt="delete" width={16} height={16} className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          <span className="inter-regular">
            {loading ? '처리중...' : '삭제하기'}
          </span>
        </button>
      </div>
    </div>
  );
}
