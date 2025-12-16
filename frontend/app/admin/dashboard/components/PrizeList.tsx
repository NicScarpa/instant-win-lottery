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
    onPrizeChange: () => void;
}

export default function PrizeList({ promotionId, onPrizeChange }: Props) {
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    // Stati per modifica inline
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editInitialStock, setEditInitialStock] = useState(0);
    const [editRemainingStock, setEditRemainingStock] = useState(0);

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
    }, [fetchPrizes]);

    const clearMessages = () => {
        setError(null);
        setSuccessMessage('');
    };

    // Inizia modifica
    const startEdit = (prize: Prize) => {
        setEditingId(prize.id);
        setEditInitialStock(prize.initial_stock);
        setEditRemainingStock(prize.remaining_stock);
        clearMessages();
    };

    // Annulla modifica
    const cancelEdit = () => {
        setEditingId(null);
    };

    // Salva modifica
    const saveEdit = async (prizeId: number) => {
        clearMessages();

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setError('Token non trovato');
                return;
            }

            const res = await fetch(getApiUrl(`api/admin/prizes/${prizeId}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    initial_stock: editInitialStock,
                    remaining_stock: editRemainingStock
                })
            });

            const data = await res.json();

            if (res.ok) {
                setSuccessMessage('Premio aggiornato con successo');
                setEditingId(null);
                fetchPrizes();
                onPrizeChange();
            } else {
                setError(data.error || 'Errore durante l\'aggiornamento');
            }
        } catch (err) {
            console.error(err);
            setError('Errore di connessione');
        }
    };

    // Reset stock
    const resetStock = async (prizeId: number, prizeName: string) => {
        if (!confirm(`Vuoi resettare lo stock del premio "${prizeName}"? Il rimanente tornerà uguale allo stock iniziale.`)) {
            return;
        }

        clearMessages();

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setError('Token non trovato');
                return;
            }

            const res = await fetch(getApiUrl(`api/admin/prizes/${prizeId}/reset`), {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            const data = await res.json();

            if (res.ok) {
                setSuccessMessage(data.message || 'Stock resettato con successo');
                fetchPrizes();
                onPrizeChange();
            } else {
                setError(data.error || 'Errore durante il reset');
            }
        } catch (err) {
            console.error(err);
            setError('Errore di connessione');
        }
    };

    // Elimina premio
    const deletePrize = async (prizeId: number, prizeName: string) => {
        if (!confirm(`Sei sicuro di voler eliminare il premio "${prizeName}"? Questa azione non può essere annullata.`)) {
            return;
        }

        clearMessages();

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setError('Token non trovato');
                return;
            }

            const res = await fetch(getApiUrl(`api/admin/prizes/${prizeId}`), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            const data = await res.json();

            if (res.ok) {
                setSuccessMessage(data.message || 'Premio eliminato con successo');
                fetchPrizes();
                onPrizeChange();
            } else {
                setError(data.error || 'Errore durante l\'eliminazione');
            }
        } catch (err) {
            console.error(err);
            setError('Errore di connessione');
        }
    };

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-12 bg-gray-100 rounded"></div>
                        <div className="h-12 bg-gray-100 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Premi Esistenti</h3>

            {/* Messaggi */}
            {successMessage && (
                <div className="p-3 mb-4 text-sm text-green-700 bg-green-100 rounded-lg">
                    {successMessage}
                </div>
            )}
            {error && (
                <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
                    {error}
                </div>
            )}

            {prizes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">Nessun premio configurato</p>
                    <p className="text-xs mt-1">Usa il form a sinistra per aggiungerne uno</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {prizes.map((prize) => (
                        <div key={prize.id} className="border border-gray-200 rounded-lg p-4">
                            {editingId === prize.id ? (
                                // Modalità modifica
                                <div className="space-y-3">
                                    <div className="font-medium text-gray-800">{prize.name}</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Stock Iniziale</label>
                                            <input
                                                type="number"
                                                value={editInitialStock}
                                                onChange={(e) => setEditInitialStock(parseInt(e.target.value) || 0)}
                                                className="w-full border border-gray-300 rounded p-2 text-sm text-black"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Stock Rimanente</label>
                                            <input
                                                type="number"
                                                value={editRemainingStock}
                                                onChange={(e) => setEditRemainingStock(parseInt(e.target.value) || 0)}
                                                className="w-full border border-gray-300 rounded p-2 text-sm text-black"
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => saveEdit(prize.id)}
                                            className="flex-1 bg-green-600 text-white text-sm py-2 rounded hover:bg-green-700 transition"
                                        >
                                            Salva
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="flex-1 bg-gray-300 text-gray-700 text-sm py-2 rounded hover:bg-gray-400 transition"
                                        >
                                            Annulla
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Modalità visualizzazione
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-800">{prize.name}</div>
                                        <div className="text-sm text-gray-500">
                                            Stock: <span className="font-semibold">{prize.remaining_stock}</span> / {prize.initial_stock}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => startEdit(prize)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                                            title="Modifica"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => resetStock(prize.id, prize.name)}
                                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded transition"
                                            title="Reset Stock"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => deletePrize(prize.id, prize.name)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                                            title="Elimina"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
