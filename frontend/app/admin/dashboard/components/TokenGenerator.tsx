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
    // FUNZIONE: DOWNLOAD PDF TOKEN ESISTENTI
    // ----------------------------------------------------
    const handleDownloadExistingPDF = async () => {
        setSuccessMessage('');
        setErrorMessage('');

        if (!promotionId) {
            setErrorMessage('Seleziona una promozione valida.');
            return;
        }

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setErrorMessage('Token di autenticazione non trovato');
                return;
            }

            const res = await fetch(getApiUrl(`api/admin/tokens/pdf/${promotionId}`), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
            });

            if (res.ok && res.headers.get('Content-Type')?.includes('application/pdf')) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                const fileNameSafe = (promotionName || promotionId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
                a.download = `tokens_${fileNameSafe}.pdf`;
                document.body.appendChild(a);
                a.click();

                a.remove();
                window.URL.revokeObjectURL(url);

                setSuccessMessage('PDF scaricato con successo!');
            } else {
                const errorData = await res.json();
                setErrorMessage(errorData.error || 'Nessun token disponibile da scaricare.');
            }
        } catch (err) {
            console.error(err);
            setErrorMessage('Errore durante il download del PDF.');
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

                setSuccessMessage(`${count} token generati. Download PDF...`);
                onOperationSuccess();

            } else if (res.ok) {
                const data = await res.json();
                setSuccessMessage(data.message || `${count} token generati.`);
                onOperationSuccess();
            }
            else {
                const errorData = await res.json();
                setErrorMessage(errorData.error || 'Errore sconosciuto.');
            }
        } catch (err) {
            console.error(err);
            setErrorMessage('Errore di connessione.');
        }
    };

    return (
        <div className="flex flex-col h-full bg-transparent">
            {successMessage && (
                <div className="p-2 mb-2 text-xs text-green-700 bg-green-50 rounded-lg animate-pulse border border-green-100">
                    {successMessage}
                </div>
            )}
            {errorMessage && (
                <div className="p-2 mb-2 text-xs text-red-700 bg-red-50 rounded-lg border border-red-100">
                    {errorMessage}
                </div>
            )}

            <form onSubmit={handleGenerateTokens} className="flex flex-col gap-4">

                {/* Input Control */}
                <div>
                    <label htmlFor="count" className="block text-xs font-semibold text-gray-500 mb-1 pl-1">
                        Quantità
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            id="count"
                            value={count}
                            onChange={(e) => setCount(parseInt(e.target.value) || 0)}
                            className="block w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-lg font-bold text-gray-800 focus:ring-[#E3001B] focus:border-[#E3001B] transition-colors"
                            min="1"
                            required
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-400 text-sm font-medium">pz</span>
                        </div>
                    </div>
                </div>

                {/* Submit Action */}
                <button
                    type="submit"
                    className="w-full bg-[#E3001B] text-white font-bold py-3 px-4 rounded-xl hover:bg-[#c40018] transition-all shadow-lg shadow-red-500/30 active:scale-95 flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Genera + Stampa PDF
                </button>
            </form>

            {/* Download PDF Token Esistenti */}
            <button
                type="button"
                onClick={handleDownloadExistingPDF}
                className="w-full mt-3 bg-gray-100 text-gray-700 font-semibold py-2.5 px-4 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 text-sm"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Scarica PDF Token Esistenti
            </button>

            <div className="mt-auto pt-4 text-center">
                <button
                    onClick={handleResetTokens}
                    className="text-gray-400 text-[10px] hover:text-[#E3001B] transition underline decoration-dashed underline-offset-2"
                >
                    Reset token della promozione
                </button>
            </div>
        </div>
    );
}