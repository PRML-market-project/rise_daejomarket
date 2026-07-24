export type Language = 'ko' | 'en' | 'vi';

export const languageLabels: Record<Language, string> = {
  ko: 'KO',
  en: 'EN',
  vi: 'VI',
};

export const speechRecognitionLocales: Record<Language, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  vi: 'vi-VN',
};

export function localizedValue(
  language: Language,
  korean: string,
  english?: string | null,
  vietnamese?: string | null
) {
  if (language === 'vi') return vietnamese || english || korean;
  if (language === 'en') return english || korean;
  return korean;
}

const categoryTypeTranslations: Record<
  string,
  { en: string; vi: string }
> = {
  청과: { en: 'Produce', vi: 'Rau củ quả' },
  식품: { en: 'Groceries', vi: 'Thực phẩm' },
  정육: { en: 'Meat', vi: 'Thịt' },
  수산: { en: 'Seafood', vi: 'Hải sản' },
  식당: { en: 'Food', vi: 'Quán ăn' },
  잡화: { en: 'General goods', vi: 'Hàng tạp hóa' },
  '농산물 가공': { en: 'Processed foods', vi: 'Nông sản chế biến' },
  서비스업: { en: 'Services', vi: 'Dịch vụ' },
  공실: { en: 'Vacant', vi: 'Còn trống' },
  기타: { en: 'Other', vi: 'Khác' },
};

export function localizedCategoryType(language: Language, categoryType: string) {
  if (language === 'ko') return categoryType;
  return categoryTypeTranslations[categoryType]?.[language] || categoryType;
}

const ui = {
  kioskTitle: {
    ko: '대조시장 키오스크',
    en: 'Daejo Market Kiosk',
    vi: 'Ki-ốt chợ Daejo',
  },
  map: { ko: '지도', en: 'Map', vi: 'Bản đồ' },
  mapTitle: {
    ko: '대조시장 배치도',
    en: 'Daejo Market Map',
    vi: 'Sơ đồ chợ Daejo',
  },
  shopCategories: {
    ko: '점포 업종',
    en: 'Shop Categories',
    vi: 'Ngành hàng',
  },
  currentLocation: {
    ko: '현위치',
    en: 'You are here',
    vi: 'Vị trí hiện tại',
  },
  startNavigation: {
    ko: '길안내 시작',
    en: 'Start directions',
    vi: 'Bắt đầu chỉ đường',
  },
  stopNavigation: {
    ko: '안내 종료',
    en: 'Stop directions',
    vi: 'Dừng chỉ đường',
  },
  locationDetails: {
    ko: '상세 위치',
    en: 'Location',
    vi: 'Vị trí',
  },
  businessHours: {
    ko: '운영 정보',
    en: 'Business hours',
    vi: 'Giờ hoạt động',
  },
  cart: { ko: '장바구니', en: 'Cart', vi: 'Giỏ hàng' },
  emptyCart: {
    ko: '장바구니가 비어 있어요',
    en: 'Your cart is empty',
    vi: 'Giỏ hàng đang trống',
  },
  placeOrder: { ko: '주문하기', en: 'Place Order', vi: 'Đặt hàng' },
  total: { ko: '총 주문 금액:', en: 'Total:', vi: 'Tổng cộng:' },
  error: {
    ko: '알 수 없는 오류가 발생했습니다.',
    en: 'An error has occurred.',
    vi: 'Đã xảy ra lỗi.',
  },
  locationNotFound: {
    ko: '위치 정보를 찾을 수 없습니다.',
    en: 'I could not find that location.',
    vi: 'Không tìm thấy thông tin vị trí.',
  },
} as const;

export type UiKey = keyof typeof ui;

export function t(language: Language, key: UiKey) {
  return ui[key][language];
}
