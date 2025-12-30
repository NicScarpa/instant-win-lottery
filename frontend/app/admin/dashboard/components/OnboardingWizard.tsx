'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '../../../lib/api';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  action?: () => void;
}

interface OnboardingWizardProps {
  onComplete: () => void;
  onNavigate: (view: string) => void;
}

export default function OnboardingWizard({ onComplete, onNavigate }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>([
    { id: 'welcome', title: 'Benvenuto', description: 'Inizia il setup della tua piattaforma', completed: false },
    { id: 'branding', title: 'Personalizza Brand', description: 'Configura colori e logo', completed: false },
    { id: 'promotion', title: 'Crea Promozione', description: 'Configura la tua prima promozione', completed: false },
    { id: 'prizes', title: 'Aggiungi Premi', description: 'Definisci i premi disponibili', completed: false },
    { id: 'tokens', title: 'Genera Token', description: 'Crea i codici per i partecipanti', completed: false }
  ]);
  const [loading, setLoading] = useState(true);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  useEffect(() => {
    checkProgress();
  }, []);

  const checkProgress = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    try {
      // Verifica stato attuale del tenant
      const [brandingRes, promotionsRes] = await Promise.all([
        fetch(getApiUrl('api/tenant/branding'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl('api/promotions/list'), { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const branding = brandingRes.ok ? await brandingRes.json() : null;
      const promotions = promotionsRes.ok ? await promotionsRes.json() : [];

      const newSteps = [...steps];

      // Welcome sempre completato al primo caricamento
      newSteps[0].completed = true;

      // Branding completato se ha logo
      newSteps[1].completed = !!branding?.logoMainUrl;

      // Promozione completata se esiste almeno una promozione
      newSteps[2].completed = promotions.length > 0;

      // Premi completati se la promozione ha premi
      if (promotions.length > 0 && promotions[0].prizes?.length > 0) {
        newSteps[3].completed = true;
      }

      // Token completati se esistono token
      if (promotions.length > 0 && promotions[0].tokens?.length > 0) {
        newSteps[4].completed = true;
      }

      setSteps(newSteps);

      // Trova il primo step non completato
      const firstIncomplete = newSteps.findIndex(s => !s.completed);
      setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : 0);

    } catch (err) {
      console.error('Failed to check onboarding progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStepAction = (step: OnboardingStep) => {
    switch (step.id) {
      case 'welcome':
        setCurrentStep(1);
        break;
      case 'branding':
        onNavigate('branding');
        break;
      case 'promotion':
        onNavigate('promotions');
        break;
      case 'prizes':
        onNavigate('promotions'); // I premi si aggiungono nella sezione promozioni
        break;
      case 'tokens':
        onNavigate('promotions'); // I token si generano nella sezione promozioni
        break;
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_skipped', 'true');
    onComplete();
  };

  const handleCompleteOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onComplete();
  };

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-white/50">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const currentStepData = steps[currentStep];

  return (
    <div className="bg-gradient-to-br from-[#b42a28]/5 to-amber-50 rounded-3xl p-6 md:p-8 shadow-xl border border-[#b42a28]/10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Setup Guidato</h2>
          <p className="text-gray-600 mt-1">Configura la tua piattaforma in pochi passi</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{completedCount}/{steps.length} completati</span>
          {!showSkipConfirm ? (
            <button
              onClick={() => setShowSkipConfirm(true)}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Salta
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
              >
                Conferma
              </button>
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="px-3 py-1 text-xs bg-white border border-gray-300 text-gray-600 rounded-full hover:bg-gray-50"
              >
                Annulla
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#b42a28] to-amber-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps Overview */}
      <div className="flex flex-wrap gap-2 mb-8">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => setCurrentStep(index)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              index === currentStep
                ? 'bg-[#b42a28] text-white shadow-lg'
                : step.completed
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {step.completed ? (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {step.title}
              </span>
            ) : (
              <>
                <span className="inline-block w-5 h-5 rounded-full bg-white/20 text-center text-xs leading-5 mr-1">
                  {index + 1}
                </span>
                {step.title}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Current Step Content */}
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100">
        {currentStep === 0 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-gradient-to-br from-[#b42a28] to-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">Benvenuto nella tua piattaforma!</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              Ti guideremo attraverso i passaggi essenziali per configurare la tua prima promozione instant win.
            </p>
            <button
              onClick={() => setCurrentStep(1)}
              className="px-8 py-3 bg-[#b42a28] text-white font-semibold rounded-xl hover:brightness-110 transition-all shadow-lg shadow-[#b42a28]/20"
            >
              Iniziamo!
            </button>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{currentStepData.title}</h3>
                <p className="text-gray-600">{currentStepData.description}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Personalizza i colori e carica il tuo logo per rendere la piattaforma unica per il tuo brand.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleStepAction(currentStepData)}
                className="px-6 py-3 bg-[#b42a28] text-white font-semibold rounded-xl hover:brightness-110 transition-all"
              >
                Vai a Personalizzazione
              </button>
              {currentStepData.completed && (
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
                >
                  Prossimo Step
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{currentStepData.title}</h3>
                <p className="text-gray-600">{currentStepData.description}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Crea la tua prima promozione definendo nome, date di inizio e fine, e le impostazioni di base.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleStepAction(currentStepData)}
                className="px-6 py-3 bg-[#b42a28] text-white font-semibold rounded-xl hover:brightness-110 transition-all"
              >
                Vai a Promozioni
              </button>
              {currentStepData.completed && (
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
                >
                  Prossimo Step
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{currentStepData.title}</h3>
                <p className="text-gray-600">{currentStepData.description}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Definisci i premi che i partecipanti possono vincere, con le relative quantità e probabilità.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleStepAction(currentStepData)}
                className="px-6 py-3 bg-[#b42a28] text-white font-semibold rounded-xl hover:brightness-110 transition-all"
              >
                Configura Premi
              </button>
              {currentStepData.completed && (
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
                >
                  Prossimo Step
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{currentStepData.title}</h3>
                <p className="text-gray-600">{currentStepData.description}</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Genera i codici univoci che i partecipanti useranno per giocare. Potrai scaricarli come PDF.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleStepAction(currentStepData)}
                className="px-6 py-3 bg-[#b42a28] text-white font-semibold rounded-xl hover:brightness-110 transition-all"
              >
                Genera Token
              </button>
              {currentStepData.completed && (
                <button
                  onClick={handleCompleteOnboarding}
                  className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all"
                >
                  Completa Setup
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* All Complete Message */}
      {steps.every(s => s.completed) && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-green-800 mb-2">Configurazione Completata!</h3>
          <p className="text-green-700 mb-4">Hai completato tutti i passaggi. La tua promozione è pronta per partire.</p>
          <button
            onClick={handleCompleteOnboarding}
            className="px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all"
          >
            Vai alla Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
