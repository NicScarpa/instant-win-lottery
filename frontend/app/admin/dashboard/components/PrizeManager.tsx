'use client';

import { useState } from 'react';
import React from 'react';
import { getApiUrl } from '../../../lib/api';

interface Props {
    promotionId: string;
    promotionName?: string; // Nuova prop per compatibilità con page.tsx
    onPrizeChange: () => void;
}

export default function PrizeManager({ promotionId, promotionName, onPrizeChange }: Props) {
    const [name, setName] = useState(''); 
    const [initialStock, setInitialStock] = useState(1); 
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
    const handleAddPrize = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage('');
        setErrorMessage('');
        
        if (!promotionId) {
             setErrorMessage('Seleziona una promozione valida prima di aggiungere un premio.');
             return;
        }

        if (name.trim() === '') {
            setErrorMessage('Il nome del premio non può essere vuoto.');
            return;
        }

        if (initialStock <= 0) {
            setErrorMessage('La quantità deve essere maggiore di zero.');
            return;
        }

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setErrorMessage('Token non trovato');
                return;
            }

            const res = await fetch(getApiUrl('api/admin/prizes/add'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    promotionId: promotionId,
                    name: name,
                    initialStock: initialStock
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setSuccessMessage(`Premio "${data.prize.name}" creato con stock iniziale di ${data.prize.initial_stock}.`);
                setName(''); 
                setInitialStock(1);
                
                // Chiama la funzione di refresh del genitore
                onPrizeChange();
                
            } else {
                setErrorMessage(data.error || 'Errore sconosciuto durante la creazione del premio.');
            }
        } catch (err) {
            console.error(err);
            setErrorMessage('Errore di connessione al server backend. Impossibile aggiungere il premio.');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow h-full">
            {/* TITOLO PULITO: Rimosso l'ID tra parentesi */}
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Gestione Premi</h3>
            
            {successMessage && (
                <div className="p-3 mb-4 text-sm text-green-700 bg-green-100 rounded-lg animate-fade-in">
                    {successMessage}
                </div>
            )}
            {errorMessage && (
                <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg animate-fade-in">
                    {errorMessage}
                </div>
            )}

            <form onSubmit={handleAddPrize} className="space-y-4">
                <div>
                    <label htmlFor="prizeName" className="block text-sm font-medium text-gray-700">
                        Nome del Premio
                    </label>
                    <input
                        type="text"
                        id="prizeName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Es: Buono Sconto 10€"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="stockCount" className="block text-sm font-medium text-gray-700">
                        Stock Iniziale (Quantità Totale)
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            id="stockCount"
                            value={initialStock}
                            onChange={(e) => setInitialStock(parseInt(e.target.value) || 0)}
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black focus:ring-blue-500 focus:border-blue-500"
                            min="1"
                            required
                        />
                        <span className="text-gray-500 text-sm">pz.</span>
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-green-600 text-white font-bold p-2.5 rounded-md hover:bg-green-700 transition shadow-sm"
                >
                    Aggiungi Tipo di Premio
                </button>
            </form>
        </div>
    );
}