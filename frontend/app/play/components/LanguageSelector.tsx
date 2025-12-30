'use client';

import { useState } from 'react';
import { useLanguage } from '../../providers/TenantProvider';

const LANGUAGE_LABELS: Record<string, { flag: string; name: string }> = {
  it: { flag: '🇮🇹', name: 'Italiano' },
  en: { flag: '🇬🇧', name: 'English' },
  es: { flag: '🇪🇸', name: 'Espanol' },
  de: { flag: '🇩🇪', name: 'Deutsch' },
  fr: { flag: '🇫🇷', name: 'Francais' }
};

export default function LanguageSelector() {
  const { currentLanguage, availableLanguages, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  // Non mostrare se c'e solo una lingua
  if (availableLanguages.length <= 1) {
    return null;
  }

  const handleLanguageChange = async (lang: string) => {
    if (lang === currentLanguage) {
      setIsOpen(false);
      return;
    }
    setIsChanging(true);
    await setLanguage(lang);
    setIsChanging(false);
    setIsOpen(false);
  };

  const currentLang = LANGUAGE_LABELS[currentLanguage] || LANGUAGE_LABELS['it'];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isChanging}
        className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-200 hover:bg-white transition-colors disabled:opacity-50"
        aria-label="Seleziona lingua"
      >
        <span className="text-lg">{currentLang.flag}</span>
        <span className="text-sm font-medium text-gray-700 hidden sm:inline">{currentLang.name}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Overlay per chiudere il menu cliccando fuori */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 py-2 bg-white rounded-xl shadow-lg border border-gray-100 z-50 min-w-[140px]">
            {availableLanguages.map(lang => {
              const langInfo = LANGUAGE_LABELS[lang];
              if (!langInfo) return null;
              return (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                    lang === currentLanguage ? 'bg-gray-50' : ''
                  }`}
                >
                  <span className="text-lg">{langInfo.flag}</span>
                  <span className={`text-sm ${lang === currentLanguage ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {langInfo.name}
                  </span>
                  {lang === currentLanguage && (
                    <svg className="w-4 h-4 text-green-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
