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
  onUpdate?: () => void;
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
  const [newCategoryType, setNewCategoryType] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredCategories = categories.filter(
    (cat) => cat.category_name !== '전체'
  );

  const handleUpdate = async () => {
    if (!selectedCategory) {
      toast.error('수정할 카테고리를 선택해주세요');
      return;
    }

    if (
      !newCategoryName.trim() ||
      !newCategoryNameEn.trim() ||
      !newCategoryType.trim()
    ) {
      toast.error('새로운 카테고리 이름과 타입을 모두 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/category/${selectedCategory.category_id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryName: newCategoryName,
            categoryNameEn: newCategoryNameEn,
            categoryType: newCategoryType,
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
      setNewCategoryType('');
      onUpdate?.();
    } catch (error: any) {
      console.error('Failed to update category:', error);
      toast.error(error.message || '카테고리 수정에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    'rounded-2xl p-3 md:p-4 lg:p-5 xl:p-6 bg-card text-foreground border border-border outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base lg:text-lg';

  const primaryBtn =
    'flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground hover:opacity-95 transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col lg:flex-row w-full gap-4 sm:gap-6 md:gap-8 lg:gap-10 xl:gap-12">
      {/* Dropdown */}
      <div className="flex flex-col gap-2 sm:gap-3">
        <DropdownMenu>
          <span className="inter-semibold text-foreground text-sm sm:text-base md:text-lg lg:text-xl">변경할 점포</span>

          <DropdownMenuTrigger
            className={[
              'outline-none w-full sm:w-[300px] md:w-[400px] lg:w-[500px] xl:w-[600px] rounded-2xl flex items-center justify-between',
              'bg-card text-foreground border border-border',
              'transition focus:ring-2 focus:ring-ring focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'p-3 md:p-4 lg:p-5 xl:p-6 text-sm md:text-base lg:text-lg',
            ].join(' ')}
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
                  className="w-full cursor-pointer focus:bg-accent focus:text-foreground p-3 md:p-4 lg:p-5"
                  key={category.category_id}
                  onSelect={() => {
                    setSelectedCategory(category);
                    setNewCategoryName(category.category_name);
                    setNewCategoryNameEn(category.category_name_en);
                    setNewCategoryType(category.category_type);
                  }}
                >
                  {`${category.category_name} (${category.category_name_en})`}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-2 sm:gap-3 flex-1">
        <label className="inter-semibold text-foreground text-sm sm:text-base md:text-lg lg:text-xl">점포 정보 수정</label>

        <div className="flex flex-col gap-3 sm:gap-4 md:gap-5 lg:gap-6 w-full">
          <div className="flex flex-col gap-2 sm:gap-3">
            <label
              htmlFor="category-name"
              className="inter-semibold text-foreground text-xs sm:text-sm md:text-base lg:text-lg"
            >
              점포 이름 (한글)
            </label>
            <input
              id="category-name"
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="새로운 점포 이름 (한글)"
              disabled={!selectedCategory || loading}
              className={[inputBase, 'w-full'].join(' ')}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 lg:gap-10 xl:gap-12 items-end">
            <div className="flex flex-col gap-2 sm:gap-3 flex-1">
              <label
                htmlFor="category-name-en"
                className="inter-semibold text-foreground text-xs sm:text-sm md:text-base lg:text-lg"
              >
                점포 이름 (영문)
              </label>
              <input
                id="category-name-en"
                type="text"
                value={newCategoryNameEn}
                onChange={(e) => setNewCategoryNameEn(e.target.value)}
                placeholder="새로운 점포 이름 (영문)"
                disabled={!selectedCategory || loading}
                className={[inputBase, 'w-full'].join(' ')}
              />
            </div>

            <div className="flex flex-col gap-2 sm:gap-3 flex-1">
              <label
                htmlFor="category-type"
                className="inter-semibold text-foreground text-xs sm:text-sm md:text-base lg:text-lg"
              >
                카테고리 타입
              </label>
              <input
                id="category-type"
                type="text"
                value={newCategoryType}
                onChange={(e) => setNewCategoryType(e.target.value)}
                placeholder="카테고리 타입을 입력하세요"
                disabled={!selectedCategory || loading}
                className={[inputBase, 'w-full'].join(' ')}
              />
            </div>

            <button
              onClick={handleUpdate}
              disabled={
                !selectedCategory ||
                !newCategoryName.trim() ||
                !newCategoryNameEn.trim() ||
                !newCategoryType.trim() ||
                loading
              }
              className={[primaryBtn, 'w-full sm:w-[180px] md:w-[200px] lg:w-[240px] xl:w-[280px] h-[48px] sm:h-[52px] md:h-[56px] lg:h-[64px] xl:h-[72px] text-white p-3 md:p-4 lg:p-5 xl:p-6 text-sm sm:text-base md:text-lg lg:text-xl'].join(' ')}
            >
              <Image src="/Submit.svg" alt="add" width={16} height={16} className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              <span className="inter-regular">
                {loading ? '처리중...' : '수정하기'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
