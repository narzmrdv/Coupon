import { Dimensions, PixelRatio, Platform } from 'react-native';

// Базовые размеры для дизайна (iPhone 14 Pro)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

// Получаем размеры экрана
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Коэффициенты масштабирования
const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

/**
 * Масштабирование по ширине
 * Используется для горизонтальных размеров, отступов, размеров шрифтов
 */
export const wp = (size: number): number => {
  const newSize = size * widthScale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Масштабирование по высоте
 * Используется для вертикальных размеров, отступов
 */
export const hp = (size: number): number => {
  const newSize = size * heightScale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Умеренное масштабирование
 * Масштабирует с меньшим коэффициентом для более плавного перехода
 * Подходит для размеров шрифтов
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
  const newSize = size + (wp(size) - size) * factor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Фиксированный размер шрифта
 * Учитывает настройки шрифтов пользователя
 */
export const fontSize = (size: number): number => {
  const scaledSize = moderateScale(size, 0.4);
  // Ограничиваем минимальный и максимальный размер
  const minSize = size * 0.8;
  const maxSize = size * 1.3;
  return Math.min(Math.max(scaledSize, minSize), maxSize);
};

/**
 * Ширина экрана в процентах
 */
export const widthPercent = (percent: number): number => {
  return (SCREEN_WIDTH * percent) / 100;
};

/**
 * Высота экрана в процентах
 */
export const heightPercent = (percent: number): number => {
  return (SCREEN_HEIGHT * percent) / 100;
};

/**
 * Определение типа устройства
 */
export const isSmallDevice = SCREEN_WIDTH < 375;
export const isMediumDevice = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
export const isLargeDevice = SCREEN_WIDTH >= 414;
export const isTablet = SCREEN_WIDTH >= 768;

/**
 * Определение соотношения сторон
 */
export const isLongDevice = SCREEN_HEIGHT / SCREEN_WIDTH > 2;
export const isShortDevice = SCREEN_HEIGHT / SCREEN_WIDTH < 1.8;

/**
 * Безопасные отступы по платформам
 */
export const getBottomSpace = (): number => {
  if (Platform.OS === 'ios') {
    return isLongDevice ? 34 : 0;
  }
  return 0;
};

/**
 * Адаптивные брейкпоинты
 */
export const breakpoints = {
  xs: 320,
  sm: 375,
  md: 414,
  lg: 768,
  xl: 1024,
} as const;

/**
 * Хелпер для выбора значения по размеру экрана
 */
export const responsive = <T>(options: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  default: T;
}): T => {
  if (SCREEN_WIDTH >= breakpoints.xl && options.xl !== undefined) return options.xl;
  if (SCREEN_WIDTH >= breakpoints.lg && options.lg !== undefined) return options.lg;
  if (SCREEN_WIDTH >= breakpoints.md && options.md !== undefined) return options.md;
  if (SCREEN_WIDTH >= breakpoints.sm && options.sm !== undefined) return options.sm;
  if (SCREEN_WIDTH < breakpoints.sm && options.xs !== undefined) return options.xs;
  return options.default;
};

/**
 * Константы размеров
 */
export const sizes = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,

  // Отступы
  paddingXS: wp(8),
  paddingSM: wp(12),
  paddingMD: wp(16),
  paddingLG: wp(20),
  paddingXL: wp(24),

  // Радиусы
  radiusSM: wp(8),
  radiusMD: wp(12),
  radiusLG: wp(16),
  radiusXL: wp(20),
  radiusFull: wp(50),

  // Иконки
  iconSM: wp(16),
  iconMD: wp(24),
  iconLG: wp(32),
  iconXL: wp(48),

  // Шрифты
  fontXS: fontSize(11),
  fontSM: fontSize(13),
  fontMD: fontSize(15),
  fontLG: fontSize(17),
  fontXL: fontSize(20),
  fontXXL: fontSize(28),
  fontHero: fontSize(40),
} as const;

export default {
  wp,
  hp,
  moderateScale,
  fontSize,
  widthPercent,
  heightPercent,
  isSmallDevice,
  isMediumDevice,
  isLargeDevice,
  isTablet,
  isLongDevice,
  isShortDevice,
  getBottomSpace,
  breakpoints,
  responsive,
  sizes,
};
