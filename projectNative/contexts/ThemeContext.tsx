import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeColors, ColorScheme } from '@/constants/Colors';

interface ThemeContextType {
  scheme:     ColorScheme;
  colors:     ThemeColors;
  isDark:     boolean;
  toggleTheme: () => void;
  setTheme:   (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_KEY = 'app_theme_v1';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme() as ColorScheme ?? 'light';
  const [scheme, setScheme] = useState<ColorScheme>(systemScheme);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setScheme(saved);
    });
  }, []);

  const setTheme = async (s: ColorScheme) => {
    setScheme(s);
    await AsyncStorage.setItem(THEME_KEY, s);
  };

  const toggleTheme = () => setTheme(scheme === 'light' ? 'dark' : 'light');

  const colors = scheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ scheme, colors, isDark: scheme === 'dark', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
