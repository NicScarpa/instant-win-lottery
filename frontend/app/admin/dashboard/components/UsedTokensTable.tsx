'use client';

import { useEffect, useState, useCallback } from 'react';
import React from 'react';
import { getApiUrl } from '../../../lib/api';

interface UsedTokenData {
    id: number;
    token_code: string;
    used_at: string;
    is_winner: boolean;
    customer: {
        first_name: string;
        last_name: string;
        phone_number: string;
    } | null;
    prize_name: string | null;
    prize_code: string | null;
    redeemed_at: string | null;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function UsedTokensTable({ promotionId, limit }: { promotionId: string; limit?: number }) {
    const [tokens, setTokens] = useState<UsedTokenData[]>([]);
    const [totalTokens, setTotalTokens] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [redeemingCode, setRedeemingCode] = useState<string | null>(null);

    // STATI PER LA PAGINAZIONE
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(limit || 10);
    const isLimitedView = !!limit;

    const fetchUsedTokens = useCallback(async (page: number, perPage: number) => {
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

            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: perPage.toString()
            });

            const res = await fetch(getApiUrl(`api/admin/used-tokens/${promotionId}?${queryParams}`), {
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
                setError(errData.error || 'Errore nel recupero dei token utilizzati.');
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
        fetchUsedTokens(1, itemsPerPage);
    }, [promotionId, itemsPerPage, fetchUsedTokens]);

    useEffect(() => {
        if (!isLimitedView && currentPage > 1) {
            fetchUsedTokens(currentPage, itemsPerPage);
        }
    }, [currentPage, isLimitedView, itemsPerPage, fetchUsedTokens]);

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

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const markAsRedeemed = async (prizeCode: string) => {
        if (!confirm('Confermi di voler segnare questo premio come riscosso?')) return;

        setRedeemingCode(prizeCode);
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setError('Token non trovato');
                return;
            }

            const res = await fetch(getApiUrl('api/admin/mark-redeemed'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ prizeCode })
            });

            if (res.ok) {
                // Aggiorna la lista
                fetchUsedTokens(currentPage, itemsPerPage);
            } else {
                const errData = await res.json();
                alert(errData.error || 'Errore durante il riscatto');
            }
        } catch (err) {
            console.error(err);
            alert('Errore di connessione');
        } finally {
            setRedeemingCode(null);
        }
    };

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) return <div className="text-gray-400 text-xs mt-4 animate-pulse">Caricamento...</div>;
    if (error) return <div className="text-red-500 text-xs mt-4">{error}</div>;

    if (totalTokens === 0 && tokens.length === 0) {
        return (
            <div className="w-full py-8 text-center">
                <div className="text-gray-300 text-4xl mb-2">🎮</div>
                <p className="text-gray-400 text-sm">Nessun token ancora utilizzato</p>
                <p className="text-gray-300 text-xs mt-1">I token giocati appariranno qui</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {/* Header con titolo e selettore righe */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                    Token Utilizzati <span className="text-sm font-normal text-gray-500">({totalTokens} totali)</span>
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
                    <div key={token.id} className="overflow-hidden">
                        {/* Riga principale - cliccabile */}
                        <div
                            onClick={() => toggleExpand(token.id)}
                            className={`flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-white hover:shadow-md transition border cursor-pointer group
                                ${expandedId === token.id ? 'bg-white shadow-md border-gray-200 rounded-b-none' : 'border-transparent hover:border-gray-100'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shadow-sm
                                    ${token.is_winner ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                    {token.is_winner ? '🎁' : '✗'}
                                </div>
                                <div>
                                    <div className="font-mono font-bold text-gray-700 text-sm">{token.token_code}</div>
                                    <div className="text-xs text-gray-400">
                                        {formatDateTime(token.used_at)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {token.is_winner && (
                                    <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-green-50 text-green-600 border border-green-100">
                                        Vincente
                                    </span>
                                )}
                                <svg
                                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === token.id ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>

                        {/* Dettagli espansi */}
                        {expandedId === token.id && token.customer && (
                            <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Giocatore</p>
                                        <p className="text-sm font-semibold text-gray-700">
                                            {token.customer.first_name} {token.customer.last_name}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Telefono</p>
                                        <p className="text-sm font-mono text-gray-600">
                                            {token.customer.phone_number}
                                        </p>
                                    </div>
                                </div>
                                {token.is_winner && token.prize_name && (
                                    <div className="pt-2 border-t border-gray-100 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Premio Vinto</p>
                                                <p className="text-sm font-semibold text-green-600">{token.prize_name}</p>
                                            </div>
                                            <div className="text-right flex flex-col gap-2 items-end">
                                                {token.redeemed_at ? (
                                                    <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-green-100 text-green-700 border border-green-200">
                                                        Riscosso
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                                                            Da ritirare
                                                        </span>
                                                        {token.prize_code && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    markAsRedeemed(token.prize_code!);
                                                                }}
                                                                disabled={redeemingCode === token.prize_code}
                                                                className="px-3 py-1.5 text-xs font-bold uppercase rounded-lg bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {redeemingCode === token.prize_code ? 'Attendere...' : 'Segna Riscosso'}
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        {token.prize_code && (
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Codice Redeem</p>
                                                <p className="text-sm font-mono font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded inline-block">
                                                    {token.prize_code}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
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
