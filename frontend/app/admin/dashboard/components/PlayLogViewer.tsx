'use client';

import { useState, useEffect, useCallback } from 'react';
import React from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Force rebuild timestamp: 2025-12-15T18:15:00Z

interface PlayLog {
    playId: string;
    isWinner: boolean;
    date: string;
    tokenCode: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
}

export default function PlayLogViewer({ promotionId }: { promotionId: string }) {
    const [logs, setLogs] = useState<PlayLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        if (!promotionId) return;
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/api/admin/play-logs/${promotionId}`, {
                method: 'GET',
                credentials: 'include',
            });

            if (!res.ok) throw new Error('Errore nel recupero dei log.');

            const data = await res.json();
            setLogs(data);
        } catch (err) {
            console.error(err);
            setError('Impossibile caricare lo storico giocate.');
        } finally {
            setIsLoading(false);
        }
    }, [promotionId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Funzione per generare e scaricare il CSV
    const downloadCSV = () => {
        if (logs.length === 0) return;

        const headers = ['Data', 'Token', 'Nome', 'Cognome', 'Telefono', 'Esito'];
        
        const rows = logs.map(log => [
            new Date(log.date).toLocaleString(),
            log.tokenCode,
            log.firstName,
            log.lastName,
            log.phoneNumber,
            log.isWinner ? 'VINCITORE' : 'Non Vincente'
        ]);

        const csvContent = [
            headers.join(','), 
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `log_giocate_promo_${promotionId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) return <p className="text-gray-500 text-sm animate-pulse">Caricamento storico...</p>;
    if (error) return <p className="text-red-500 text-sm">{error}</p>;

    return (
        <div className="mt-8">
            {/* HEADER RESPONSIVE: Stack verticale su mobile, Riga su desktop */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <h3 className="text-xl font-bold text-gray-800">
                    Storico Giocate <span className="text-sm font-normal text-gray-500">({logs.length})</span>
                </h3>
                <button
                    onClick={downloadCSV}
                    disabled={logs.length === 0}
                    className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm flex items-center justify-center gap-2 ${
                        logs.length === 0 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                >
                    <span>📥</span> Scarica CSV Clienti
                </button>
            </div>

            {logs.length === 0 ? (
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 text-gray-500 text-center text-sm">
                    Nessuna giocata registrata per questa promozione.
                </div>
            ) : (
                // TABELLA SCROLLABILE ORIZZONTALMENTE
                <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm max-h-96">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Data</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Telefono</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Token</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Esito</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {logs.map((log) => (
                                <tr key={log.playId} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(log.date).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {log.firstName} {log.lastName}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                                        {log.phoneNumber}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 font-mono text-xs">
                                        {log.tokenCode}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        {log.isWinner ? (
                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-green-100 text-green-800 border border-green-200">
                                                🎉 VINTO
                                            </span>
                                        ) : (
                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                                Perso
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}