import { useState, useCallback } from 'react';
import { bonusApi } from '@/entities/bonus';
import type { Language } from '@/shared/config/i18n';
import {
  getLocalizedRewardsCatalog,
  type TwaRewardItem,
} from '@/shared/constants/twaRewardsCatalog';

export interface DynamicRewardItem extends TwaRewardItem {
  imageUrl?: string;
}

function parseLocalized(raw: string | undefined, lang: Language): string {
  if (!raw) return '';
  try {
    const obj = JSON.parse(raw) as Record<string, string>;
    return obj[lang] ?? obj.ru ?? obj.en ?? '';
  } catch {
    return raw;
  }
}

/** Статический каталог как DynamicRewardItem[] */
function staticItems(lang: Language): DynamicRewardItem[] {
  return getLocalizedRewardsCatalog(lang).map((item) => ({
    ...item,
    imageUrl: undefined,
  }));
}

export function useBonusShopCatalog() {
  // null = ещё не загружали / ошибка → показываем статику
  // [] = загрузили, API вернул пусто → показываем статику
  // [...] = API вернул товары → показываем API + статику
  const [apiItems, setApiItems] = useState<DynamicRewardItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCatalog = useCallback(async (lang: Language) => {
    setLoading(true);
    try {
      const items = await bonusApi.getShopItems();
      const active = items
        .filter((i) => i.isActive)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      setApiItems(
        active.map((item) => ({
          id: `api-${item.id}`,
          price: Number(item.price) || 0,
          title: parseLocalized(item.name, lang),
          description: parseLocalized(item.description, lang),
          location: parseLocalized(item.location, lang) || undefined,
          duration: parseLocalized(item.duration, lang) || undefined,
          chatMessage:
            parseLocalized(item.chatMessage, lang) ||
            `Хочу применить бонус ${item.price} TWA`,
          imageUrl: item.imageUrl || undefined,
        })),
      );
    } catch {
      // при ошибке сети — просто показываем статику
      setApiItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Всегда возвращает статические товары.
   * Если API вернул что-то — они идут первыми, затем статика.
   */
  const getItems = useCallback(
    (lang: Language): DynamicRewardItem[] => {
      const defaults = staticItems(lang);
      if (apiItems === null || apiItems.length === 0) {
        // Ещё грузим или API пуст — только статика
        return defaults;
      }
      // API товары сверху, потом статические заводские
      return [...apiItems, ...defaults];
    },
    [apiItems],
  );

  return { fetchCatalog, getItems, loading };
}
