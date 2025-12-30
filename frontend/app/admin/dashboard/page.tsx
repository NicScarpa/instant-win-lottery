'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import TokenGenerator from './components/TokenGenerator';
import TokenListTable from './components/TokenListTable';
import UsedTokensList from './components/UsedTokensList';
import UsedTokensTable from './components/UsedTokensTable';
import StatsCard from './components/StatsCard';
import PrizeManager from './components/PrizeManager';
import PrizeList from './components/PrizeList';
import PromotionSelector from './components/PromotionSelector';
import PlayLogViewer from './components/PlayLogViewer';
import PlayersArchive from './components/PlayersArchive';
import PrizeOverview from './components/PrizeOverview';
import Sidebar from './components/Sidebar';
import AdminLeaderboard from './components/AdminLeaderboard';
import RevenueStats from './components/RevenueStats';
import TopNav from './components/TopNav';
import StatsHeader from './components/StatsHeader';
import BrandingManager from './components/BrandingManager';
import EngineConfig from './components/EngineConfig';
import LeaderboardSettings from './components/LeaderboardSettings';
import StaffManager from './components/StaffManager';
import OnboardingWizard from './components/OnboardingWizard';
import AuditLogViewer from './components/AuditLogViewer';
import { getApiUrl } from '../../lib/api';

export interface Promotion {
    id: string;
    name: string;
    status: string;
    start_datetime: string;
    end_datetime: string;
    planned_token_count: number;
}

