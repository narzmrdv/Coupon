import type { Language } from '@/shared/config/i18n';

type LocalizedRewardText = {
  title: string;
  description: string;
  location?: string;
  duration?: string;
  chatMessage: string;
};

export type TwaRewardCatalogEntry = {
  id: string;
  price: number;
  isSurprise?: boolean;
  ru: LocalizedRewardText;
  en: LocalizedRewardText;
  uk: LocalizedRewardText;
};

export type TwaRewardItem = {
  id: string;
  price: number;
  isSurprise?: boolean;
  title: string;
  description: string;
  location?: string;
  duration?: string;
  chatMessage: string;
};

export const TWA_REWARDS_CATALOG: TwaRewardCatalogEntry[] = [];

const LOCALE_MAP: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uk: 'uk-UA',
};

export function localizeRewardItem(
  entry: TwaRewardCatalogEntry,
  lang: Language,
): TwaRewardItem {
  const text = entry[lang] ?? entry.en;
  return {
    id: entry.id,
    price: entry.price,
    isSurprise: entry.isSurprise,
    title: text.title,
    description: text.description,
    location: text.location,
    duration: text.duration,
    chatMessage: text.chatMessage,
  };
}

export function getLocalizedRewardsCatalog(lang: Language): TwaRewardItem[] {
  return TWA_REWARDS_CATALOG.map((entry) => localizeRewardItem(entry, lang));
}

export function formatTwaPrice(price: number, lang: Language = 'ru'): string {
  return `${price.toLocaleString(LOCALE_MAP[lang])} TWA`;
}
