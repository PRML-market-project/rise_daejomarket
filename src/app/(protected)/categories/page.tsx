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
  categoryType: string;
  adminId: number;
  menus: any[];
}

export default function Categories() {
  const [categories, setCategories] = useState<APICategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryNameEn, setNewCategoryNameEn] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('');
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

  const transformCategories = (
    apiCategories: APICategory[]
  ): ComponentCategory[] => {
    return apiCategories
      .filter((cat) => cat.categoryName !== '전체')
      .map((cat) => ({
        category_id: cat.categoryId.toString(),
        category_name: cat.categoryName,
        category_name_en: cat.categoryNameEn,
        category_type: cat.categoryType,
      }));
  };

  const handleAddCategory = async () => {
    if (
      !newCategoryName.trim() ||
      !newCategoryNameEn.trim() ||
      !newCategoryType.trim()
    ) {
      toast.error('점포 이름과 타입을 모두 입력해주세요');
      return;
    }

    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/category`,
        {
          method: 'POST',
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
        throw new Error(data.message || '카테고리 추가에 실패했습니다');

      toast.success('카테고리가 추가되었습니다');
      setNewCategoryName('');
      setNewCategoryNameEn('');
      setNewCategoryType('');
      fetchCategories();
    } catch (error: any) {
      console.error('Failed to add category:', error);
      toast.error(error.message || '카테고리 추가에 실패했습니다');
    }
  };

  const inputBase =
    'w-full sm:w-[300px] md:w-[400px] lg:w-[500px] xl:w-[600px] rounded-2xl p-3 md:p-4 lg:p-5 xl:p-6 bg-card text-foreground border border-border outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring focus:border-transparent text-sm md:text-base lg:text-lg';

  return (
    <div className="h-full flex-1 p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12 flex flex-col gap-4 sm:gap-6 md:gap-8 lg:gap-[30px] xl:gap-12 overflow-y-scroll bg-background">
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl inter-semibold text-foreground">점포 관리</h1>
        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl inter-medium text-muted-foreground">
          Store Management
        </h2>
      </div>

      <main className="flex flex-col gap-4 sm:gap-6 md:gap-8 lg:gap-10 xl:gap-12 w-full">
        {/* Add */}
        <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 lg:p-8 xl:p-10 flex flex-col gap-4 sm:gap-6 md:gap-8 lg:gap-10 border border-border shadow-sm">
          <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl inter-semibold text-foreground">
            점포 추가
          </h3>

          <div className="flex flex-col gap-3 sm:gap-4 md:gap-5 lg:gap-6 w-full">
            <div className="flex flex-col gap-2 sm:gap-3">
              <label
                htmlFor="category-name"
                className="inter-semibold text-foreground text-sm sm:text-base md:text-lg lg:text-xl"
              >
                점포 이름 (한글)
              </label>
              <input
                id="category-name"
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="점포 이름 (한글)"
                className={inputBase}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 md:gap-8 lg:gap-10 xl:gap-12 items-end">
              <div className="flex flex-col gap-2 sm:gap-3 flex-1">
                <label
                  htmlFor="category-name-en"
                  className="inter-semibold text-foreground text-sm sm:text-base md:text-lg lg:text-xl"
                >
                  점포 이름 (영문)
                </label>
                <input
                  id="category-name-en"
                  type="text"
                  value={newCategoryNameEn}
                  onChange={(e) => setNewCategoryNameEn(e.target.value)}
                  placeholder="점포 이름 (영문)"
                  className={inputBase}
                />
              </div>

              <div className="flex flex-col gap-2 sm:gap-3 flex-1">
                <label
                  htmlFor="category-type"
                  className="inter-semibold text-foreground text-sm sm:text-base md:text-lg lg:text-xl"
                >
                  카테고리 타입
                </label>
                <input
                  id="category-type"
                  type="text"
                  value={newCategoryType}
                  onChange={(e) => setNewCategoryType(e.target.value)}
                  placeholder="카테고리 타입을 입력하세요"
                  className={inputBase}
                />
              </div>

              <button
                onClick={handleAddCategory}
                disabled={
                  !newCategoryName.trim() ||
                  !newCategoryNameEn.trim() ||
                  !newCategoryType.trim() ||
                  loading
                }
                className={[
                  'flex items-center justify-center gap-2 rounded-2xl p-3 md:p-4 lg:p-5 xl:p-6',
                  'w-full sm:w-[180px] md:w-[200px] lg:w-[240px] xl:w-[280px]',
                  'h-[48px] sm:h-[52px] md:h-[56px] lg:h-[64px] xl:h-[72px]',
                  'bg-primary text-primary-foreground hover:opacity-95 transition',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'text-sm sm:text-base md:text-lg lg:text-xl',
                ].join(' ')}
              >
                <Image src="/Submit.svg" alt="add" width={16} height={16} className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                <span className="inter-regular text-white">
                  {loading ? '처리중...' : '점포 추가'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 lg:p-8 flex justify-center items-center h-32 sm:h-40 md:h-48 lg:h-56 border border-border shadow-sm">
            <span className="text-muted-foreground text-sm sm:text-base md:text-lg lg:text-xl">
              점포 정보를 불러오는 중...
            </span>
          </div>
        ) : (
          <>
            {/* Edit */}
            <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 lg:p-8 xl:p-10 flex flex-col gap-4 sm:gap-6 md:gap-8 lg:gap-10 border border-border shadow-sm">
              <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl inter-semibold text-foreground">
                점포 수정
              </h3>
              <div className="flex gap-4 sm:gap-6 md:gap-8 w-full">
                <CategoryNameChanger
                  categories={transformCategories(categories)}
                  onUpdate={fetchCategories}
                />
              </div>
            </div>

            {/* Delete */}
            <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-6 lg:p-8 xl:p-10 flex flex-col gap-4 sm:gap-6 md:gap-8 lg:gap-10 border border-border shadow-sm">
              <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl inter-semibold text-foreground">
                점포 삭제
              </h3>
              <div className="flex gap-4 sm:gap-6 md:gap-8 w-full">
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
