import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('gopark_dark') === 'true');

  useEffect(() => {
    localStorage.setItem('gopark_dark', String(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return { darkMode, toggleDarkMode: () => setDarkMode(v => !v) };
}
