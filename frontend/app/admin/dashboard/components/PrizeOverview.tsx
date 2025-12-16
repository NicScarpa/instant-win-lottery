'use client';

import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../../../lib/api';

interface Prize {
    id: number;
    name: string;
    initial_stock: number;
    remaining_stock: number;
}

interface Props {
    promotionId: string;
    refreshKey?: number;
}

export default function PrizeOverview({ promotionId, refreshKey }: Props) {
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPrizes = useCallback(async () => {
        if (!promotionId) return;

        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setError('Token non trovato');
                return;
            }

            const res = await fetch(getApiUrl(`api/admin/prizes/${promotionId}`), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!res.ok) throw new Error('Errore nel caricamento premi');

            const data = await res.json();
            setPrizes(data);
        } catch (err) {
            console.error(err);
            setError('Impossibile caricare i premi');
        } finally {
            setLoading(false);
        }
    }, [promotionId]);

    useEffect(() => {
        fetchPrizes();
    }, [fetchPrizes, refreshKey]);

    // Calcola totali
    const totalInitial = prizes.reduce((sum, p) => sum + p.initial_stock, 0);
    const totalRemaining = prizes.reduce((sum, p) => sum + p.remaining_stock, 0);
    const totalPercentage = totalInitial > 0 ? Math.round((totalRemaining / totalInitial) * 100) : 0;

    // Funzione per calcolare il colore della barra in base alla percentuale
    const getBarColor = (remaining: number, initial: number): string => {
        const percentage = initial > 0 ? (remaining / initial) * 100 : 0;
        if (percentage > 50) return 'bg-green-500';
        if (percentage > 20) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-12 bg-gray-100 rounded-xl"></div>
                        <div className="h-12 bg-gray-100 rounded-xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                <p className="text-red-500 text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">🎁</span>
                    <h3 className="font-bold text-lg text-gray-800">Premi Configurati</h3>
                </div>
                {prizes.length > 0 && (
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                        {prizes.length} {prizes.length === 1 ? 'tipo' : 'tipi'}
                    </span>
                )}
            </div>

            {prizes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <span className="text-4xl mb-2 block">📦</span>
                    <p className="text-sm">Nessun premio configurato</p>
                    <p className="text-xs mt-1">Vai alla sezione Premi per aggiungerne</p>
                </div>
            ) : (
                <>
                    {/* Lista Premi */}
                    <div className="space-y-4 mb-6">
                        {prizes.map((prize) => {
                            const percentage = prize.initial_stock > 0
                                ? Math.round((prize.remaining_stock / prize.initial_stock) * 100)
                                : 0;

                            return (
                                <div key={prize.id} className="group">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="font-medium text-gray-700 text-sm truncate pr-2">
                                            {prize.name}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                                            {prize.remaining_stock}/{prize.initial_stock}
                                        </span>
                                    </div>
                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${getBarColor(prize.remaining_stock, prize.initial_stock)} transition-all duration-500 rounded-full`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Totale */}
                    <div className="border-t border-gray-100 pt-4">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-800">Totale Disponibili</span>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-gray-600">
                                    {totalRemaining}/{totalInitial}
                                </span>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                    totalPercentage > 50
                                        ? 'bg-green-100 text-green-700'
                                        : totalPercentage > 20
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-red-100 text-red-700'
                                }`}>
                                    {totalPercentage}%
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
