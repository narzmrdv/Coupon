import { INSTALLMENT_CURRENCY } from './installmentCalculator';

const MINOR_UNIT_SCALE = 100;

export const parseMoneyToMinor = (value: string): number | null => {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');

  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  const [wholePart, fractionPart = ''] = normalized.split('.');
  const whole = Number(wholePart);
  const fraction = Number(fractionPart.padEnd(2, '0'));

  if (!Number.isSafeInteger(whole) || whole < 0) {
    return null;
  }

  const minor = whole * MINOR_UNIT_SCALE + fraction;
  return Number.isSafeInteger(minor) ? minor : null;
};

export const majorToMinor = (amount: number): number | null => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return parseMoneyToMinor(amount.toFixed(2));
};

export const minorToInputValue = (minor: number): string => {
  const whole = Math.floor(minor / MINOR_UNIT_SCALE);
  const fraction = minor % MINOR_UNIT_SCALE;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`;
};

export const formatMoney = (
  minor: number,
  language: 'en' | 'ru' | 'uk',
): string => {
  const locale = language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: INSTALLMENT_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / MINOR_UNIT_SCALE);
};
