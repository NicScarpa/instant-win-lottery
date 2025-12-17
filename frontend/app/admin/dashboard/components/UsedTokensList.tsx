'use client';

import { useEffect, useState } from 'react';
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
}

export default function UsedTokensList({ promotionId, limit = 5 }: { promotionId: string; limit?: number }) {
    const [tokens, setTokens] = useState<UsedTokenData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        if (!promotionId) return;

        const fetchUsedTokens = async () => {
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem('admin_token');
                if (!token) {
                    setError('Token non trovato');
                    setLoading(false);
                    return;
                }

                const res = await fetch(getApiUrl(`api/admin/used-tokens/${promotionId}?limit=${limit}`), {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                });

                if (res.ok) {
                    const data = await res.json();
                    setTokens(data.tokens || []);
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
        };

        fetchUsedTokens();
    }, [promotionId, limit]);

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
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

    const maskPhoneNumber = (phone: string) => {
        if (phone.length <= 4) return phone;
        return '*** *** ' + phone.slice(-4);
    };

    if (loading) return <div className="text-gray-400 text-xs mt-4 animate-pulse">Caricamento...</div>;
    if (error) return <div className="text-red-500 text-xs mt-4">{error}</div>;

    if (tokens.length === 0) {
        return (
            <div className="w-full py-8 text-center">
                <div className="text-gray-300 text-4xl mb-2">🎮</div>
                <p className="text-gray-400 text-sm">Nessun token ancora utilizzato</p>
                <p className="text-gray-300 text-xs mt-1">I token giocati appariranno qui</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-3">
            {tokens.map((token) => (
                <div key={token.id} className="overflow-hidden">
                    {/* Riga principale - cliccabile */}
                    <div
                        onClick={() => toggleExpand(token.id)}
                        className={`flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-white hover:shadow-md transition border cursor-pointer group
                            ${expandedId === token.id ? 'bg-white shadow-md border-gray-200 rounded-b-none' : 'border-transparent hover:border-gray-100'}`}
                    >
                        <div className="flex items-center gap-4">
                            {/* Icona vincita/perdita */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm
                                ${token.is_winner ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                {token.is_winner ? '✓' : '✗'}
                            </div>
                            <div>
                                <div className="font-mono font-bold text-gray-700">{token.token_code}</div>
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
                        <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
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
                                        {maskPhoneNumber(token.customer.phone_number)}
                                    </p>
                                </div>
                            </div>
                            {token.is_winner && token.prize_name && (
                                <div className="pt-2 border-t border-gray-100">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Premio Vinto</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🎁</span>
                                        <p className="text-sm font-semibold text-green-600">{token.prize_name}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
