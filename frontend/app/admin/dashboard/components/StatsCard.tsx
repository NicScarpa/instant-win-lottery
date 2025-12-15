'use client';

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { getApiUrl } from '../../../lib/api';

interface PrizeDetail {
    name: string;
    initial_stock: number;
    remaining_stock: number;
}

interface StatsData {
    tokenStats: {
        total: number;
        used: number;
        available: number;
    };
    prizeStats: {
        total: number;
        remaining: number;
        details: PrizeDetail[];
    };
}

export default function StatsCard({ promotionId }: { promotionId: string }) {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        if (!promotionId) {
            setError("ID Promozione non fornito.");
            setIsLoading(false);
            return;
        }

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                throw new Error('Token non trovato');
            }

            const res = await fetch(getApiUrl(`api/admin/stats/${promotionId}`), {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Errore HTTP: ${res.status}`);
            }

            const data: StatsData = await res.json();
            setStats(data);

        } catch (err) {
            console.error('Errore nel recupero delle statistiche:', err);
            setError(`Impossibile caricare le statistiche. Errore: ${(err as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    }, [promotionId]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]); 

    if (isLoading) {
        return <p className="text-gray-600 animate-pulse">Caricamento statistiche...</p>;
    }

    if (error) {
        return <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-lg text-sm">⚠️ {error}</div>;
    }

    if (!stats) {
        return <p className="text-gray-500 italic">Nessun dato disponibile.</p>;
    }

    // Struttura di visualizzazione
    return (
        <div className="bg-transparent">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Riepilogo e Statistiche</h3>
            
            {/* GRID RESPONSIVE: 1 colonna su mobile, 3 su tablet/desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <StatBox title="Token Generati" value={stats.tokenStats.total} color="bg-blue-600" />
                <StatBox title="Disponibili" value={stats.tokenStats.available} color="bg-green-600" />
                <StatBox title="Utilizzati" value={stats.tokenStats.used} color="bg-red-600" />
            </div>

            <h4 className="text-lg font-bold mt-6 mb-3 text-gray-800 border-b pb-2">Stock Premi</h4>
            
            <div className="space-y-3">
                {stats.prizeStats.details.length === 0 ? (
                     <p className="text-gray-500 text-sm italic">Nessun premio configurato.</p>
                ) : (
                    stats.prizeStats.details.map((prize, index) => (
                        <PrizeStockRow key={index} prize={prize} />
                    ))
                )}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-100 text-right">
                <p className="text-xs text-gray-400 font-medium">
                    TOTALE: {stats.prizeStats.remaining} rimanenti su {stats.prizeStats.total} iniziali
                </p>
            </div>
        </div>
    );
}

// Componente Card Statistiche
const StatBox = ({ title, value, color }: { title: string, value: number, color: string }) => (
    <div className={`p-5 rounded-xl shadow-sm text-white ${color} flex flex-col justify-between h-24 sm:h-auto`}>
        <p className="text-xs font-bold uppercase tracking-wider opacity-80">{title}</p>
        <p className="text-3xl font-extrabold mt-1">{value}</p>
    </div>
);

// Componente Riga Premio (Responsive)
const PrizeStockRow = ({ prize }: { prize: PrizeDetail }) => {
    // Calcolo percentuale per una barra visiva semplice
    const percentage = prize.initial_stock > 0 ? (prize.remaining_stock / prize.initial_stock) * 100 : 0;
    
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 rounded-lg border border-gray-100 gap-2">
            <div className="flex-1">
                <span className="font-semibold text-gray-800 block sm:inline">{prize.name}</span>
                {/* Barra di progresso visuale */}
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 sm:mt-1 sm:w-32">
                    <div 
                        className={`h-1.5 rounded-full ${percentage < 20 ? 'bg-red-500' : 'bg-blue-500'}`} 
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
            </div>
            <div className="flex justify-between sm:block sm:text-right">
                <span className="text-xs text-gray-500 uppercase font-bold sm:hidden">Disponibilità</span>
                <span className={`text-sm font-bold ${prize.remaining_stock === 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {prize.remaining_stock} <span className="text-gray-400 font-normal text-xs">/ {prize.initial_stock}</span>
                </span>
            </div>
        </div>
    );
};