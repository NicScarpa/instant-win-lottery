'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { getApiUrl } from '../../../lib/api';

interface TokenData {
    id: string;
    token_code: string;
    status: string;
    promotion_id: string;
    usedAt?: string | null;
}

export default function TokenListTable({ promotionId, limit }: { promotionId: string; limit?: number }) {
    const [tokens, setTokens] = useState<TokenData[]>([]);
    const [totalTokens, setTotalTokens] = useState(0); // Conteggio totale reale dal backend
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // STATI PER LA PAGINAZIONE
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = limit || 10;

    useEffect(() => {
        if (!promotionId) return;

        const fetchTokens = async () => {
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem('admin_token');
                if (!token) {
                    setError('Token non trovato');
                    setLoading(false);
                    return;
                }

                const res = await fetch(getApiUrl(`api/admin/tokens/${promotionId}`), {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                });

                if (res.ok) {
                    const data = await res.json();
                    setTokens(data.tokens || []);
                    setTotalTokens(data.total || 0); // Usa il conteggio totale dal backend
                    setCurrentPage(1);
                } else {
                    const errData = await res.json();
                    setError(errData.error || 'Errore nel recupero della lista token.');
                }
            } catch (err) {
                console.error(err);
                setError('Errore di connessione al server.');
            } finally {
                setLoading(false);
            }
        };

        fetchTokens();
    }, [promotionId]);

    // CALCOLI DI VISUALIZZAZIONE
    // If limit is set, we just take the first N items.
    // Else we do pagination.
    const isLimitedView = !!limit;

    const displayedTokens = isLimitedView
        ? tokens.slice(0, limit)
        : tokens.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const totalPages = Math.ceil(totalTokens / itemsPerPage);

    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(prev => prev - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
    };

    if (loading) return <div className="text-gray-400 text-xs mt-4 animate-pulse">Caricamento...</div>;
    if (error) return <div className="text-red-500 text-xs mt-4">{error}</div>;

    if (totalTokens === 0 && tokens.length === 0) {
        return <p className="text-gray-400 text-sm italic py-4">Nessun token ancora generato.</p>;
    }

    return (
        <div className={isLimitedView ? "w-full" : "mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100"}>
            {!isLimitedView && (
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">
                        Token Generati <span className="text-sm font-normal text-gray-500">({totalTokens} totali)</span>
                    </h3>
                    <span className="text-xs text-gray-400">
                        Pagina {currentPage} di {totalPages || 1}
                    </span>
                </div>
            )}

            <div className={`space-y-3 ${!isLimitedView ? 'mt-4' : ''}`}>
                {displayedTokens.map((token) => (
                    <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-white hover:shadow-md transition border border-transparent hover:border-gray-100 group">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${token.status === 'AVAILABLE' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                }`}>
                                {token.status === 'AVAILABLE' ? '✓' : '✗'}
                            </div>
                            <div>
                                <div className="font-mono font-bold text-gray-700">{token.token_code}</div>
                                <div className="text-xs text-gray-400">
                                    {token.usedAt ? new Date(token.usedAt).toLocaleDateString() + ' ' + new Date(token.usedAt).toLocaleTimeString() : 'Mai utilizzato'}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${token.status === 'AVAILABLE' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
                                }`}>
                                {token.status === 'AVAILABLE' ? 'Attivo' : 'Usato'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination Controls - Only if NOT limited view */}
            {!isLimitedView && totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                    <button
                        onClick={handlePrev}
                        disabled={currentPage === 1}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition ${currentPage === 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        ← Indietro
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={currentPage === totalPages}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition ${currentPage === totalPages
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        Avanti →
                    </button>
                </div>
            )}
        </div>
    );
}