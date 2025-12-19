'use client';

import { useState } from 'react';
import React from 'react';
import { Promotion } from '../page'; 
import { getApiUrl } from '../../../lib/api'; // <--- IMPORTANTE

interface PromotionSelectorProps {
    promotions: Promotion[];
    selectedPromotionId: string;
    onSelectPromotion: (id: string) => void;
    onUpdatePromotions: () => void;
    onForceDataRefresh: () => void;
    currentPromotion: Promotion;
}

export default function PromotionSelector({
    promotions,
    selectedPromotionId,
    onSelectPromotion,
    onUpdatePromotions,
    onForceDataRefresh,
    currentPromotion,
}: PromotionSelectorProps) {
    
    // Stato per la modifica
    const [name, setName] = useState(currentPromotion.name);
    const [plannedTokenCount, setPlannedTokenCount] = useState(currentPromotion.planned_token_count);
    const [status, setStatus] = useState(currentPromotion.status);
    const [startDatetime, setStartDatetime] = useState(() => {
        if (currentPromotion.start_datetime) {
            return new Date(currentPromotion.start_datetime).toISOString().slice(0, 16);
        }
        return '';
    });
    const [endDatetime, setEndDatetime] = useState(() => {
        if (currentPromotion.end_datetime) {
            return new Date(currentPromotion.end_datetime).toISOString().slice(0, 16);
        }
        return '';
    });
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Stati per la creazione
    const [newName, setNewName] = useState('');
    const [newPlannedTokenCount, setNewPlannedTokenCount] = useState(100);
    // Default: data/ora attuale per inizio
    const [newStartDatetime, setNewStartDatetime] = useState(() => {
        const now = new Date();
        return now.toISOString().slice(0, 16); // Formato datetime-local: YYYY-MM-DDTHH:mm
    });
    const [newEndDatetime, setNewEndDatetime] = useState('');

    React.useEffect(() => {
        setName(currentPromotion.name);
        setPlannedTokenCount(currentPromotion.planned_token_count);
        setStatus(currentPromotion.status);
        if (currentPromotion.start_datetime) {
            setStartDatetime(new Date(currentPromotion.start_datetime).toISOString().slice(0, 16));
        }
        if (currentPromotion.end_datetime) {
            setEndDatetime(new Date(currentPromotion.end_datetime).toISOString().slice(0, 16));
        }
        setIsEditing(false);
        setIsCreating(false);
        setSuccessMessage('');
        setErrorMessage('');
    }, [currentPromotion]);

    // --- FUNZIONI LOGICHE ---
    const handleCreatePromotion = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage(''); setErrorMessage('');

        if (newPlannedTokenCount <= 0 || !newName || !newStartDatetime || !newEndDatetime) {
            setErrorMessage('Tutti i campi sono obbligatori.');
            return;
        }

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setErrorMessage('Token non trovato');
                return;
            }

            // Converti datetime-local in ISO string per il backend
            const startISO = new Date(newStartDatetime).toISOString();
            const endISO = new Date(newEndDatetime).toISOString();

            const res = await fetch(getApiUrl('api/promotions/create'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: newName,
                    plannedTokenCount: newPlannedTokenCount,
                    startDatetime: startISO,
                    endDatetime: endISO,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessMessage(`Promozione creata con successo.`);
                setIsCreating(false);
                onUpdatePromotions();
                if (data.promotion.id) onSelectPromotion(data.promotion.id);
            } else {
                setErrorMessage(data.error || 'Errore creazione.');
            }
        } catch (err) { setErrorMessage('Errore connessione.'); }
    };

    const handleUpdatePromotion = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage(''); setErrorMessage('');
        
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setErrorMessage('Token non trovato');
                return;
            }

            // Converti datetime-local in ISO string per il backend
            const startISO = startDatetime ? new Date(startDatetime).toISOString() : null;
            const endISO = endDatetime ? new Date(endDatetime).toISOString() : null;

            const res = await fetch(getApiUrl(`api/promotions/update/${currentPromotion.id}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    name,
                    plannedTokenCount: parseInt(plannedTokenCount.toString()),
                    status,
                    start_datetime: startISO,
                    end_datetime: endISO,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessMessage(`Promozione aggiornata.`);
                setIsEditing(false);
                onUpdatePromotions(); 
                onForceDataRefresh(); 
            } else { setErrorMessage(data.error || 'Errore aggiornamento.'); }
        } catch (err) { setErrorMessage('Errore connessione.'); }
    };
    
    const handleDeletePromotion = async () => {
        setSuccessMessage(''); setErrorMessage('');
        if (promotions.length <= 1) { setErrorMessage('Impossibile eliminare l\'unica promozione.'); return; }
        if (!confirm(`ELIMINARE PERMANENTEMENTE "${currentPromotion.name}"?`)) return;

        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setErrorMessage('Token non trovato');
                return;
            }

            const res = await fetch(getApiUrl(`api/promotions/delete/${currentPromotion.id}`), {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
            });
            if (res.ok) {
                setSuccessMessage(`Promozione eliminata.`);
                const remaining = promotions.filter(p => String(p.id) !== String(currentPromotion.id));
                if (remaining.length > 0) {
                    onSelectPromotion(remaining[0].id);
                }
                onUpdatePromotions();
                onForceDataRefresh();
            } else { setErrorMessage('Errore eliminazione.'); }
        } catch (err) { setErrorMessage('Errore connessione.'); }
    };

    // --- RENDER ---
    return (
        <div>
            {/* MESSAGGI DI STATO */}
            {successMessage && <div className="p-3 mb-3 text-sm text-green-700 bg-green-100 rounded-lg">{successMessage}</div>}
            {errorMessage && <div className="p-3 mb-3 text-sm text-red-700 bg-red-100 rounded-lg">{errorMessage}</div>}
            
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 pb-4 border-b border-gray-200 gap-4">
                 
                 {/* GRUPPO SELETTORE */}
                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
                     <div className="w-full sm:w-auto">
                         <label htmlFor="promo-select" className="block text-xs font-bold text-gray-500 uppercase mb-1 sm:hidden">
                             Promozione Attiva
                         </label>
                         <select
                             id="promo-select"
                             value={selectedPromotionId}
                             onChange={(e) => onSelectPromotion(e.target.value)}
                             className="w-full sm:w-64 border border-gray-300 rounded-md p-2 text-black text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                             disabled={isEditing || isCreating}
                         >
                             {promotions.map((p) => (
                                 <option key={p.id} value={p.id}>
                                     {p.name}
                                 </option>
                             ))}
                         </select>
                     </div>
                     
                     <span className={`px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wide ${
                          currentPromotion.status === 'ACTIVE' ? 'bg-green-100 text-green-700 border border-green-200' : 
                          currentPromotion.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                          'bg-gray-100 text-gray-600 border border-gray-200'
                     }`}>
                         {currentPromotion.status}
                     </span>
                 </div>
                 
                 {/* GRUPPO PULSANTI */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-row gap-2 w-full lg:w-auto">
                      <button 
                         onClick={() => { setIsCreating(!isCreating); setIsEditing(false); }}
                         className={`px-4 py-2 rounded-lg transition text-sm font-medium shadow-sm w-full md:w-auto ${
                             isCreating ? 'bg-gray-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                         }`}
                      >
                         {isCreating ? 'Annulla' : '✨ Nuova'}
                      </button>
                      
                      <button 
                         onClick={onForceDataRefresh}
                         className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium w-full md:w-auto"
                         disabled={isEditing || isCreating}
                      >
                         🔄 Aggiorna
                      </button>
                      
                      <button 
                         onClick={() => { setIsEditing(!isEditing); setIsCreating(false); }}
                         className={`px-4 py-2 rounded-lg transition text-sm font-medium shadow-sm w-full md:w-auto ${
                             isEditing ? 'bg-red-500 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'
                         }`}
                         disabled={isCreating}
                      >
                         {isEditing ? 'Annulla' : '⚙️ Modifica'}
                      </button>
                      
                       <button 
                         onClick={handleDeletePromotion}
                         className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition text-sm font-medium w-full md:w-auto"
                         disabled={isEditing || isCreating || promotions.length <= 1}
                      >
                         🗑️ Elimina
                      </button>
                 </div>
            </div>
            
            {/* FORM CREAZIONE */}
            {isCreating && (
                <form onSubmit={handleCreatePromotion} className="p-5 bg-indigo-50 rounded-xl border border-indigo-200 shadow-sm animate-fade-in mb-6">
                    <h4 className="text-lg font-bold mb-4 text-indigo-900">Nuova Promozione</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border rounded-lg p-2.5 text-black" required placeholder="Es. Estate 2025" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Token Totali</label>
                            <input type="number" value={newPlannedTokenCount} onChange={(e) => setNewPlannedTokenCount(parseInt(e.target.value))} className="w-full border rounded-lg p-2.5 text-black" min="1" required />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                         <div>
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data e Ora Inizio</label>
                             <input type="datetime-local" value={newStartDatetime} onChange={(e) => setNewStartDatetime(e.target.value)} className="w-full border rounded-lg p-2.5 text-black text-sm" required />
                         </div>
                         <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data e Ora Fine</label>
                             <input type="datetime-local" value={newEndDatetime} onChange={(e) => setNewEndDatetime(e.target.value)} className="w-full border rounded-lg p-2.5 text-black text-sm" required />
                         </div>
                     </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition">Crea Promozione</button>
                </form>
            )}

            {/* FORM MODIFICA */}
            {isEditing && (
                <form onSubmit={handleUpdatePromotion} className="p-5 bg-amber-50 rounded-xl border border-amber-200 shadow-sm animate-fade-in mb-6">
                    <h4 className="text-lg font-bold mb-4 text-amber-900">Modifica Promozione</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg p-2.5 text-black" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stato</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-lg p-2.5 text-black bg-white">
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="DRAFT">DRAFT</option>
                                <option value="CLOSED">CLOSED</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data e Ora Inizio</label>
                            <input
                                type="datetime-local"
                                value={startDatetime}
                                onChange={(e) => setStartDatetime(e.target.value)}
                                className="w-full border rounded-lg p-2.5 text-black text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data e Ora Fine</label>
                            <input
                                type="datetime-local"
                                value={endDatetime}
                                onChange={(e) => setEndDatetime(e.target.value)}
                                className="w-full border rounded-lg p-2.5 text-black text-sm"
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg hover:bg-amber-700 transition">Salva Modifiche</button>
                </form>
            )}
        </div>
    );
}