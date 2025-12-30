'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getApiUrl } from '../lib/api';

interface TenantBranding {
  colorPrimary: string;
  colorSecondary: string;
  colorAccent: string;
  colorTextDark: string;
  colorTextLight: string;
  colorTextMuted: string;
  colorSuccess: string;
  colorError: string;
  fontHeading: string;
  fontBody: string;
  fontHeadingUrl: string | null;
  fontBodyUrl: string | null;
  logoMainUrl: string | null;
  logoIconUrl: string | null;
  faviconUrl: string | null;
  backgroundUrl: string | null;
  customCss: string | null;
}

interface TenantContent {
  language: string;
  landingTitle: string;
  landingSubtitle: string | null;
  landingCtaText: string;
  tokenPlaceholder: string;
  errorInvalidToken: string;
  errorUsedToken: string;
  formTitle: string;
  labelFirstName: string;
  labelLastName: string;
  labelPhone: string;
  consentPrivacy: string;
  consentMarketing: string;
  formSubmitText: string;
  winTitle: string;
  winMessage: string;
  winInstructions: string | null;
  loseTitle: string;
  loseMessage: string;
  thankYouMessage: string | null;
  footerCopyright: string | null;
  footerContact: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
}

interface TenantContextType {
  branding: TenantBranding | null;
  content: TenantContent | null;
  loading: boolean;
  error: string | null;
  currentLanguage: string;
  availableLanguages: string[];
  setLanguage: (lang: string) => Promise<void>;
  refreshBranding: () => Promise<void>;
}

const defaultBranding: TenantBranding = {
  colorPrimary: '#b42a28',
  colorSecondary: '#f3efe6',
  colorAccent: '#2d2d2d',
  colorTextDark: '#1a1a1a',
  colorTextLight: '#ffffff',
  colorTextMuted: '#6b7280',
  colorSuccess: '#22c55e',
  colorError: '#ef4444',
  fontHeading: 'Inter',
  fontBody: 'Inter',
  fontHeadingUrl: null,
  fontBodyUrl: null,
  logoMainUrl: null,
  logoIconUrl: null,
  faviconUrl: null,
  backgroundUrl: null,
  customCss: null
};

const defaultContent: TenantContent = {
  language: 'it',
  landingTitle: 'Tenta la fortuna!',
  landingSubtitle: null,
  landingCtaText: 'Gioca Ora',
  tokenPlaceholder: 'Inserisci il tuo codice',
  errorInvalidToken: 'Codice non valido',
  errorUsedToken: 'Codice già utilizzato',
  formTitle: 'Completa la registrazione',
  labelFirstName: 'Nome',
  labelLastName: 'Cognome',
  labelPhone: 'Numero di telefono',
  consentPrivacy: 'Accetto i termini e condizioni',
  consentMarketing: 'Acconsento a ricevere comunicazioni marketing',
  formSubmitText: 'Partecipa',
  winTitle: 'Congratulazioni!',
  winMessage: 'Hai vinto: {prize_name}',
  winInstructions: null,
  loseTitle: 'Peccato!',
  loseMessage: 'Non hai vinto questa volta, ritenta!',
  thankYouMessage: null,
  footerCopyright: null,
  footerContact: null,
  termsUrl: null,
  privacyUrl: null
};

const SUPPORTED_LANGUAGES = ['it', 'en', 'es', 'de', 'fr'];

const TenantContext = createContext<TenantContextType>({
  branding: defaultBranding,
  content: defaultContent,
  loading: true,
  error: null,
  currentLanguage: 'it',
  availableLanguages: SUPPORTED_LANGUAGES,
  setLanguage: async () => {},
  refreshBranding: async () => {}
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [content, setContent] = useState<TenantContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState('it');

  const fetchContent = async (lang: string) => {
    try {
      const contentRes = await fetch(getApiUrl(`api/tenant/content/${lang}`), { credentials: 'include' });
      if (contentRes.ok) {
        const contentData = await contentRes.json();
        setContent({ ...defaultContent, ...contentData });
        setCurrentLanguage(lang);
        // Salva preferenza lingua in localStorage
        localStorage.setItem('preferred_language', lang);
      }
    } catch (err) {
      console.error('Error fetching content for language:', lang, err);
    }
  };

  const setLanguage = async (lang: string) => {
    if (SUPPORTED_LANGUAGES.includes(lang)) {
      await fetchContent(lang);
    }
  };

  const fetchBranding = async () => {
    try {
      // Recupera lingua preferita da localStorage o usa default
      const savedLang = typeof window !== 'undefined'
        ? localStorage.getItem('preferred_language') || 'it'
        : 'it';

      const [brandingRes, contentRes] = await Promise.all([
        fetch(getApiUrl('api/tenant/branding'), { credentials: 'include' }),
        fetch(getApiUrl(`api/tenant/content/${savedLang}`), { credentials: 'include' })
      ]);

      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();
        setBranding({ ...defaultBranding, ...brandingData });
      } else {
        setBranding(defaultBranding);
      }

      if (contentRes.ok) {
        const contentData = await contentRes.json();
        setContent({ ...defaultContent, ...contentData });
        setCurrentLanguage(savedLang);
      } else {
        // Fallback a italiano se lingua salvata non disponibile
        if (savedLang !== 'it') {
          await fetchContent('it');
        } else {
          setContent(defaultContent);
        }
      }
    } catch (err) {
      console.error('Error fetching tenant config:', err);
      setError('Failed to load tenant configuration');
      setBranding(defaultBranding);
      setContent(defaultContent);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  // Apply CSS variables when branding changes
  useEffect(() => {
    if (!branding) return;

    const root = document.documentElement;
    root.style.setProperty('--color-primary', branding.colorPrimary);
    root.style.setProperty('--color-secondary', branding.colorSecondary);
    root.style.setProperty('--color-accent', branding.colorAccent);
    root.style.setProperty('--color-text-dark', branding.colorTextDark);
    root.style.setProperty('--color-text-light', branding.colorTextLight);
    root.style.setProperty('--color-text-muted', branding.colorTextMuted);
    root.style.setProperty('--color-success', branding.colorSuccess);
    root.style.setProperty('--color-error', branding.colorError);
    root.style.setProperty('--font-heading', branding.fontHeading);
    root.style.setProperty('--font-body', branding.fontBody);

    // Load custom fonts if specified
    if (branding.fontHeadingUrl || branding.fontBodyUrl) {
      const fontUrls = [branding.fontHeadingUrl, branding.fontBodyUrl].filter(Boolean);
      fontUrls.forEach(url => {
        if (url && !document.querySelector(`link[href="${url}"]`)) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          document.head.appendChild(link);
        }
      });
    }

    // Apply custom CSS if provided
    if (branding.customCss) {
      let styleEl = document.getElementById('tenant-custom-css');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'tenant-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = branding.customCss;
    }

    // Update favicon if specified
    if (branding.faviconUrl) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon) {
        favicon.href = branding.faviconUrl;
      }
    }
  }, [branding]);

  return (
    <TenantContext.Provider value={{ branding, content, loading, error, currentLanguage, availableLanguages: SUPPORTED_LANGUAGES, setLanguage, refreshBranding: fetchBranding }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

export function useBranding() {
  const { branding } = useContext(TenantContext);
  return branding || defaultBranding;
}

export function useContent() {
  const { content } = useContext(TenantContext);
  return content || defaultContent;
}

export function useLanguage() {
  const { currentLanguage, availableLanguages, setLanguage } = useContext(TenantContext);
  return { currentLanguage, availableLanguages, setLanguage };
}
