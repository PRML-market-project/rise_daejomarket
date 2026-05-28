import { useState } from 'react';
import { useChatStore } from '@/features/chat/store/chatStore';
import { useCartStore } from '@/store/cartStore';
import { useMenuStore } from '@/store/menuStore';
import { useNavigationStore } from '@/store/navigationStore';
import { useOrderStore } from '@/features/order/store/orderStore';
import { getSpeech } from '@/utils/getSpeech';
import { useLanguageStore } from '@/store/languageStore';
import { useParams } from 'react-router-dom';
import { useOrderHistoryStore } from '@/store/orderHistoryStore';
import { useMapStore } from '@/store/mapStore'; // ✅ MapStore 추가
import { marketShops } from '@/data/market-shops';

interface UseTextApiProps {
  apiUrl: string;
}

interface ResponseItem {
  menu_id?: number;
  category_id?: number;
  category_type?: string;
  quantity?: number;
  state?: string;
  target_id?: string;
  // get_total_price 계산 결과용 필드들
  item_name?: string;
  unit_price?: number;
  total_price?: number;
}

interface TextApiResponse {
  user_message: string;
  chat_message: string | null; // ✅ null 가능하도록 수정
  result: {
    status: string;
    intent: string;
    kiosk_id: number;
    admin_id: number;
    items: ResponseItem[];
  };
}

