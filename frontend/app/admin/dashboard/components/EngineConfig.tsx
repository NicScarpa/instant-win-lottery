'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '../../../lib/api';

interface EngineConfigData {
  // Fatigue settings
  fatigueEnabled: boolean;
  fatiguePlayThreshold: number;
  fatiguePlayBasePenalty: number;
  fatiguePlayIncrement: number;
  fatiguePlayMax: number;
  fatigueWinPenalty: number;
  fatigueWinMax: number;
  fatigueMinProbability: number;
  // Pacing settings
  pacingEnabled: boolean;
  pacingTooFastThreshold: number;
  pacingTooFastMultiplier: number;
  pacingFastThreshold: number;
  pacingFastMultiplier: number;
  pacingSlowThreshold: number;
  pacingSlowMultiplier: number;
  pacingTooSlowThreshold: number;
  pacingTooSlowMultiplier: number;
  // Time Pressure
  timePressureEnabled: boolean;
  timeConservationStartMin: number;
  timeDistributionStartMin: number;
  timeFinalStartMin: number;
  timeConservationBoost: number;
  timeDistributionMax: number;
  timeFinalBoost: number;
  // Force Win
  forceWinEnabled: boolean;
  forceWinThresholdMin: number;
  // Desperation
  desperationModeEnabled: boolean;
  desperationStartMin: number;
  // Global
  maxProbability: number;
  minProbability: number;
  loggingEnabled: boolean;
}

const defaultConfig: EngineConfigData = {
  fatigueEnabled: true,
  fatiguePlayThreshold: 6,
  fatiguePlayBasePenalty: 0.10,
  fatiguePlayIncrement: 0.02,
  fatiguePlayMax: 0.50,
  fatigueWinPenalty: 0.20,
  fatigueWinMax: 0.60,
  fatigueMinProbability: 0.10,
  pacingEnabled: true,
  pacingTooFastThreshold: 1.30,
  pacingTooFastMultiplier: 0.60,
  pacingFastThreshold: 1.15,
  pacingFastMultiplier: 0.80,
  pacingSlowThreshold: 0.85,
  pacingSlowMultiplier: 1.20,
  pacingTooSlowThreshold: 0.70,
  pacingTooSlowMultiplier: 1.40,
  timePressureEnabled: true,
  timeConservationStartMin: 60,
  timeDistributionStartMin: 5,
  timeFinalStartMin: 1,
  timeConservationBoost: 1.30,
  timeDistributionMax: 5.00,
  timeFinalBoost: 10.00,
  forceWinEnabled: false,
  forceWinThresholdMin: 1,
  desperationModeEnabled: false,
  desperationStartMin: 5,
  maxProbability: 1.00,
  minProbability: 0.001,
  loggingEnabled: false
};

interface EngineConfigProps {
  promotionId: string | number;
}