export default function AdminDashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [selectedPromotionId, setSelectedPromotionId] = useState<string>('');
    const [dataRefreshKey, setDataRefreshKey] = useState(0);
    const [currentView, setCurrentView] = useState('dashboard');

    // Stati per il form di creazione "Bootstrap"
    const [newName, setNewName] = useState('');
    const [newCount, setNewCount] = useState(100);
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [createError, setCreateError] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Stati per controllo modifica/elimina da sidebar mobile
    const [triggerEdit, setTriggerEdit] = useState(false);
    const [triggerDelete, setTriggerDelete] = useState(false);

    // Stato per impersonation (super admin che accede come tenant admin)
    const [impersonationInfo, setImpersonationInfo] = useState<{ tenantName: string; tenantSlug: string } | null>(null);

    // Stato per onboarding wizard
    const [showOnboarding, setShowOnboarding] = useState(false);

    const forceDataRefresh = () => {
        setDataRefreshKey(prevKey => prevKey + 1);
    }

    // Carica info impersonation da localStorage
    useEffect(() => {
        const storedInfo = localStorage.getItem('impersonation_info');
        if (storedInfo) {
            try {
                setImpersonationInfo(JSON.parse(storedInfo));
            } catch (e) {
                localStorage.removeItem('impersonation_info');
            }
        }
    }, []);

    // Esci dall'impersonation e torna alla super admin dashboard
    const exitImpersonation = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('impersonation_info');
        setImpersonationInfo(null);
        router.push('/superadmin/dashboard');
    };

    const handleLogout = async () => {
        setLoading(true);
        localStorage.removeItem('admin_token');
        await fetch(getApiUrl('api/auth/logout'), {
            method: 'POST',
            credentials: 'include'
        });
        router.push('/admin/login');
    };

    const fetchPromotions = useCallback(async () => {
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                router.push('/admin/login');
                return;
            }

            const res = await fetch(getApiUrl('api/promotions/list'), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!res.ok) throw new Error("Errore fetch promozioni");

            const data: Promotion[] = await res.json();
            setPromotions(data);

            if (data.length > 0 && !selectedPromotionId) {
                setSelectedPromotionId(String(data[0].id));
            } else if (data.length > 0 && selectedPromotionId && !data.find(p => String(p.id) === String(selectedPromotionId))) {
                setSelectedPromotionId(String(data[0].id));
            }
        } catch (error) {
            console.error(error);
            setPromotions([]);
        }
    }, [selectedPromotionId, router]);

    const checkSession = async () => {
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                router.push('/admin/login');
                return;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(getApiUrl('api/auth/me'), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (res.ok) {
                await fetchPromotions();
                // Controlla se mostrare onboarding per nuovi tenant
                const onboardingCompleted = localStorage.getItem('onboarding_completed');
                const onboardingSkipped = localStorage.getItem('onboarding_skipped');
                if (!onboardingCompleted && !onboardingSkipped && !impersonationInfo) {
                    setShowOnboarding(true);
                }
                setLoading(false);
            } else {
                localStorage.removeItem('admin_token');
                router.push('/admin/login');
            }
        } catch (error) {
            console.error('Session check error:', error);
            localStorage.removeItem('admin_token');
            router.push('/admin/login');
        }
    };

    const handleCreateFirstPromotion = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');
        setIsCreating(true);

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                router.push('/admin/login');
                return;
            }

            const res = await fetch(getApiUrl('api/promotions/create'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: newName,
                    plannedTokenCount: newCount,
                    startDatetime: newStart,
                    endDatetime: newEnd,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                await fetchPromotions();
                setNewName('');
                setNewStart('');
                setNewEnd('');
            } else {
                setCreateError(data.error || 'Errore creazione promozione');
            }
        } catch (err) {
            setCreateError('Errore di connessione');
        } finally {
            setIsCreating(false);
        }
    };

    useEffect(() => {
        checkSession();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f3efe6]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#b42a28] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-600 font-medium">Caricamento...</p>
                </div>
            </div>
        );
    }

    if (promotions.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#f3efe6] p-4">
                <div className="card-glass p-8 rounded-[2rem] shadow-xl w-full max-w-lg">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Benvenuto</h1>
                    <p className="text-gray-600 mb-6 text-center">Il database è vuoto. Configura la tua prima promozione per accedere alla dashboard.</p>

                    {createError && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm">{createError}</div>
                    )}

                    <form onSubmit={handleCreateFirstPromotion} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nome Promozione</label>
                            <input
                                type="text"
                                className="mt-1 block w-full border border-gray-300 rounded-xl p-3 text-black focus:ring-2 focus:ring-[#b42a28] focus:border-transparent transition"
                                placeholder="Es. Campari Summer Party"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Token Totali</label>
                            <input
                                type="number"
                                className="mt-1 block w-full border border-gray-300 rounded-xl p-3 text-black focus:ring-2 focus:ring-[#b42a28] focus:border-transparent transition"
                                value={newCount}
                                onChange={e => setNewCount(parseInt(e.target.value))}
                                min="1"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Inizio (ISO Date)</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full border border-gray-300 rounded-xl p-3 text-black text-xs focus:ring-2 focus:ring-[#b42a28] focus:border-transparent transition"
                                    placeholder="2024-01-01T00:00:00Z"
                                    value={newStart}
                                    onChange={e => setNewStart(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Fine (ISO Date)</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full border border-gray-300 rounded-xl p-3 text-black text-xs focus:ring-2 focus:ring-[#b42a28] focus:border-transparent transition"
                                    placeholder="2024-12-31T23:59:59Z"
                                    value={newEnd}
                                    onChange={e => setNewEnd(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="w-full bg-[#b42a28] text-white p-4 rounded-full hover:brightness-110 transition font-semibold shadow-lg shadow-[#b42a28]/20"
                        >
                            {isCreating ? 'Creazione in corso...' : 'Crea e Inizia'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700 underline">Logout</button>
                    </div>
                </div>
            </div>
        );
    }

    const currentPromotion = promotions.find(p => String(p.id) === String(selectedPromotionId)) || promotions[0];

    if (!currentPromotion) return <div>Errore stato dashboard. Ricarica la pagina.</div>;

    return (
        <div className="min-h-screen bg-[#f3efe6] font-sans relative overflow-hidden">
            {/* Impersonation Banner */}
            {impersonationInfo && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-purple-700 text-white px-4 py-2 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                        </svg>
                        <span>
                            Stai visualizzando come <strong>{impersonationInfo.tenantName}</strong>
                        </span>
                    </div>
                    <button
                        onClick={exitImpersonation}
                        className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium transition-colors"
                    >
                        Esci
                    </button>
                </div>
            )}

            {/* Background radial gradients */}
            <div className="fixed top-[-10%] right-[-10%] w-[1000px] h-[1000px] bg-[#b42a28]/5 rounded-full blur-[150px] animate-pulse pointer-events-none"></div>
            <div className="fixed bottom-[-5%] left-[-5%] w-[800px] h-[800px] bg-white rounded-full blur-[150px] pointer-events-none"></div>

            {/* Mobile Sidebar Component (only renders on mobile) */}
            <Sidebar
                currentView={currentView}
                onChangeView={setCurrentView}
                onLogout={handleLogout}
                onRefreshData={forceDataRefresh}
                onEditPromotion={() => setTriggerEdit(true)}
                onDeletePromotion={() => setTriggerDelete(true)}
                canDelete={promotions.length > 1}
            />

            {/* Main Content */}
            <div className={`relative z-10 max-w-[1680px] mx-auto pb-16 ${impersonationInfo ? 'pt-10' : ''}`}>
                {/* Desktop Top Navigation */}
                <TopNav
                    currentView={currentView}
                    onChangeView={setCurrentView}
                    onLogout={handleLogout}
                />

                {/* Mobile Sub-header with promotion selector */}
                <div className="md:hidden bg-white/70 backdrop-blur-md sticky top-14 z-20 px-4 py-3 border-b border-white/30">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-800 capitalize">{currentView}</h2>
                        <select
                            value={selectedPromotionId}
                            onChange={(e) => setSelectedPromotionId(e.target.value)}
                            className="text-sm border border-gray-200 rounded-full px-3 py-1.5 bg-white text-gray-800 max-w-[150px]"
                        >
                            {promotions.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Promotion Selector - Visibile sempre quando triggerEdit è attivo su mobile */}
                <div className={`${triggerEdit ? 'block' : 'hidden md:block'} px-4 md:px-10 mb-4`}>
                    <div className="md:flex md:justify-end">
                        <PromotionSelector
                            promotions={promotions}
                            selectedPromotionId={currentPromotion.id}
                            onSelectPromotion={setSelectedPromotionId}
                            onUpdatePromotions={fetchPromotions}
                            onForceDataRefresh={forceDataRefresh}
                            currentPromotion={currentPromotion}
                            triggerEdit={triggerEdit}
                            triggerDelete={triggerDelete}
                            onTriggerEditHandled={() => setTriggerEdit(false)}
                            onTriggerDeleteHandled={() => setTriggerDelete(false)}
                        />
                    </div>
                </div>

                {/* Stats Header - Only on Dashboard view */}
                {currentView === 'dashboard' && (
                    <StatsHeader
                        promotionId={currentPromotion.id}
                        promotionName={currentPromotion.name}
                        refreshKey={dataRefreshKey}
                    />
                )}

                {/* Content Area */}
                <div className="px-4 md:px-10 mt-8 md:mt-12 pt-14 md:pt-0">
                    <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">

                        {/* VIEW: DASHBOARD */}
                        {currentView === 'dashboard' && (
                            <>
                                {/* Onboarding Wizard for new tenants */}
                                {showOnboarding && (
                                    <OnboardingWizard
                                        onComplete={() => setShowOnboarding(false)}
                                        onNavigate={(view) => {
                                            setShowOnboarding(false);
                                            setCurrentView(view);
                                        }}
                                    />
                                )}

                                {/* Revenue Stats - Hide during onboarding */}
                                {!showOnboarding && (
                                <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                    <RevenueStats
                                        promotionId={currentPromotion.id}
                                        refreshKey={dataRefreshKey}
                                    />
                                </div>
                                )}

                                {/* Two Column Grid for Desktop - Hide during onboarding */}
                                {!showOnboarding && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                    {/* Prize Overview */}
                                    <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                        <PrizeOverview
                                            promotionId={currentPromotion.id}
                                            refreshKey={dataRefreshKey}
                                        />
                                    </div>

                                    {/* Stats Card */}
                                    <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                        <StatsCard
                                            promotionId={currentPromotion.id}
                                            key={`stats-${currentPromotion.id}-${dataRefreshKey}`}
                                        />
                                    </div>
                                </div>
                                )}

                                {/* Live Leaderboard - Hide during onboarding */}
                                {!showOnboarding && (
                                <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[#b42a28]/10 rounded-full flex items-center justify-center">
                                                <span className="text-xl">🏆</span>
                                            </div>
                                            <h3 className="font-bold text-xl text-gray-800">Classifica Live</h3>
                                        </div>
                                        <a
                                            href={`/classifica/${currentPromotion.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-[#b42a28] font-medium hover:underline flex items-center gap-1 px-4 py-2 bg-[#b42a28]/10 rounded-full transition hover:bg-[#b42a28]/20"
                                        >
                                            Pagina Pubblica
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </div>
                                    <AdminLeaderboard
                                        promotionId={currentPromotion.id}
                                        refreshKey={dataRefreshKey}
                                    />
                                </div>
                                )}

                                {/* Recent Activity - Hide during onboarding */}
                                {!showOnboarding && (
                                <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-xl text-gray-800">Ultimi Token Utilizzati</h3>
                                        <button
                                            onClick={() => setCurrentView('token')}
                                            className="text-sm text-[#b42a28] font-medium px-4 py-2 bg-[#b42a28]/10 rounded-full transition hover:bg-[#b42a28]/20"
                                        >
                                            Gestione Token
                                        </button>
                                    </div>
                                    <UsedTokensList
                                        promotionId={currentPromotion.id}
                                        key={`used-tokens-${currentPromotion.id}-${dataRefreshKey}`}
                                        limit={5}
                                    />
                                </div>
                                )}
                            </>
                        )}

                        {/* VIEW: TOKEN */}
                        {currentView === 'token' && (
                            <div className="space-y-6 md:space-y-8">
                                {/* Gestione Token */}
                                <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 bg-[#b42a28]/10 rounded-2xl">
                                            <svg className="w-6 h-6 text-[#b42a28]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-xl">Gestione Token</h3>
                                            <p className="text-sm text-gray-500">Genera nuovi token e scarica PDF per la stampa</p>
                                        </div>
                                    </div>
                                    <TokenGenerator
                                        promotionId={currentPromotion.id}
                                        promotionName={currentPromotion.name}
                                        onOperationSuccess={forceDataRefresh}
                                    />
                                </div>

                                {/* Liste Token */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                    <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                        <TokenListTable
                                            promotionId={currentPromotion.id}
                                            key={`table-available-${currentPromotion.id}-${dataRefreshKey}`}
                                        />
                                    </div>
                                    <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                        <UsedTokensTable
                                            promotionId={currentPromotion.id}
                                            key={`table-used-${currentPromotion.id}-${dataRefreshKey}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* VIEW: PREMI */}
                        {currentView === 'premi' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                    <PrizeManager
                                        promotionId={currentPromotion.id}
                                        promotionName={currentPromotion.name}
                                        onPrizeChange={forceDataRefresh}
                                    />
                                </div>
                                <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                    <PrizeList
                                        promotionId={currentPromotion.id}
                                        onPrizeChange={forceDataRefresh}
                                        refreshKey={dataRefreshKey}
                                    />
                                </div>
                            </div>
                        )}

                        {/* VIEW: LOG */}
                        {currentView === 'log' && (
                            <div className="space-y-6 md:space-y-8">
                                <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                    <PlayersArchive
                                        promotionId={currentPromotion.id}
                                        key={`players-${currentPromotion.id}-${dataRefreshKey}`}
                                    />
                                </div>
                                <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                    <PlayLogViewer
                                        promotionId={currentPromotion.id}
                                        key={`logs-${currentPromotion.id}-${dataRefreshKey}`}
                                    />
                                </div>
                            </div>
                        )}

                        {/* VIEW: STAFF */}
                        {currentView === 'staff' && (
                            <StaffManager refreshKey={dataRefreshKey} />
                        )}

                        {/* VIEW: AUDIT LOG */}
                        {currentView === 'audit' && (
                            <AuditLogViewer refreshKey={dataRefreshKey} />
                        )}

                        {/* VIEW: BRANDING */}
                        {currentView === 'branding' && (
                            <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                <BrandingManager />
                            </div>
                        )}

                        {/* VIEW: ENGINE CONFIG */}
                        {currentView === 'engine' && (
                            <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                <EngineConfig promotionId={currentPromotion.id} />
                            </div>
                        )}

                        {/* VIEW: LEADERBOARD SETTINGS */}
                        {currentView === 'leaderboard' && (
                            <div className="card-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 glow-hover">
                                <LeaderboardSettings promotionId={currentPromotion.id} />
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
