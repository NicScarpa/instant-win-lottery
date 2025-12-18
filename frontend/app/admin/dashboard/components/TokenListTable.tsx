'use client';

import { useEffect, useState, useCallback } from 'react';
import React from 'react';
import { getApiUrl } from '../../../lib/api';

interface TokenData {
    id: string;
    token_code: string;
    status: string;
    promotion_id: string;
    used_at?: string | null;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function TokenListTable({ promotionId, limit }: { promotionId: string; limit?: number }) {
    const [tokens, setTokens] = useState<TokenData[]>([]);
    const [totalTokens, setTotalTokens] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // STATI PER LA PAGINAZIONE
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(limit || 10);
    const isLimitedView = !!limit;

    const fetchTokens = useCallback(async (page: number, perPage: number) => {
        if (!promotionId) return;

        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setError('Token non trovato');
                setLoading(false);
                return;
            }

            // Usa paginazione server-side
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: perPage.toString()
            });

            const res = await fetch(getApiUrl(`api/admin/tokens/${promotionId}?${queryParams}`), {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
            });

            if (res.ok) {
                const data = await res.json();
                setTokens(data.tokens || []);
                setTotalTokens(data.total || 0);
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
    }, [promotionId]);

    useEffect(() => {
        setCurrentPage(1);
        fetchTokens(1, itemsPerPage);
    }, [promotionId, itemsPerPage, fetchTokens]);

    // Refetch when page changes (only for non-limited view)
    useEffect(() => {
        if (!isLimitedView && currentPage > 1) {
            fetchTokens(currentPage, itemsPerPage);
        }
    }, [currentPage, isLimitedView, itemsPerPage, fetchTokens]);

    // For limited view, just show the tokens we have
    // For pagination view, tokens are already paginated from server
    const displayedTokens = isLimitedView ? tokens.slice(0, limit) : tokens;

    const totalPages = Math.max(1, Math.ceil(totalTokens / itemsPerPage));

    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(prev => prev - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
    };

    const handlePageSizeChange = (newSize: number) => {
        setItemsPerPage(newSize);
        setCurrentPage(1);
    };

    if (loading) return <div className="text-gray-400 text-xs mt-4 animate-pulse">Caricamento...</div>;
    if (error) return <div className="text-red-500 text-xs mt-4">{error}</div>;

    if (totalTokens === 0 && tokens.length === 0) {
        return (
            <div className="w-full py-8 text-center">
                <div className="text-gray-300 text-4xl mb-2">🎫</div>
                <p className="text-gray-400 text-sm">Nessun token ancora generato</p>
                <p className="text-gray-300 text-xs mt-1">Genera token dalla sezione sopra</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Header con titolo e selettore righe */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                    Token Disponibili <span className="text-sm font-normal text-gray-500">({totalTokens} totali)</span>
                </h3>
                {!isLimitedView && (
                    <div className="flex items-center gap-3">
                        <label className="text-xs text-gray-500">Righe:</label>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#E3001B]/20"
                        >
                            {PAGE_SIZE_OPTIONS.map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Lista Token */}
            <div className="space-y-2">
                {displayedTokens.map((token) => (
                    <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-white hover:shadow-md transition border border-transparent hover:border-gray-100 group">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shadow-sm ${token.status === 'available' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                }`}>
                                {token.status === 'available' ? '✓' : '✗'}
                            </div>
                            <div>
                                <div className="font-mono font-bold text-gray-700 text-sm">{token.token_code}</div>
                                <div className="text-xs text-gray-400">
                                    {token.status === 'available'
                                        ? 'Disponibile'
                                        : token.used_at
                                            ? `Usato il ${new Date(token.used_at).toLocaleDateString()}`
                                            : 'Usato'}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${token.status === 'available' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
                                }`}>
                                {token.status === 'available' ? 'Attivo' : 'Usato'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination Controls - Only if NOT limited view */}
            {!isLimitedView && totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                    <button
                        onClick={handlePrev}
                        disabled={currentPage === 1}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${currentPage === 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        ← Indietro
                    </button>

                    <span className="text-xs text-gray-400">
                        Pagina {currentPage} di {totalPages}
                    </span>

                    <button
                        onClick={handleNext}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${currentPage === totalPages
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Avanti →
                    </button>
                </div>
            )}
        </div>
    );
}
