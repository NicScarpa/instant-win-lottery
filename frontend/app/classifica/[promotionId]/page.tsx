'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getApiUrl } from '../../lib/api';

interface LeaderboardEntry {
    rank: number;
    name: string;
    phone: string;
    plays: number;
}

interface PromotionInfo {
    name: string;
    status: string;
}

const CAMPARI_RED = '#E3001B';

export default function PublicLeaderboardPage() {
    const params = useParams();
    const promotionId = params.promotionId as string;

    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [promotion, setPromotion] = useState<PromotionInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!promotionId) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch leaderboard
                const leaderboardRes = await fetch(getApiUrl(`api/leaderboard/${promotionId}`));
                if (!leaderboardRes.ok) throw new Error('Classifica non disponibile');
                const leaderboardData = await leaderboardRes.json();
                setLeaderboard(leaderboardData.leaderboard || []);

                // Fetch promotion info (public endpoint)
                const promoRes = await fetch(getApiUrl(`api/promotions/public/${promotionId}`));
                if (promoRes.ok) {
                    const promoData = await promoRes.json();
                    setPromotion(promoData);
                }
            } catch (err) {
                console.error('Fetch error:', err);
                setError('Impossibile caricare la classifica');
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Auto-refresh ogni 30 secondi
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [promotionId]);

    const bgStyle = {
        backgroundColor: CAMPARI_RED,
        backgroundImage: `url('/bottiglia.png')`,
        backgroundSize: '80px',
        backgroundRepeat: 'repeat',
        backgroundBlendMode: 'soft-light',
    };

    return (
        <div style={bgStyle} className="min-h-screen font-sans text-white pb-12 flex flex-col items-center">
            {/* Header */}
            <header className="pt-8 pb-4 w-full max-w-md mx-auto px-6">
                <img
                    src="/camparisoda.png"
                    alt="Campari Soda"
                    className="w-40 mx-auto drop-shadow-md mb-4"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                />
                <div className="text-center">
                    <h1 className="text-3xl font-black uppercase tracking-tighter">Classifica</h1>
                </div>
            </header>

            <main className="flex-grow w-full max-w-md px-6">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="uppercase tracking-widest text-sm">Caricamento...</p>
                    </div>
                ) : error ? (
                    <div className="bg-white text-black p-8 text-center border-4 border-black">
                        <h2 className="text-2xl font-bold mb-4">Ops!</h2>
                        <p className="text-gray-600">{error}</p>
                    </div>
                ) : leaderboard.length === 0 ? (
                    <div className="bg-white text-black p-8 text-center border-4 border-black">
                        <div className="text-5xl mb-4">🏆</div>
                        <h2 className="text-2xl font-bold uppercase mb-2">Classifica Vuota</h2>
                        <p className="text-gray-600">Nessuna giocata registrata per questa promozione.</p>
                    </div>
                ) : (
                    <div className="bg-white text-black p-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        {/* Header tabella */}
                        <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 pb-2 mb-2 border-b-2 border-gray-200 tracking-widest">
                            <span>Pos / Giocatore</span>
                            <span>Giocate</span>
                        </div>

                        {/* Lista classifica */}
                        <ul className="space-y-2">
                            {leaderboard.map((entry) => (
                                <li
                                    key={entry.rank}
                                    className={`flex justify-between items-center p-3 border-2 transition-all
                                        ${entry.rank <= 3 ? 'bg-gray-50' : 'bg-white'}
                                        border-gray-200`}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Badge posizione */}
                                        <div className={`w-8 h-8 flex items-center justify-center font-black text-sm
                                            ${entry.rank === 1 ? 'bg-[#E3001B] text-white' :
                                              entry.rank === 2 ? 'bg-gray-400 text-white' :
                                              entry.rank === 3 ? 'bg-orange-400 text-white' :
                                              'bg-transparent text-gray-400'}`}
                                        >
                                            {entry.rank}
                                        </div>
                                        <div className="flex flex-col leading-none">
                                            <span className="font-bold uppercase text-sm tracking-tight">
                                                {entry.name}
                                            </span>
                                            <span className="text-[10px] font-mono text-gray-400 mt-0.5">
                                                {entry.phone}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="font-black text-xl tracking-tighter">
                                        {entry.plays}
                                    </div>
                                </li>
                            ))}
                        </ul>

                        {/* Footer refresh info */}
                        <div className="text-center text-[10px] text-gray-400 mt-4 pt-2 border-t border-gray-100">
                            Aggiornamento automatico ogni 30 secondi
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="text-center text-[10px] text-white/60 py-4 mt-auto uppercase tracking-widest">
                Campari Soda Instant Win
            </footer>
        </div>
    );
}