export const useGpt = ({ apiUrl }: UseTextApiProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addMessage, updateLastMessage } = useChatStore();
  const { categories } = useMenuStore();
  const {
    setCurrentCategory,
    setCurrentMenu,
    setCurrentView,
    setCurrentCategoryType,
    setHighlightedCategoryIds, // ✅ 스토어 액션 사용
  } = useNavigationStore();

  const { language } = useLanguageStore();

  // ✅ 지도 스토어에서 함수 가져오기
  const { selectAndNavigate } = useMapStore();

  const getJosa = (word: string, josa1: string, josa2: string) => {
    const lastChar = word.charCodeAt(word.length - 1);
    const hasJongseong = (lastChar - 0xAC00) % 28 > 0;
    return hasJongseong ? josa1 : josa2;
  };

  const processIntent = (
    intent: string,
    items: ResponseItem[],
    admin_id: number,
    kiosk_id: number,
    chat_message: string | null // ✅ null 허용
  ) => {
    // 디버깅용 로그
    console.log('GPT Intent:', intent);
    console.log('GPT Items:', items);

    // ✅ chat_message가 null일 경우 안전하게 빈 문자열 처리
    const safeMessage = chat_message || '';

    if (!intent) {
      if (safeMessage) {
        updateLastMessage(safeMessage);
        getSpeech(safeMessage, language === 'en' ? 'en' : 'ko');
      }
      return;
    }

    switch (intent) {
      // ---------------------------------------------------------
      // 1. 가게(Category) 탐색
      // ---------------------------------------------------------
      case 'get_store':
        if (safeMessage) {
          updateLastMessage(safeMessage);
          getSpeech(safeMessage, language === 'en' ? 'en' : 'ko');
        }

        if (items.length > 0) {
          const { category_type } = items[0] ?? {};

          // 1) 뷰 및 대분류 설정
          setCurrentView('menu');
          if (category_type) {
            setCurrentCategoryType(category_type);
          }

          // 2) ✅ 관련된 모든 카테고리 ID 추출하여 깜빡임 설정
          const categoryIds = items
            .map((item) => item.category_id)
            .filter((id): id is number => id != null);

          setHighlightedCategoryIds(categoryIds);

          // 3) 최저가(첫 번째) 가게 자동 선택
          if (categoryIds.length > 0) {
            setCurrentCategory(categoryIds[0]);
          }
        }
        break;

      // ---------------------------------------------------------
      // 2. 메뉴(Menu) 탐색
      // ---------------------------------------------------------
      case 'get_menu':
        if (safeMessage) {
          updateLastMessage(safeMessage);
          getSpeech(safeMessage, language === 'en' ? 'en' : 'ko');
        }

        if (items.length > 0) {
          const { category_id, category_type, menu_id } = items[0] ?? {};

          setCurrentView('menu');

          if (category_type) {
            setCurrentCategoryType(category_type);
          }

          if (category_id != null) {
            setCurrentCategory(Number(category_id));
          }

          if (menu_id != null) {
            setCurrentMenu(Number(menu_id));
          }
        }
        break;

      // ---------------------------------------------------------
      // 3. 총 가격 계산 (get_total_price)
      // ---------------------------------------------------------
      case 'get_total_price':
        // 1. 메시지 및 음성 안내
        if (safeMessage) {
          updateLastMessage(safeMessage);
          getSpeech(safeMessage, language === 'en' ? 'en' : 'ko');
        }

        // 2. 언급된 상품이 있는 가게들을 깜빡이게 처리 (시각적 보조)
        if (items && items.length > 0) {
          // 화면을 메뉴판으로 이동 (선택 사항, 대화 집중하려면 제거 가능)
          setCurrentView('menu');

          // 첫 번째 아이템의 카테고리 타입으로 탭 전환
          const { category_type } = items[0] ?? {};
          if (category_type) setCurrentCategoryType(category_type);

          // 관련된 모든 가게 ID 추출 및 깜빡임
          const categoryIds = items
            .map((item) => item.category_id)
            .filter((id): id is number => id != null);

          const uniqueIds = Array.from(new Set(categoryIds));
          setHighlightedCategoryIds(uniqueIds);
        }
        console.log('총 가격 계산 완료:', safeMessage);
        break;

      // ---------------------------------------------------------
      // 4. 위치/지도 안내 (get_location)
      // ---------------------------------------------------------
      case 'get_location':
        // ✅ chat_message가 null이면 빈 문자열로 시작, 아래 로직에서 메시지 생성
        let finalMessage = safeMessage;

        if (items.length > 0 && items[0]?.target_id) {
          const targetId = String(items[0].target_id);
          const shopInfo = marketShops.find((s) => s.id === targetId);

          if (shopInfo) {
            // ✅ 가게 정보를 찾았으면 메시지 생성 (GPT 메시지가 null이어도 여기서 생성됨)
            const josa = getJosa(shopInfo.name, '은', '는');
            finalMessage = `${shopInfo.name}${josa} ${shopInfo.section} ${shopInfo.number}에 있어요.`;

            // 지도 이동 및 안내 시작
            setCurrentView('orderHistory');
            setCurrentCategoryType(null);
            setCurrentCategory(null);
            setCurrentMenu(null);
            selectAndNavigate(targetId);
          } else {
            // 가게 ID는 왔는데 데이터에 없는 경우
            finalMessage =
              language === 'en'
                ? 'Shop location not found.'
                : '가게 위치 정보를 찾을 수 없습니다.';
          }
        } else {
          // items가 비어있을 때 메시지가 null이면 기본 메시지 출력
          if (!finalMessage) {
            finalMessage =
              language === 'en'
                ? 'I could not find that location.'
                : '위치 정보를 찾을 수 없습니다.';
          }
        }

        // 최종 메시지 출력 및 음성 안내
        updateLastMessage(finalMessage);
        getSpeech(finalMessage, language === 'en' ? 'en' : 'ko');
        break;

      // ---------------------------------------------------------
      // 5. 그 외 (잡담 등)
      // ---------------------------------------------------------
      default:
        if (safeMessage) {
          updateLastMessage(safeMessage);
          getSpeech(safeMessage, language === 'en' ? 'en' : 'ko');
        }
        break;
    }
  };

  const sendTextToApi = async (
    text: string,
    admin_id: string,
    kiosk_id: string
  ): Promise<TextApiResponse> => {
    if (!apiUrl) throw new Error('API URL이 설정되지 않았습니다.');

    setIsProcessing(true);
    addMessage({
      text: 'loading',
      isUser: false,
      timestamp: Date.now(),
    });
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/gpt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id, kiosk_id, text }),
      });

      if (!response.ok) throw new Error('GPT 서버 응답 오류');

      const responseText = await response.text();
      let data: any;
      let isJson = false;

      try {
        data = JSON.parse(responseText);
        if (data && typeof data === 'object') isJson = true;
      } catch (e) {
        isJson = false;
      }

      if (!isJson) {
        console.log('Non-JSON Response:', responseText);
        updateLastMessage(responseText);
        getSpeech(responseText, language === 'en' ? 'en' : 'ko');
        return {
          user_message: text,
          chat_message: responseText,
          result: {
            status: 'success',
            intent: '',
            kiosk_id: Number(kiosk_id),
            admin_id: Number(admin_id),
            items: [],
          },
        };
      }

      console.log('GPT Response JSON:', data);

      // ✅ 수정된 조건문: 인텐트가 있거나, 메시지가 있으면 처리
      // (chat_message가 null이어도 intent가 있으면 processIntent 실행)
      if (data.result && data.result.intent) {
        processIntent(
          data.result.intent,
          data.result.items,
          data.result.admin_id,
          data.result.kiosk_id,
          data.chat_message
        );
      } else if (data.chat_message) {
        // 인텐트는 없지만 메시지는 있는 경우 (잡담 등)
        processIntent(
          '',
          [],
          data.result?.admin_id || 0,
          data.result?.kiosk_id || 0,
          data.chat_message
        );
      }

      return data as TextApiResponse;
    } catch (err) {
      console.error('Error sending text:', err);
      const errorMessage =
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
      const failMessage =
        language === 'en'
          ? 'Error has occurred'
          : '알 수 없는 오류가 발생했습니다.';
      updateLastMessage(failMessage);
      getSpeech(failMessage, language === 'en' ? 'en' : 'ko');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    error,
    sendTextToApi,
  };
};