/**
 * Утилиты для работы с локализацией
 */

export type Language = 'ru' | 'en' | 'uk';

/**
 * Парсинг локализованного текста из JSON строки
 * @param jsonString - JSON строка вида {"ru": "...", "en": "...", "uk": "..."}
 * @param lang - текущий язык
 * @param fallback - язык по умолчанию
 * @returns локализованный текст
 */
export const getLocalizedText = (
  jsonString: string,
  lang: Language,
  fallback: Language = 'en'
): string => {
  try {
    const obj = JSON.parse(jsonString);
    return obj[lang] || obj[fallback] || obj.ru || jsonString;
  } catch {
    return jsonString;
  }
};

/**
 * Форматирование даты в локализованном формате
 * @param dateString - ISO строка даты
 * @param lang - текущий язык
 * @returns отформатированная дата
 */
export const formatLocalizedDate = (dateString: string, lang: Language = 'ru'): string => {
  const date = new Date(dateString);
  const localeMap: Record<Language, string> = {
    ru: 'ru-RU',
    en: 'en-US',
    uk: 'uk-UA',
  };

  return date.toLocaleDateString(localeMap[lang], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Форматирование числа в локализованном формате
 * @param num - число
 * @param lang - текущий язык
 * @returns отформатированное число
 */
export const formatLocalizedNumber = (num: number, lang: Language = 'ru'): string => {
  const localeMap: Record<Language, string> = {
    ru: 'ru-RU',
    en: 'en-US',
    uk: 'uk-UA',
  };

  return num.toLocaleString(localeMap[lang]);
};
