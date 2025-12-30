'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '../../../lib/api';

interface LeaderboardConfig {
  leaderboard_enabled: boolean;
  leaderboard_show_names: boolean;
  leaderboard_show_prizes: boolean;
  leaderboard_style: string;
  leaderboard_size: number;
}

interface LeaderboardSettingsProps {
  promotionId: string | number;
  onSave?: () => void;
}

export default function LeaderboardSettings({ promotionId, onSave }: LeaderboardSettingsProps) {
  const [config, setConfig] = useState<LeaderboardConfig>({
    leaderboard_enabled: false,
    leaderboard_show_names: true,
    leaderboard_show_prizes: false,
    leaderboard_style: 'minimal',
    leaderboard_size: 10
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, [promotionId]);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(getApiUrl(`api/promotions/${promotionId}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setConfig({
          leaderboard_enabled: data.leaderboard_enabled || false,
          leaderboard_show_names: data.leaderboard_show_names ?? true,
          leaderboard_show_prizes: data.leaderboard_show_prizes || false,
          leaderboard_style: data.leaderboard_style || 'minimal',
          leaderboard_size: data.leaderboard_size || 10
        });
      }
    } catch (err) {
      console.error('Error fetching leaderboard config:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(getApiUrl(`api/promotions/${promotionId}/leaderboard`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Impostazioni salvate!' });
        onSave?.();
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
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#b42a28]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Classifica Live</h3>
          <p className="text-sm text-gray-500">Configura la visualizzazione della classifica</p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Toggle principale */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Abilita Classifica</p>
            <p className="text-sm text-gray-500">Mostra la classifica nella pagina dei risultati</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, leaderboard_enabled: !config.leaderboard_enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config.leaderboard_enabled ? 'bg-[#b42a28]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.leaderboard_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Opzioni (visibili solo se abilitato) */}
      {config.leaderboard_enabled && (
        <div className="space-y-4 animate-fade-in">
          {/* Mostra nomi */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Mostra Nomi</p>
              <p className="text-sm text-gray-500">Visualizza nome e cognome dei giocatori</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, leaderboard_show_names: !config.leaderboard_show_names })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.leaderboard_show_names ? 'bg-[#b42a28]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.leaderboard_show_names ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Mostra premi */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Mostra Premi Vinti</p>
              <p className="text-sm text-gray-500">Indica quali premi hanno vinto i giocatori</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, leaderboard_show_prizes: !config.leaderboard_show_prizes })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.leaderboard_show_prizes ? 'bg-[#b42a28]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.leaderboard_show_prizes ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Dimensione classifica */}
          <div className="py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-gray-900">Numero Posizioni</p>
                <p className="text-sm text-gray-500">Quanti giocatori mostrare in classifica</p>
              </div>
              <span className="text-lg font-bold text-[#b42a28]">{config.leaderboard_size}</span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={config.leaderboard_size}
              onChange={e => setConfig({ ...config, leaderboard_size: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#b42a28]"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5</span>
              <span>50</span>
            </div>
          </div>

          {/* Stile classifica */}
          <div className="py-3">
            <p className="font-medium text-gray-900 mb-3">Stile Visualizzazione</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'minimal', label: 'Minimale', desc: 'Solo posizione e nome' },
                { id: 'full', label: 'Completo', desc: 'Con dettagli giocate' },
                { id: 'cards', label: 'Cards', desc: 'Stile card moderno' }
              ].map(style => (
                <button
                  key={style.id}
                  onClick={() => setConfig({ ...config, leaderboard_style: style.id })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    config.leaderboard_style === style.id
                      ? 'border-[#b42a28] bg-[#b42a28]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`font-medium text-sm ${config.leaderboard_style === style.id ? 'text-[#b42a28]' : 'text-gray-900'}`}>
                    {style.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{style.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-6 py-2.5 bg-[#b42a28] text-white font-medium rounded-xl hover:bg-[#9a2422] transition-colors disabled:opacity-50"
        >
          {saving ? 'Salvataggio...' : 'Salva Impostazioni'}
        </button>
      </div>
    </div>
  );
}
