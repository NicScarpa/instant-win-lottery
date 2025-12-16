'use client';

import { useState } from 'react';
import React from 'react';
import { getApiUrl } from '../../../lib/api';

interface Props {
    promotionId: string;
    promotionName?: string; // Nuova prop per il nome visuale
    onOperationSuccess: () => void;
}

export default function TokenGenerator({ promotionId, promotionName, onOperationSuccess }: Props) {
    const [count, setCount] = useState(10); 
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // ----------------------------------------------------
    // FUNZIONE: RESET TOKEN
    // ----------------------------------------------------
    const handleResetTokens = async () => {
        setSuccessMessage('');
        setErrorMessage('');

        if (!promotionId) {
             setErrorMessage('Seleziona una promozione valida prima di resettare.');
             return;
        }

        // Usa il nome della promo nel confirm se disponibile
        if (!confirm(`Sei sicuro di voler resettare TUTTI i token e le giocate correlate per la Promozione "${promotionName || promotionId}"? Questa azione è irreversibile!`)) {
            return;
        }

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setErrorMessage('Token non trovato');
                return;
            }

            const res = await fetch(getApiUrl(`api/admin/tokens/reset/${promotionId}`), {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });

            const data = await res.json();

            if (res.ok) {
                setSuccessMessage(data.message || `Token resettati con successo.`);
                onOperationSuccess(); 
            } else {
                setErrorMessage(data.error || 'Errore durante il reset dei token.');
            }
        } catch (err) {
            console.error(err);
            setErrorMessage('Errore di connessione al backend durante il reset.');
        }
    };

    // ----------------------------------------------------
    // FUNZIONE: GENERAZIONE TOKEN
    // ----------------------------------------------------
    const handleGenerateTokens = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');

        if (count <= 0) {
            setErrorMessage('La quantità deve essere maggiore di zero.');
            return;
        }
        
        if (!promotionId) {
             setErrorMessage('Seleziona una promozione valida prima di generare i token.');
             return;
        }

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setErrorMessage('Token non trovato');
                return;
            }

            const res = await fetch(getApiUrl('api/admin/generate-tokens'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({ promotionId, count }),
            });

            // 💡 CONTROLLO PER LA RISPOSTA PDF
            if (res.ok && res.headers.get('Content-Type')?.includes('application/pdf')) {
                
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                // Nome file più leggibile
                const fileNameSafe = (promotionName || promotionId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
                a.download = `lotto_${fileNameSafe}_${new Date().getTime()}.pdf`;
                document.body.appendChild(a);
                a.click();
                
                a.remove();
                window.URL.revokeObjectURL(url);

                setSuccessMessage(`${count} token generati e salvati. Download del PDF avviato.`);
                onOperationSuccess(); 
                
            } else if (res.ok) {
                const data = await res.json();
                setSuccessMessage(data.message || `${count} token generati con successo.`);
                onOperationSuccess(); 
            }
            else {
                const errorData = await res.json();
                setErrorMessage(errorData.error || 'Errore sconosciuto durante la generazione dei token.');
            }
        } catch (err) {
            console.error(err);
            setErrorMessage('Errore di connessione al server backend.');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow h-full flex flex-col">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Generazione Lotto</h3>
            
            {successMessage && (
                <div className="p-3 mb-4 text-sm text-green-700 bg-green-100 rounded-lg animate-pulse">
                    {successMessage}
                </div>
            )}
            {errorMessage && (
                <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
                    {errorMessage}
                </div>
            )}

            <form onSubmit={handleGenerateTokens} className="space-y-5 flex-grow">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Promozione Attiva
                    </label>
                    {/* Visualizzazione Nome invece di Input Disabilitato */}
                    <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900 font-medium">
                        {promotionName || "Nessuna promozione selezionata"}
                        <span className="block text-[10px] text-blue-400 font-mono mt-1">{promotionId}</span>
                    </div>
                </div>

                <div>
                    <label htmlFor="count" className="block text-sm font-medium text-gray-700 mb-1">
                        Quantità Token da stampare
                    </label>
                    {/* LAYOUT RESPONSIVE: Colonna su mobile, Riga su desktop */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative flex-1">
                            <input
                                type="number"
                                id="count"
                                value={count}
                                onChange={(e) => setCount(parseInt(e.target.value) || 0)}
                                className="block w-full border border-gray-300 rounded-lg p-2.5 text-black focus:ring-blue-500 focus:border-blue-500"
                                min="1"
                                required
                            />
                            <span className="absolute right-3 top-3 text-gray-400 text-sm">pz.</span>
                        </div>
                        
                        <button
                            type="submit"
                            className="w-full sm:w-auto bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition shadow-md hover:shadow-lg transform active:scale-95"
                        >
                            🖨️ Genera PDF
                        </button>
                    </div>
                </div>
            </form>
            
            <div className="mt-8 pt-4 border-t border-gray-100">
                <button
                    onClick={handleResetTokens}
                    className="w-full text-red-500 text-xs hover:text-red-700 underline transition text-center p-2"
                >
                    ⚠️ Reset totale token per questa promozione
                </button>
            </div>
        </div>
    );
}