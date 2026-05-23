// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { createContext, useContext, useEffect, useState } from 'react';
import classic from './classic';
import minimal from './minimal';
import terminal from './terminal';
import modern from './modern';

export const THEMES = {
  classic,
  minimal,
  terminal,
  modern,
};

export const THEME_LIST = [classic, minimal, terminal, modern];

const STORAGE_KEY = 'chaos_theme';
const DEFAULT_THEME = 'classic';

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && THEMES[stored]) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

const ThemeContext = createContext({
  theme: classic,
  themeId: classic.id,
  setThemeId: () => {},
});

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(readStoredTheme);
  const theme = THEMES[themeId] ?? classic;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch {
      // ignore quota / private-mode errors
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.theme = themeId;
    }
  }, [themeId]);

  const setThemeId = (next) => {
    if (THEMES[next]) setThemeIdState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId }}>
      <style>{theme.GLOBAL_CSS}</style>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
