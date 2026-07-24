import { Language, localizedCategoryType, localizedValue } from '@/i18n/language';
import { Shop } from '@/types/shop';

export function localizedShopName(language: Language, shop: Shop) {
  if (language === 'ko') return shop.name;

  const translated = localizedValue(language, shop.name, shop.nameEn, shop.nameVi);
  if (translated !== shop.name) return translated;

  return `${localizedCategoryType(language, shop.category)} ${shop.id}`;
}

export function localizedShopNumber(language: Language, shop: Shop) {
  if (language === 'ko') return shop.number;
  const isFront = shop.number.startsWith('앞');
  if (language === 'vi') return `${isFront ? 'Quầy trước' : 'Quầy'} ${shop.id}`;
  return `${isFront ? 'Front stall' : 'Stall'} ${shop.id}`;
}

export function localizedShopSection(language: Language, section: string) {
  if (language === 'ko') return section;

  const sectionTranslations: Record<string, { en: string; vi: string }> = {
    '서측 A구역': { en: 'West Area A', vi: 'Khu A phía Tây' },
    '북측 C구역': { en: 'North Area C', vi: 'Khu C phía Bắc' },
    '북동측 E구역': { en: 'Northeast Area E', vi: 'Khu E phía Đông Bắc' },
    '남측 D구역': { en: 'South Area D', vi: 'Khu D phía Nam' },
  };

  return sectionTranslations[section]?.[language] || section;
}
