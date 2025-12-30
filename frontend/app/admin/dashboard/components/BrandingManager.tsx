'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiUrl } from '../../../lib/api';

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
  ogImageUrl: string | null;
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
  ogImageUrl: null,
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

type AssetType = 'logoMainUrl' | 'logoIconUrl' | 'faviconUrl' | 'backgroundUrl' | 'ogImageUrl';

interface FileUploadZoneProps {
  label: string;
  description: string;
  type: AssetType;
  currentUrl: string | null;
  onUpload: (type: AssetType, url: string) => void;
  onDelete: (type: AssetType) => void;
  uploading: AssetType | null;
}

function FileUploadZone({ label, description, type, currentUrl, onUpload, onDelete, uploading }: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Solo immagini (PNG, JPG, GIF, SVG)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File troppo grande (max 5MB)');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(getApiUrl('api/admin/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        onUpload(type, data.url);
      } else {
        const data = await res.json();
        setError(data.error || 'Errore upload');
      }
    } catch (err) {
      setError('Errore di connessione');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [type]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDelete = async () => {
    if (!currentUrl) return;

    // Extract filename from URL
    const filename = currentUrl.split('/').pop();
    if (!filename) return;

    try {
      const token = localStorage.getItem('admin_token');
      await fetch(getApiUrl(`api/admin/upload/${filename}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      onDelete(type);
    } catch (err) {
      setError('Errore eliminazione');
    }
  };

  const isUploading = uploading === type;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <p className="text-xs text-gray-500">{description}</p>

      {currentUrl ? (
        <div className="relative group">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
            <img
              src={currentUrl.startsWith('/uploads') ? getApiUrl(currentUrl.substring(1)) : currentUrl}
              alt={label}
              className="max-h-24 mx-auto object-contain"
            />
          </div>
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100"
            >
              Sostituisci
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
            >
              Elimina
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all
            ${isDragging
              ? 'border-[#b42a28] bg-red-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
            ${isUploading ? 'opacity-50 cursor-wait' : ''}
          `}
        >
          {isUploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#b42a28] mb-2"></div>
              <span className="text-sm text-gray-600">Caricamento...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-600">
                {isDragging ? 'Rilascia qui' : 'Trascina o clicca per caricare'}
              </span>
              <span className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, SVG (max 5MB)</span>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

export default function BrandingManager() {
  const [activeTab, setActiveTab] = useState<'colors' | 'content' | 'assets'>('colors');
  const [branding, setBranding] = useState<TenantBranding>(defaultBranding);
  const [content, setContent] = useState<TenantContent>(defaultContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<AssetType | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAssetUpload = (type: AssetType, url: string) => {
    setBranding(prev => ({ ...prev, [type]: url }));
    setMessage({ type: 'success', text: 'Immagine caricata con successo!' });
    setUploading(null);
  };

  const handleAssetDelete = async (type: AssetType) => {
    // Update branding in DB to clear the URL
    const token = localStorage.getItem('admin_token');
    try {
      await fetch(getApiUrl('api/admin/branding'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...branding, [type]: null })
      });
      setBranding(prev => ({ ...prev, [type]: null }));
      setMessage({ type: 'success', text: 'Immagine eliminata!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore eliminazione' });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const [brandingRes, contentRes] = await Promise.all([
        fetch(getApiUrl('api/tenant/branding'), {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(getApiUrl('api/tenant/content/it'), {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (brandingRes.ok) {
        const data = await brandingRes.json();
        setBranding({ ...defaultBranding, ...data });
      }
      if (contentRes.ok) {
        const data = await contentRes.json();
        setContent({ ...defaultContent, ...data });
      }
    } catch (err) {
      console.error('Error fetching branding:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveBranding = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(getApiUrl('api/admin/branding'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(branding)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Branding salvato con successo!' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Errore nel salvataggio' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore di connessione' });
    } finally {
      setSaving(false);
    }
  };

  const saveContent = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(getApiUrl('api/admin/content/it'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(content)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Contenuti salvati con successo!' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Errore nel salvataggio' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Errore di connessione' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#b42a28]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Personalizzazione Brand</h2>
          <p className="text-gray-500 mt-1">Personalizza colori, loghi e contenuti della tua promozione</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('colors')}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'colors' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Colori
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'content' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Contenuti
        </button>
        <button
          onClick={() => setActiveTab('assets')}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${activeTab === 'assets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Assets
        </button>
      </div>

      {/* Colors Tab */}
      {activeTab === 'colors' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-6">Palette Colori</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Primary Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Colore Primario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.colorPrimary}
                  onChange={e => setBranding({ ...branding, colorPrimary: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={branding.colorPrimary}
                  onChange={e => setBranding({ ...branding, colorPrimary: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm"
                />
              </div>
              <p className="text-xs text-gray-500">Bottoni, titoli, elementi attivi</p>
            </div>

            {/* Secondary Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Colore Secondario</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.colorSecondary}
                  onChange={e => setBranding({ ...branding, colorSecondary: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={branding.colorSecondary}
                  onChange={e => setBranding({ ...branding, colorSecondary: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm"
                />
              </div>
              <p className="text-xs text-gray-500">Sfondo, card</p>
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Colore Accento</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.colorAccent}
                  onChange={e => setBranding({ ...branding, colorAccent: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={branding.colorAccent}
                  onChange={e => setBranding({ ...branding, colorAccent: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm"
                />
              </div>
              <p className="text-xs text-gray-500">Elementi di contrasto</p>
            </div>

            {/* Success Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Colore Successo</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.colorSuccess}
                  onChange={e => setBranding({ ...branding, colorSuccess: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={branding.colorSuccess}
                  onChange={e => setBranding({ ...branding, colorSuccess: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm"
                />
              </div>
              <p className="text-xs text-gray-500">Messaggi positivi, vincite</p>
            </div>

            {/* Error Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Colore Errore</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.colorError}
                  onChange={e => setBranding({ ...branding, colorError: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={branding.colorError}
                  onChange={e => setBranding({ ...branding, colorError: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm"
                />
              </div>
              <p className="text-xs text-gray-500">Errori, avvisi</p>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Anteprima</h4>
            <div
              className="p-6 rounded-xl"
              style={{ backgroundColor: branding.colorSecondary }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="px-6 py-3 rounded-lg text-white font-bold"
                  style={{ backgroundColor: branding.colorPrimary }}
                >
                  Bottone Primario
                </div>
                <div
                  className="px-6 py-3 rounded-lg text-white font-bold"
                  style={{ backgroundColor: branding.colorAccent }}
                >
                  Bottone Accento
                </div>
              </div>
              <div className="flex gap-4">
                <span className="px-3 py-1 rounded-full text-sm text-white" style={{ backgroundColor: branding.colorSuccess }}>Successo</span>
                <span className="px-3 py-1 rounded-full text-sm text-white" style={{ backgroundColor: branding.colorError }}>Errore</span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveBranding}
              disabled={saving}
              className="px-6 py-3 bg-[#b42a28] text-white font-semibold rounded-xl hover:bg-[#9a2422] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvataggio...' : 'Salva Colori'}
            </button>
          </div>
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-6">Testi e Messaggi</h3>

          <div className="space-y-6">
            {/* Landing Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">Pagina di Gioco</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titolo Landing</label>
                  <input
                    type="text"
                    value={content.landingTitle}
                    onChange={e => setContent({ ...content, landingTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sottotitolo (opzionale)</label>
                  <input
                    type="text"
                    value={content.landingSubtitle || ''}
                    onChange={e => setContent({ ...content, landingSubtitle: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Testo Pulsante CTA</label>
                  <input
                    type="text"
                    value={content.landingCtaText}
                    onChange={e => setContent({ ...content, landingCtaText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Form Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">Form Registrazione</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titolo Form</label>
                  <input
                    type="text"
                    value={content.formTitle}
                    onChange={e => setContent({ ...content, formTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Testo Pulsante Submit</label>
                  <input
                    type="text"
                    value={content.formSubmitText}
                    onChange={e => setContent({ ...content, formSubmitText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Testo Consenso Privacy</label>
                  <input
                    type="text"
                    value={content.consentPrivacy}
                    onChange={e => setContent({ ...content, consentPrivacy: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Testo Consenso Marketing</label>
                  <input
                    type="text"
                    value={content.consentMarketing}
                    onChange={e => setContent({ ...content, consentMarketing: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Win/Lose Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b">Messaggi Risultato</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titolo Vincita</label>
                  <input
                    type="text"
                    value={content.winTitle}
                    onChange={e => setContent({ ...content, winTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio Vincita</label>
                  <input
                    type="text"
                    value={content.winMessage}
                    onChange={e => setContent({ ...content, winMessage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    placeholder="Usa {prize_name} per il nome del premio"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Istruzioni Ritiro (opzionale)</label>
                  <textarea
                    value={content.winInstructions || ''}
                    onChange={e => setContent({ ...content, winInstructions: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    rows={2}
                    placeholder="Es: Mostra il codice ad un cameriere per ritirare il premio"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titolo Non Vincita</label>
                  <input
                    type="text"
                    value={content.loseTitle}
                    onChange={e => setContent({ ...content, loseTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio Non Vincita</label>
                  <input
                    type="text"
                    value={content.loseMessage}
                    onChange={e => setContent({ ...content, loseMessage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveContent}
              disabled={saving}
              className="px-6 py-3 bg-[#b42a28] text-white font-semibold rounded-xl hover:bg-[#9a2422] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvataggio...' : 'Salva Contenuti'}
            </button>
          </div>
        </div>
      )}

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold mb-6">Logo e Assets</h3>

          <div className="space-y-6">
            {/* Upload Zones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FileUploadZone
                label="Logo Principale"
                description="Logo mostrato nella pagina di gioco (consigliato: 400x100px)"
                type="logoMainUrl"
                currentUrl={branding.logoMainUrl}
                onUpload={handleAssetUpload}
                onDelete={handleAssetDelete}
                uploading={uploading}
              />

              <FileUploadZone
                label="Logo Icona"
                description="Versione quadrata del logo (consigliato: 200x200px)"
                type="logoIconUrl"
                currentUrl={branding.logoIconUrl}
                onUpload={handleAssetUpload}
                onDelete={handleAssetDelete}
                uploading={uploading}
              />

              <FileUploadZone
                label="Favicon"
                description="Icona visualizzata nel browser (consigliato: 32x32px)"
                type="faviconUrl"
                currentUrl={branding.faviconUrl}
                onUpload={handleAssetUpload}
                onDelete={handleAssetDelete}
                uploading={uploading}
              />

              <FileUploadZone
                label="Sfondo Pattern"
                description="Immagine di sfondo ripetuta"
                type="backgroundUrl"
                currentUrl={branding.backgroundUrl}
                onUpload={handleAssetUpload}
                onDelete={handleAssetDelete}
                uploading={uploading}
              />

              <FileUploadZone
                label="Open Graph Image"
                description="Immagine per condivisione social (consigliato: 1200x630px)"
                type="ogImageUrl"
                currentUrl={branding.ogImageUrl}
                onUpload={handleAssetUpload}
                onDelete={handleAssetDelete}
                uploading={uploading}
              />
            </div>

            {/* Font Settings */}
            <div className="pt-6 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Font Personalizzati</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Font Titoli</label>
                  <input
                    type="text"
                    value={branding.fontHeading}
                    onChange={e => setBranding({ ...branding, fontHeading: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    placeholder="Inter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Fonts Titoli</label>
                  <input
                    type="url"
                    value={branding.fontHeadingUrl || ''}
                    onChange={e => setBranding({ ...branding, fontHeadingUrl: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    placeholder="https://fonts.googleapis.com/css2?family=..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Font Testo</label>
                  <input
                    type="text"
                    value={branding.fontBody}
                    onChange={e => setBranding({ ...branding, fontBody: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    placeholder="Inter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Fonts Testo</label>
                  <input
                    type="url"
                    value={branding.fontBodyUrl || ''}
                    onChange={e => setBranding({ ...branding, fontBodyUrl: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    placeholder="https://fonts.googleapis.com/css2?family=..."
                  />
                </div>
              </div>
            </div>

            {/* Custom CSS */}
            <div className="pt-6 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">CSS Personalizzato (Avanzato)</h4>
              <textarea
                value={branding.customCss || ''}
                onChange={e => setBranding({ ...branding, customCss: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono text-sm"
                rows={6}
                placeholder="/* CSS personalizzato */"
              />
              <p className="text-xs text-gray-500 mt-1">CSS aggiuntivo iniettato nella pagina di gioco</p>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveBranding}
              disabled={saving}
              className="px-6 py-3 bg-[#b42a28] text-white font-semibold rounded-xl hover:bg-[#9a2422] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvataggio...' : 'Salva Assets'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
