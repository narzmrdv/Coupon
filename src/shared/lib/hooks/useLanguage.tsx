import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { translations, Language } from '../../config/i18n';

interface LanguageContextType {
  language: Language;
  currentLang: Language; // Alias for language
  setLanguage: (language: Language) => void;
  t: Record<string, any>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_KEY = '@app_language';

// Функция для получения языка системы
const getDeviceLanguage = (): Language => {
  // Получаем массив локалей устройства в порядке предпочтения
  const locales = Localization.getLocales();

  if (locales && locales.length > 0) {
    // Берем первую локаль (наиболее предпочтительную)
    const languageCode = locales[0].languageCode?.toLowerCase();

    // Проверяем, поддерживается ли язык
    if (languageCode === 'ru') return 'ru';
    if (languageCode === 'uk') return 'uk';
    // По умолчанию английский
    return 'en';
  }

  return 'en';
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isInitialized, setIsInitialized] = useState(false);

  // Инициализация языка при загрузке приложения
  // По умолчанию всегда английский, пока пользователь не выберет другой
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

        if (savedLanguage) {
          // Если язык был сохранен ранее, используем его
          setLanguageState(savedLanguage as Language);
        } else {
          // По умолчанию английский язык
          setLanguageState('en');
          // Сохраняем выбранный язык
          await AsyncStorage.setItem(LANGUAGE_KEY, 'en');
        }
      } catch (error) {
        if (__DEV__) console.error('Error loading language:', error);
        // В случае ошибки используем английский
        setLanguageState('en');
      } finally {
        setIsInitialized(true);
      }
    };

    initLanguage();
  }, []);

  const setLanguage = useCallback((newLanguage: Language) => {
    try {
      AsyncStorage.setItem(LANGUAGE_KEY, newLanguage);
      setLanguageState(newLanguage);
    } catch (error) {
      if (__DEV__) console.error('Error saving language:', error);
    }
  }, []);

  const value: LanguageContextType = {
    language,
    currentLang: language, // Alias for language
    setLanguage,
    t: translations[language],
  };

  // Показываем детей только после инициализации языка
  if (!isInitialized) {
    return null;
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