export default function EngineConfig({ promotionId }: EngineConfigProps) {
  const [activeTab, setActiveTab] = useState<'fatigue' | 'pacing' | 'time' | 'advanced'>('fatigue');
  const [config, setConfig] = useState<EngineConfigData>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, [promotionId]);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(getApiUrl(`api/promotions/${promotionId}/engine-config`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setConfig({ ...defaultConfig, ...data });
      }
    } catch (err) {
      console.error('Error fetching engine config:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(getApiUrl(`api/promotions/${promotionId}/engine-config`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Configurazione salvata!' });
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

  const applyPreset = (preset: 'conservative' | 'balanced' | 'generous') => {
    const presets = {
      conservative: {
        ...defaultConfig,
        fatiguePlayBasePenalty: 0.15,
        fatigueWinPenalty: 0.30,
        pacingTooFastMultiplier: 0.50,
        timeFinalBoost: 5.00
      },
      balanced: defaultConfig,
      generous: {
        ...defaultConfig,
        fatigueEnabled: false,
        pacingTooFastMultiplier: 0.80,
        timeFinalBoost: 20.00,
        forceWinEnabled: true,
        forceWinThresholdMin: 2
      }
    };
    setConfig(presets[preset]);
  };

  // Toggle component
  const Toggle = ({ enabled, onChange, label, description }: { enabled: boolean; onChange: (v: boolean) => void; label: string; description?: string }) => (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-[#b42a28]' : 'bg-gray-300'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );

  // Slider component
  const Slider = ({ value, onChange, min, max, step, label, description, unit = '', format = (v: number) => v.toString() }: {
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    label: string;
    description?: string;
    unit?: string;
    format?: (v: number) => string;
  }) => (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
        <span className="text-lg font-bold text-[#b42a28]">{format(value)}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#b42a28]"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{format(min)}{unit}</span>
        <span>{format(max)}{unit}</span>
      </div>
    </div>
  );

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
          <h2 className="text-2xl font-bold text-gray-900">Configurazione Engine</h2>
          <p className="text-gray-500 mt-1">Regola i parametri del motore di probabilità</p>
        </div>
        <div className="flex gap-2">
          <select
            onChange={e => applyPreset(e.target.value as 'conservative' | 'balanced' | 'generous')}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium bg-white"
            defaultValue=""
          >
            <option value="" disabled>Preset...</option>
            <option value="conservative">Conservativo</option>
            <option value="balanced">Bilanciato</option>
            <option value="generous">Generoso</option>
          </select>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {[
          { id: 'fatigue', label: 'Anti-Fatigue' },
          { id: 'pacing', label: 'Pacing' },
          { id: 'time', label: 'Time Pressure' },
          { id: 'advanced', label: 'Avanzato' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Fatigue Tab */}
      {activeTab === 'fatigue' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="pb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold">Sistema Anti-Fatica</h3>
            <p className="text-sm text-gray-500">Riduce la probabilità per giocatori che giocano spesso</p>
          </div>

          <Toggle
            enabled={config.fatigueEnabled}
            onChange={v => setConfig({ ...config, fatigueEnabled: v })}
            label="Abilita Anti-Fatica"
            description="Attiva il sistema di penalità per giocatori frequenti"
          />

          {config.fatigueEnabled && (
            <div className="space-y-2 animate-fade-in">
              <Slider
                value={config.fatiguePlayThreshold}
                onChange={v => setConfig({ ...config, fatiguePlayThreshold: v })}
                min={2}
                max={20}
                step={1}
                label="Soglia Giocate"
                description="Numero di giocate prima dell'attivazione"
              />
              <Slider
                value={config.fatiguePlayBasePenalty}
                onChange={v => setConfig({ ...config, fatiguePlayBasePenalty: v })}
                min={0.05}
                max={0.30}
                step={0.01}
                label="Penalità Base"
                description="Riduzione probabilità iniziale"
                format={v => (v * 100).toFixed(0)}
                unit="%"
              />
              <Slider
                value={config.fatigueWinPenalty}
                onChange={v => setConfig({ ...config, fatigueWinPenalty: v })}
                min={0.10}
                max={0.50}
                step={0.05}
                label="Penalità Vincita"
                description="Penalità dopo ogni vincita"
                format={v => (v * 100).toFixed(0)}
                unit="%"
              />
              <Slider
                value={config.fatigueMinProbability}
                onChange={v => setConfig({ ...config, fatigueMinProbability: v })}
                min={0.01}
                max={0.30}
                step={0.01}
                label="Probabilità Minima"
                description="Floor della probabilità con fatigue"
                format={v => (v * 100).toFixed(0)}
                unit="%"
              />
            </div>
          )}
        </div>
      )}

      {/* Pacing Tab */}
      {activeTab === 'pacing' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="pb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold">Sistema Pacing</h3>
            <p className="text-sm text-gray-500">Adatta la probabilità in base al ritmo di distribuzione premi</p>
          </div>

          <Toggle
            enabled={config.pacingEnabled}
            onChange={v => setConfig({ ...config, pacingEnabled: v })}
            label="Abilita Pacing"
            description="Regola automaticamente in base ai premi distribuiti"
          />

          {config.pacingEnabled && (
            <div className="space-y-2 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-red-50 rounded-xl">
                  <p className="font-medium text-red-800 mb-2">Troppo Veloce</p>
                  <Slider
                    value={config.pacingTooFastThreshold}
                    onChange={v => setConfig({ ...config, pacingTooFastThreshold: v })}
                    min={1.10}
                    max={2.00}
                    step={0.05}
                    label="Soglia"
                    format={v => v.toFixed(2)}
                    unit="x"
                  />
                  <Slider
                    value={config.pacingTooFastMultiplier}
                    onChange={v => setConfig({ ...config, pacingTooFastMultiplier: v })}
                    min={0.30}
                    max={0.90}
                    step={0.05}
                    label="Moltiplicatore"
                    format={v => v.toFixed(2)}
                    unit="x"
                  />
                </div>
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="font-medium text-green-800 mb-2">Troppo Lento</p>
                  <Slider
                    value={config.pacingTooSlowThreshold}
                    onChange={v => setConfig({ ...config, pacingTooSlowThreshold: v })}
                    min={0.30}
                    max={0.90}
                    step={0.05}
                    label="Soglia"
                    format={v => v.toFixed(2)}
                    unit="x"
                  />
                  <Slider
                    value={config.pacingTooSlowMultiplier}
                    onChange={v => setConfig({ ...config, pacingTooSlowMultiplier: v })}
                    min={1.10}
                    max={2.00}
                    step={0.05}
                    label="Moltiplicatore"
                    format={v => v.toFixed(2)}
                    unit="x"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time Pressure Tab */}
      {activeTab === 'time' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="pb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold">Time Pressure</h3>
            <p className="text-sm text-gray-500">Aumenta la probabilità verso la fine della promozione</p>
          </div>

          <Toggle
            enabled={config.timePressureEnabled}
            onChange={v => setConfig({ ...config, timePressureEnabled: v })}
            label="Abilita Time Pressure"
            description="Boost progressivo verso la scadenza"
          />

          {config.timePressureEnabled && (
            <div className="space-y-2 animate-fade-in">
              <Slider
                value={config.timeConservationStartMin}
                onChange={v => setConfig({ ...config, timeConservationStartMin: v })}
                min={30}
                max={120}
                step={5}
                label="Inizio Conservazione"
                description="Minuti rimanenti per iniziare"
                unit=" min"
              />
              <Slider
                value={config.timeDistributionStartMin}
                onChange={v => setConfig({ ...config, timeDistributionStartMin: v })}
                min={2}
                max={15}
                step={1}
                label="Inizio Distribuzione Rapida"
                description="Minuti rimanenti per boost"
                unit=" min"
              />
              <Slider
                value={config.timeFinalBoost}
                onChange={v => setConfig({ ...config, timeFinalBoost: v })}
                min={2.0}
                max={20.0}
                step={0.5}
                label="Boost Finale"
                description="Moltiplicatore nell'ultimo minuto"
                format={v => v.toFixed(1)}
                unit="x"
              />
            </div>
          )}
        </div>
      )}

      {/* Advanced Tab */}
      {activeTab === 'advanced' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="pb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold">Impostazioni Avanzate</h3>
            <p className="text-sm text-gray-500">Funzionalità sperimentali e limiti globali</p>
          </div>

          {/* Force Win */}
          <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
            <Toggle
              enabled={config.forceWinEnabled}
              onChange={v => setConfig({ ...config, forceWinEnabled: v })}
              label="Force Win"
              description="Garantisce vincita se premi in eccesso"
            />
            {config.forceWinEnabled && (
              <Slider
                value={config.forceWinThresholdMin}
                onChange={v => setConfig({ ...config, forceWinThresholdMin: v })}
                min={1}
                max={10}
                step={1}
                label="Soglia Attivazione"
                description="Minuti rimanenti con premi in eccesso"
                unit=" min"
              />
            )}
          </div>

          {/* Desperation Mode */}
          <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
            <Toggle
              enabled={config.desperationModeEnabled}
              onChange={v => setConfig({ ...config, desperationModeEnabled: v })}
              label="Desperation Mode"
              description="Distribuisce tutti i premi rimanenti"
            />
            {config.desperationModeEnabled && (
              <Slider
                value={config.desperationStartMin}
                onChange={v => setConfig({ ...config, desperationStartMin: v })}
                min={1}
                max={15}
                step={1}
                label="Attivazione"
                description="Minuti dalla fine promozione"
                unit=" min"
              />
            )}
          </div>

          {/* Global Limits */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Limiti Globali</h4>
            <Slider
              value={config.maxProbability}
              onChange={v => setConfig({ ...config, maxProbability: v })}
              min={0.50}
              max={1.00}
              step={0.05}
              label="Probabilità Massima"
              format={v => (v * 100).toFixed(0)}
              unit="%"
            />
            <Slider
              value={config.minProbability}
              onChange={v => setConfig({ ...config, minProbability: v })}
              min={0.001}
              max={0.10}
              step={0.001}
              label="Probabilità Minima"
              format={v => (v * 100).toFixed(1)}
              unit="%"
            />
          </div>

          {/* Logging */}
          <Toggle
            enabled={config.loggingEnabled}
            onChange={v => setConfig({ ...config, loggingEnabled: v })}
            label="Debug Logging"
            description="Registra decisioni engine nel log"
          />
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-6 py-3 bg-[#b42a28] text-white font-semibold rounded-xl hover:bg-[#9a2422] transition-colors disabled:opacity-50"
        >
          {saving ? 'Salvataggio...' : 'Salva Configurazione'}
        </button>
      </div>
    </div>
  );
}
