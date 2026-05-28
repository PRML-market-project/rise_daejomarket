import { Outlet } from 'react-router-dom';
import ChatHistory from '@/features/chat/components/ChatHistory';
import Voice from '@/features/order/components/Voice';
import CategoryList from '@/features/order/components/CategoryList';
import Header from '@/features/order/components/Header';
import { useNavigationStore } from '@/store/navigationStore';

const MainLayout = () => {
  const currentCategoryId = useNavigationStore((s) => s.currentCategoryId);
  const showDefaultImage = !currentCategoryId;

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-background">
      {/* 1) 헤더 - 불투명 */}
      <div className="flex-shrink-0 bg-background border-b border-border z-50">
        <Header />
      </div>

      {/* 2) 카테고리 - 불투명 */}
      <div className="flex-shrink-0 bg-background border-b border-border z-40">
        <CategoryList />
      </div>

{/* 3) 중앙 영역 - 여기만 이미지 허용 */}
<main className="relative flex-1 min-h-0 overflow-y-auto px-2 bg-background">
  {showDefaultImage && (
    <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
      {/* ✅ 여백(왼쪽/오른쪽 레터박스) 색을 이미지 톤(#f5f2ec)으로 고정 */}
      <div className="absolute inset-0 bg-[var(--defaultimage-matte)]" />

      {/* ✅ 이미지는 contain + 50% (이미지에만 투명도 적용) */}
      <div
        className="
          absolute inset-0
          bg-[url('/defaultimage.png')]
          bg-no-repeat bg-center bg-contain
        "
      />
    </div>
  )}

  {/* ✅ 실제 페이지 컨텐츠는 배경 위로 */}
  <div className="relative z-10 h-full">
    <Outlet />
  </div>
</main>


      {/* 4) 채팅+음성 - 불투명 */}
      <div className="flex-shrink-0 flex gap-2 p-2 border-t border-border bg-background z-50">
        <div className="flex-1 bg-[var(--color-blue-100)] rounded-xl overflow-hidden h-[150px]">
          <ChatHistory />
        </div>
        <div className="flex-shrink-0">
          <Voice />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
