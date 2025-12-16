'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import TokenGenerator from './components/TokenGenerator';
import TokenListTable from './components/TokenListTable';
import StatsCard from './components/StatsCard';
import PrizeManager from './components/PrizeManager';
import PrizeList from './components/PrizeList';
import PromotionSelector from './components/PromotionSelector';
import PlayLogViewer from './components/PlayLogViewer';
import PrizeOverview from './components/PrizeOverview';
import Sidebar from './components/Sidebar';
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
                setSelectedPromotionId(data[0].id);
            } else if (data.length > 0 && selectedPromotionId && !data.find(p => p.id === selectedPromotionId)) {
                setSelectedPromotionId(data[0].id);
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

    const currentPromotion = promotions.find(p => p.id === selectedPromotionId) || promotions[0];

    if (!currentPromotion) return <div>Errore stato dashboard. Ricarica la pagina.</div>;

    return (
        <div className="flex bg-[#F5F5F7] min-h-screen font-sans overflow-hidden">
            {/* Sidebar */}
            <Sidebar
                currentView={currentView}
                onChangeView={setCurrentView}
                onLogout={handleLogout}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-0">
                {/* Header / Top Bar */}
                <div className="bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex justify-between items-center border-b border-gray-100">
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
                                {/* Stats & Quick Actions Row */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Stats Card (Takes 2 cols on md) */}
                                    <div className="md:col-span-2">
                                        <StatsCard
                                            promotionId={currentPromotion.id}
                                            key={`stats-${currentPromotion.id}-${dataRefreshKey}`}
                                        />
                                    </div>

                                    {/* Quick Actions / Generator */}
                                    <div className="md:col-span-1">
                                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 h-full flex flex-col justify-between relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg mb-1">Nuovo Token</h3>
                                                <p className="text-sm text-gray-500 mb-4">Genera un codice di gioco rapido</p>
                                            </div>
                                            <TokenGenerator
                                                promotionId={currentPromotion.id}
                                                promotionName={currentPromotion.name}
                                                onOperationSuccess={forceDataRefresh}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Activity + Prize Overview Row */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Token List */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4 px-2">
                                            <h3 className="font-bold text-gray-800">Ultimi Token Utilizzati</h3>
                                            <button onClick={() => setCurrentView('token')} className="text-sm text-[#E3001B] font-medium hover:underline">Vedi tutti</button>
                                        </div>
                                        <TokenListTable
                                            promotionId={currentPromotion.id}
                                            key={`table-${currentPromotion.id}-${dataRefreshKey}`}
                                            limit={5}
                                        />
                                    </div>

                                    {/* Prize Overview */}
                                    <div>
                                        <PrizeOverview
                                            promotionId={currentPromotion.id}
                                            refreshKey={dataRefreshKey}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* VIEW: TOKEN */}
                        {currentView === 'token' && (
                            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg mb-6">Gestione Token</h3>
                                <TokenListTable
                                    promotionId={currentPromotion.id}
                                    key={`table-full-${currentPromotion.id}-${dataRefreshKey}`}
                                />
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