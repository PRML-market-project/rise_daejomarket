'use client';

import Image from 'next/image';
import { useState, useEffect, FormEvent, useRef } from 'react';
import { fetchWithToken } from '@/utils/fetchWithToken';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import useModal from '@/hooks/useModal';
import AlertModal from '@/components/AlertModal';

interface Menu {
  menuId: number;
  menuName: string;
  menuNameEn: string;
  menuPrice: number;
  imageUrl?: string;
  adminId: number;
  categories: {
    categoryId: number;
    categoryName: string;
  }[];
}

interface Category {
  categoryId: number;
  categoryName: string;
}

const useConfirm = () => {
  const { isOpen, open, close, data } = useModal<{
    onConfirm: () => void;
    message: string;
  }>();

  const ConfirmModal = () => (
    <AlertModal
      isOpen={isOpen}
      onClose={close}
      onConfirm={() => {
        if (data?.onConfirm) data.onConfirm();
        close();
      }}
      message={data?.message || ''}
    />
  );

  return {
    confirm: (message: string, onConfirm: () => void) =>
      open({ message, onConfirm }),
    ConfirmModal,
  };
};

/**
 * 메뉴 이름(영문) 비어있으면 번역 API 호출해서 채우기
 */
async function translateMenuNameIfEmpty(
  koreanName: string,
  currentEn: string
): Promise<string> {
  if (currentEn?.trim()) return currentEn;

  const res = await fetch('/api/translate-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: koreanName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '영문 메뉴 이름 번역에 실패했습니다');
  }

  const data = await res.json();
  const translated = (data.translatedText as string | undefined)?.trim() || '';

  if (!translated) {
    throw new Error('영문 메뉴 이름을 생성하지 못했습니다');
  }

  return translated;
}

/**
 * 이미지 비어있으면 GPT 이미지 생성 API 호출해서 File 객체 만들기
 */
async function generateMenuImageFileIfEmpty(
  prompt: string,
  currentFile: File | null
): Promise<File | null> {
  if (currentFile) return currentFile;

  const res = await fetch('/api/generate-menu-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '메뉴 이미지 생성에 실패했습니다');
  }

  const data = await res.json();
  const imageUrl = data.imageUrl as string | undefined;

  if (!imageUrl) {
    throw new Error('생성된 이미지 URL을 받지 못했습니다');
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error('생성된 이미지를 불러오는데 실패했습니다');
  }

  const blob = await imgRes.blob();
  const file = new File([blob], 'menu-image.png', { type: blob.type || 'image/png' });

  return file;
}

