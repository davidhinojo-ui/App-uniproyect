import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';
const KEY = 'uniproyect:theme';

export const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
  }, [theme]);

  return (
    <button type="button"
      className="uniproyect-theme-switch"
      onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Activar modo diurno' : 'Activar modo nocturno'}
      aria-label={theme === 'dark' ? 'Activar modo diurno' : 'Activar modo nocturno'}>
      {theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
      <span>{theme === 'dark' ? 'Modo diurno' : 'Modo nocturno'}</span>
    </button>
  );
};
