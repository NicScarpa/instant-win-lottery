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
import PrizeOverview from './components/PrizeOverview';
import Sidebar from './components/Sidebar';
import AdminLeaderboard from './components/AdminLeaderboard';
import { getApiUrl } from '../../lib/api'; // <--- IMPORTANTE

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
    const [currentView, setCurrentView] = useState('dashboard'); // SPOSTATO QUI: deve stare prima di ogni return condizionale

    // Stati per il form di creazione "Bootstrap"
    const [newName, setNewName] = useState('');
    const [newCount, setNewCount] = useState(100);
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [createError, setCreateError] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const forceDataRefresh = () => {
        setDataRefreshKey(prevKey => prevKey + 1);
    }

    const handleLogout = async () => {
        setLoading(true);
        // Remove token from localStorage
        localStorage.removeItem('admin_token');
        // Call logout endpoint
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
            // Check if token exists in localStorage
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
                setLoading(false);
            } else {
                // Token non valido, rimuovilo e redirect a login
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
        return <div className="min-h-screen flex items-center justify-center">Caricamento...</div>;
    }

    if (promotions.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Benvenuto</h1>
                    <p className="text-gray-600 mb-6 text-center">Il database è vuoto. Configura la tua prima promozione per accedere alla dashboard.</p>

                    {createError && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">{createError}</div>
                    )}

                    <form onSubmit={handleCreateFirstPromotion} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nome Promozione</label>
                            <input
                                type="text"
                                className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black"
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
                                className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black"
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
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black text-xs"
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
                                    className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black text-xs"
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
                            className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 transition font-semibold"
                        >
                            {isCreating ? 'Creazione in corso...' : '🚀 Crea e Inizia'}
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
        <div className="flex flex-col md:flex-row bg-[#F5F5F7] min-h-screen font-sans overflow-hidden">
            {/* Sidebar */}
            <Sidebar
                currentView={currentView}
                onChangeView={setCurrentView}
                onLogout={handleLogout}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-0 pt-16 md:pt-0">
                {/* Mobile Header - Shows promotion selector on mobile */}
                <div className="md:hidden bg-white/95 backdrop-blur-md sticky top-16 z-20 px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-800 capitalize">{currentView}</h2>
                        <select
                            value={selectedPromotionId}
                            onChange={(e) => setSelectedPromotionId(e.target.value)}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-800 max-w-[150px]"
                        >
                            {promotions.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Desktop Header / Top Bar */}
                <div className="hidden md:flex bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 justify-between items-center border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 capitalize">{currentView}</h2>
                        <p className="text-xs text-gray-400">Bentornato Staff</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <PromotionSelector
                            promotions={promotions}
                            selectedPromotionId={currentPromotion.id}
                            onSelectPromotion={setSelectedPromotionId}
                            onUpdatePromotions={fetchPromotions}
                            onForceDataRefresh={forceDataRefresh}
                            currentPromotion={currentPromotion}
                        />
                        <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden">
                            <img src="https://ui-avatars.com/api/?name=Staff+Admin&background=E3001B&color=fff" alt="Profile" />
                        </div>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
                    <div className="max-w-5xl mx-auto space-y-6">

                        {/* VIEW: DASHBOARD */}
                        {currentView === 'dashboard' && (
                            <>
                                {/* Prize Overview - Full Width */}
                                <PrizeOverview
                                    promotionId={currentPromotion.id}
                                    refreshKey={dataRefreshKey}
                                />

                                {/* Stats Card - Full Width */}
                                <StatsCard
                                    promotionId={currentPromotion.id}
                                    key={`stats-${currentPromotion.id}-${dataRefreshKey}`}
                                />

                                {/* Live Leaderboard */}
                                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">🏆</span>
                                            <h3 className="font-bold text-gray-800">Classifica Live</h3>
                                        </div>
                                        <a
                                            href={`/classifica/${currentPromotion.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-[#E3001B] font-medium hover:underline flex items-center gap-1"
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

                                {/* Recent Activity - Ultimi Token Utilizzati */}
                                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-gray-800">Ultimi Token Utilizzati</h3>
                                        <button onClick={() => setCurrentView('token')} className="text-sm text-[#E3001B] font-medium hover:underline">Gestione Token</button>
                                    </div>
                                    <UsedTokensList
                                        promotionId={currentPromotion.id}
                                        key={`used-tokens-${currentPromotion.id}-${dataRefreshKey}`}
                                        limit={5}
                                    />
                                </div>
                            </>
                        )}

                        {/* VIEW: TOKEN */}
                        {currentView === 'token' && (
                            <div className="space-y-6">
                                {/* Gestione Token - Genera e Scarica */}
                                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 bg-[#E3001B]/10 rounded-xl">
                                            <svg className="w-6 h-6 text-[#E3001B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">Gestione Token</h3>
                                            <p className="text-sm text-gray-500">Genera nuovi token e scarica PDF per la stampa</p>
                                        </div>
                                    </div>
                                    <TokenGenerator
                                        promotionId={currentPromotion.id}
                                        promotionName={currentPromotion.name}
                                        onOperationSuccess={forceDataRefresh}
                                    />
                                </div>

                                {/* Liste Token - Side by side on desktop */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Token Disponibili */}
                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                                        <TokenListTable
                                            promotionId={currentPromotion.id}
                                            key={`table-available-${currentPromotion.id}-${dataRefreshKey}`}
                                        />
                                    </div>

                                    {/* Token Utilizzati */}
                                    <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Aggiungi nuovo premio */}
                                <PrizeManager
                                    promotionId={currentPromotion.id}
                                    promotionName={currentPromotion.name}
                                    onPrizeChange={forceDataRefresh}
                                />
                                {/* Lista premi esistenti con modifica/reset/elimina */}
                                <PrizeList
                                    promotionId={currentPromotion.id}
                                    onPrizeChange={forceDataRefresh}
                                    refreshKey={dataRefreshKey}
                                />
                            </div>
                        )}

                        {/* VIEW: LOG */}
                        {currentView === 'log' && (
                            <PlayLogViewer
                                promotionId={currentPromotion.id}
                                key={`logs-${currentPromotion.id}-${dataRefreshKey}`}
                            />
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}