export default function Menus() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const addFormRef = useRef<HTMLFormElement>(null);
  const [menuName, setMenuName] = useState('');
  const [menuNameEn, setMenuNameEn] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [menuCategory, setMenuCategory] = useState('');
  const [menuImage, setMenuImage] = useState<File | null>(null);
  const [updateImage, setUpdateImage] = useState<File | null>(null);

  const { confirm: confirmAction, ConfirmModal } = useConfirm();

  useEffect(() => {
    fetchMenus();
    fetchCategories();
  }, []);

  const fetchMenus = async () => {
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/menus`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to fetch menus');
      setMenus(data);
    } catch (error: any) {
      toast.error(error.message || '메뉴 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/categories`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to fetch categories');

      const filteredCategories = data.filter(
        (cat: Category) => cat.categoryName !== '전체'
      );
      setCategories(filteredCategories);
      if (filteredCategories.length > 0)
        setMenuCategory(filteredCategories[0].categoryId.toString());
    } catch (error: any) {
      toast.error(error.message || '카테고리 목록을 불러오는데 실패했습니다');
    }
  };

  const handleAddMenu = async (e: FormEvent) => {
    e.preventDefault();

    // 필수값: 한글 이름, 가격, 카테고리
    if (!menuName || !menuPrice || !menuCategory) {
      toast.error('메뉴 이름(한글), 가격, 카테고리를 입력해주세요');
      return;
    }

    setSubmitting(true);

    try {
      // 1) 영문 이름 비어있으면 번역 API로 채우기
      const finalMenuNameEn = await translateMenuNameIfEmpty(
        menuName,
        menuNameEn
      );
      setMenuNameEn(finalMenuNameEn);

      // 2) 이미지 비어있으면 GPT 이미지 생성
      const finalMenuImage = await generateMenuImageFileIfEmpty(
        menuName,
        menuImage
      );
      if (!finalMenuImage) {
        throw new Error('메뉴 이미지를 생성하지 못했습니다');
      }
      setMenuImage(finalMenuImage);

      // 3) FormData 구성
      const formData = new FormData();
      formData.append('menuName', menuName);
      formData.append('menuNameEn', finalMenuNameEn);
      formData.append('menuPrice', menuPrice);
      formData.append('categoryIds', menuCategory);
      formData.append('image', finalMenuImage);

      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/menu`,
        { method: 'POST', body: formData }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to add menu');

      toast.success('메뉴가 추가되었습니다');

      // 폼 초기화
      addFormRef.current?.reset();
      setMenuName('');
      setMenuNameEn('');
      setMenuPrice('');
      setMenuImage(null);
      if (categories.length > 0)
        setMenuCategory(categories[0].categoryId.toString());
      fetchMenus();
    } catch (error: any) {
      toast.error(error.message || '메뉴 추가에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateMenu = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedMenu) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append('menuName', selectedMenu.menuName);
    formData.append('menuNameEn', selectedMenu.menuNameEn);
    formData.append('menuPrice', selectedMenu.menuPrice.toString());

    const primaryCategory = selectedMenu.categories.find(
      (cat) => cat.categoryName !== '전체'
    );
    if (primaryCategory) {
      formData.append('categoryIds', primaryCategory.categoryId.toString());
    }

    if (updateImage) {
      formData.append('image', updateImage);
    }

    try {
      const response = await fetchWithToken(
        `${process.env.NEXT_PUBLIC_API_URL}/api/menu/${selectedMenu.menuId}`,
        { method: 'PUT', body: formData }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to update menu');

      toast.success('메뉴가 수정되었습니다');
      setSelectedMenu(null);
      setUpdateImage(null);
      fetchMenus();
    } catch (error: any) {
      toast.error(error.message || '메뉴 수정에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMenu = async (menuId: number) => {
    confirmAction('정말로 이 메뉴를 삭제하시겠습니까?', async () => {
      try {
        const response = await fetchWithToken(
          `${process.env.NEXT_PUBLIC_API_URL}/api/menu/${menuId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || '메뉴 삭제에 실패했습니다');
        }

        toast.success('메뉴가 삭제되었습니다');
        fetchMenus();
      } catch (error: any) {
        toast.error(error.message || '메뉴 삭제에 실패했습니다');
      }
    });
  };

  const filteredMenus =
    selectedCategory === 0
      ? menus
      : menus.filter((menu) =>
          menu.categories.some((cat) => cat.categoryId === selectedCategory)
        );

  return (
    <div className='h-full flex-1 p-8 flex flex-col gap-[30px] overflow-y-scroll'>
      <ConfirmModal />
      <div>
        <h1 className='text-[32px] inter-semibold'>메뉴 관리</h1>
        <h2 className='text-[16px] inter-medium text-ml-gray-dark'>
          Menu Management
        </h2>
      </div>

      <main className='flex flex-col gap-8 w-full'>
        <form
          ref={addFormRef}
          onSubmit={handleAddMenu}
          className='bg-white rounded-3xl p-6 flex flex-col gap-8'
        >
          <h3 className='text-[18px] inter-semibold'>메뉴 추가</h3>
          <div className='flex flex-col gap-4'>
            <div className='flex gap-8'>
              <div className='flex flex-col gap-2 flex-1'>
                <label htmlFor='menu-name' className='inter-semibold'>
                  메뉴 이름 (한글)
                </label>
                <input
                  id='menu-name'
                  type='text'
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  placeholder='메뉴 이름 (한글)'
                  className='border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                />
              </div>
              <div className='flex flex-col gap-2 flex-1'>
                <label htmlFor='menu-name-en' className='inter-semibold'>
                  메뉴 이름 (영문)
                </label>
                <input
                  id='menu-name-en'
                  type='text'
                  value={menuNameEn}
                  onChange={(e) => setMenuNameEn(e.target.value)}
                  placeholder='메뉴 이름 (영문, 비워두면 자동 번역)'
                  className='border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                />
              </div>
            </div>
            <div className='flex gap-8'>
              <div className='flex flex-col gap-2 flex-1'>
                <label htmlFor='menu-price' className='inter-semibold'>
                  가격
                </label>
                <input
                  id='menu-price'
                  type='number'
                  value={menuPrice}
                  onChange={(e) => setMenuPrice(e.target.value)}
                  placeholder='가격'
                  className='border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                />
              </div>
              <div className='flex flex-col gap-2 flex-1'>
                <label htmlFor='menu-category' className='inter-semibold'>
                  카테고리
                </label>
                <select
                  id='menu-category'
                  value={menuCategory}
                  onChange={(e) => setMenuCategory(e.target.value)}
                  className='border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                >
                  {categories.map((category) => (
                    <option
                      key={category.categoryId}
                      value={category.categoryId}
                    >
                      {category.categoryName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className='flex flex-col gap-2'>
              <label htmlFor='menu-image' className='inter-semibold'>
                메뉴 이미지
              </label>
              <input
                id='menu-image'
                type='file'
                accept='image/*'
                onChange={(e) => setMenuImage(e.target.files?.[0] || null)}
                className='border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
              />
              <p className='text-xs text-gray-500'>
                파일을 선택하지 않으면 GPT가 1:1 비율 이미지를 자동 생성합니다.
              </p>
            </div>
            <button
              type='submit'
              disabled={submitting}
              className='flex items-center justify-center gap-2 rounded-2xl hover:cursor-pointer bg-indigo-500 text-white p-4 w-[200px] mt-4 disabled:opacity-50'
            >
              <Image src='/Submit.svg' alt='add' width={16} height={16} />
              <span className='inter-regular'>
                {submitting ? '처리중...' : '메뉴 추가'}
              </span>
            </button>
          </div>
        </form>

        <div className='bg-white rounded-3xl p-6 flex flex-col gap-8'>
          <div className='flex justify-between items-center'>
            <h3 className='text-[18px] inter-semibold'>메뉴 목록</h3>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(Number(e.target.value))}
              className='border border-indigo-300 rounded-xl p-2 focus:outline-0 focus:border-indigo-600'
            >
              <option value={0}>전체 카테고리</option>
              {categories.map((category) => (
                <option key={category.categoryId} value={category.categoryId}>
                  {category.categoryName}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className='text-center py-8'>로딩중...</div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {filteredMenus.map((menu) => (
                <div
                  key={menu.menuId}
                  className='border border-indigo-300 bg-indigo-100 text-indigo-900 rounded-2xl p-4 flex flex-col h-full'
                >
                  <div className='flex-1'>
                    {menu.imageUrl && (
                      <div className='relative w-full h-48 rounded-xl overflow-hidden'>
                        <Image
                          src={`${process.env.NEXT_PUBLIC_API_URL}${menu.imageUrl}`}
                          alt={menu.menuName}
                          fill
                          className='object-cover'
                        />
                      </div>
                    )}
                    <h4 className='text-lg font-semibold mt-2'>
                      {menu.menuName}
                    </h4>
                    <p className='text-sm text-gray-600'>{menu.menuNameEn}</p>
                    <p className='font-semibold'>
                      {menu.menuPrice.toLocaleString()}원
                    </p>
                    <p className='text-indigo-500'>
                      {menu.categories
                        .filter((cat) => cat.categoryName !== '전체')
                        .map((cat) => cat.categoryName)
                        .join(', ')}
                    </p>
                  </div>
                  <div className='flex gap-2 mt-4'>
                    <button
                      onClick={() => setSelectedMenu(menu)}
                      className='flex-1 py-2 px-4 bg-indigo-500 hover:cursor-pointer text-white rounded-xl hover:opacity-80'
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDeleteMenu(menu.menuId)}
                      className='flex-1 py-2 px-4 bg-slate-500 hover:cursor-pointer text-white rounded-xl hover:opacity-80'
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedMenu && (
          <div className='fixed inset-0 bg-black/50 flex items-center justify-center'>
            <form
              onSubmit={handleUpdateMenu}
              className='bg-white rounded-3xl p-6 w-[600px]'
            >
              <h3 className='text-[18px] inter-semibold mb-6'>메뉴 수정</h3>
              <div className='flex flex-col gap-4'>
                <div className='flex gap-8'>
                  <div className='flex flex-col gap-2 flex-1'>
                    <label className='inter-semibold'>메뉴 이름 (한글)</label>
                    <input
                      type='text'
                      value={selectedMenu.menuName}
                      onChange={(e) =>
                        setSelectedMenu({
                          ...selectedMenu,
                          menuName: e.target.value,
                        })
                      }
                      className='border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                    />
                  </div>
                  <div className='flex flex-col gap-2 flex-1'>
                    <label className='inter-semibold'>메뉴 이름 (영문)</label>
                    <input
                      type='text'
                      value={selectedMenu.menuNameEn}
                      onChange={(e) =>
                        setSelectedMenu({
                          ...selectedMenu,
                          menuNameEn: e.target.value,
                        })
                      }
                      className='border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                    />
                  </div>
                </div>
                <div className='flex gap-8'>
                  <div className='flex flex-col gap-2 flex-1'>
                    <label className='inter-semibold'>가격</label>
                    <input
                      type='number'
                      value={selectedMenu.menuPrice}
                      onChange={(e) =>
                        setSelectedMenu({
                          ...selectedMenu,
                          menuPrice: parseInt(e.target.value) || 0,
                        })
                      }
                      className='border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                    />
                  </div>
                  <div className='flex flex-col gap-2 flex-1'>
                    <label className='inter-semibold'>카테고리</label>
                    <DropdownMenu>
                      <DropdownMenuTrigger className='w-full border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600 text-left flex justify-between items-center'>
                        <span>
                          {selectedMenu.categories.find(
                            (cat) => cat.categoryName !== '전체'
                          )?.categoryName || '카테고리 선택'}
                        </span>
                        <Image
                          src='/DownArrow.svg'
                          alt='arrow-down'
                          width={16}
                          height={16}
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className='w-[275px]'>
                        {categories.map((category) => (
                          <DropdownMenuItem
                            key={category.categoryId}
                            onSelect={() =>
                              setSelectedMenu({
                                ...selectedMenu,
                                categories: [category],
                              })
                            }
                          >
                            {category.categoryName}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className='flex flex-col gap-2'>
                  <label className='inter-semibold'>메뉴 이미지</label>
                  {selectedMenu.imageUrl && !updateImage && (
                    <div className='relative w-full h-48 rounded-xl overflow-hidden mb-2'>
                      <Image
                        src={`${process.env.NEXT_PUBLIC_API_URL}${selectedMenu.imageUrl}`}
                        alt={selectedMenu.menuName}
                        fill
                        className='object-cover'
                      />
                    </div>
                  )}
                  <input
                    type='file'
                    accept='image/*'
                    onChange={(e) =>
                      setUpdateImage(e.target.files?.[0] || null)
                    }
                    className='border border-indigo-300 rounded-2xl p-4 focus:outline-0 focus:border-indigo-600'
                  />
                  {updateImage && (
                    <div className='text-sm text-blue-500'>
                      새로운 이미지가 선택되었습니다: {updateImage.name}
                    </div>
                  )}
                </div>
                <div className='flex gap-2 mt-4'>
                  <button
                    type='button'
                    onClick={() => {
                      setSelectedMenu(null);
                      setUpdateImage(null);
                    }}
                    className='flex-1 py-2 px-4 bg-gray-200 rounded-xl hover:cursor-pointer hover:opacity-80'
                  >
                    취소
                  </button>
                  <button
                    type='submit'
                    disabled={submitting}
                    className='flex-1 py-2 px-4 bg-indigo-500 text-white rounded-xl hover:cursor-pointer hover:opacity-80 disabled:opacity-50'
                  >
                    {submitting ? '처리중...' : '저장'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
