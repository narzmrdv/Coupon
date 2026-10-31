import type { Language } from '@/shared/config/i18n';

const LOCALE_MAP: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uk: 'uk-UA',
};

export type ChatDateLabels = { today: string; yesterday: string };

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function getChatDayKey(dateString: string): string {
  const date = new Date(dateString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatChatDayLabel(
  dateString: string,
  lang: Language,
  labels: ChatDateLabels,
): string {
  const date = new Date(dateString);
  const todayStart = startOfLocalDay(new Date());
  const msgStart = startOfLocalDay(date);
  if (msgStart === todayStart) {
    return labels.today;
  }
  if (msgStart === todayStart - 86400000) {
    return labels.yesterday;
  }
  return date.toLocaleDateString(LOCALE_MAP[lang], {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

/** «Сегодня, 14:30» / «26 мая, 14:30» */
export function formatChatMessageDateTime(
  dateString: string,
  lang: Language,
  labels: ChatDateLabels,
): string {
  const date = new Date(dateString);
  const dayLabel = formatChatDayLabel(dateString, lang, labels);
  const time = date.toLocaleTimeString(LOCALE_MAP[lang], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dayLabel}, ${time}`;
}
