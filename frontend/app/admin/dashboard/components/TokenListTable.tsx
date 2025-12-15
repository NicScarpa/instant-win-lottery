'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { getApiUrl } from '../../../lib/api';

interface TokenData {
    id: string;
    token_code: string;
    status: string;
    promotion_id: string;
    usedAt?: string | null;
}

export default function TokenListTable({ promotionId }: { promotionId: string }) {
    const [tokens, setTokens] = useState<TokenData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // STATI PER LA PAGINAZIONE
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (!promotionId) return;

        const fetchTokens = async () => {
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem('admin_token');
                if (!token) {
                    setError('Token non trovato');
                    setLoading(false);
                    return;
                }

                const res = await fetch(getApiUrl(`api/admin/tokens/${promotionId}`), {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                });

                if (res.ok) {
                    const data = await res.json();
                    setTokens(data.tokens || []); // Backend restituisce { tokens, total }
                    setCurrentPage(1); // Reset alla prima pagina quando i dati cambiano
                } else {
                    const errData = await res.json();
                    setError(errData.error || 'Errore nel recupero della lista token.');
                }
            } catch (err) {
                console.error(err);
                setError('Errore di connessione al server.');
            } finally {
                setLoading(false);
            }
        };

        fetchTokens();
    }, [promotionId]);

    // CALCOLI PAGINAZIONE
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTokens = tokens.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(tokens.length / itemsPerPage);

    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(prev => prev - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
    };

    if (loading) return <div className="text-gray-500 text-sm mt-4">Caricamento lista token in corso...</div>;
    if (error) return <div className="text-red-500 text-sm mt-4">{error}</div>;

    return (
        <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                    Token Generati <span className="text-sm font-normal text-gray-500">({tokens.length} totali)</span>
                </h3>
                {tokens.length > 0 && (
                    <span className="text-xs text-gray-400">
                        Pagina {currentPage} di {totalPages}
                    </span>
                )}
            </div>
            
            {tokens.length === 0 ? (
                <p className="text-gray-500 text-sm italic">Nessun token generato per questa promozione.</p>
            ) : (
                <>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Codice</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Utilizzo</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {currentTokens.map((token) => (
                                    <tr key={token.id} className="hover:bg-gray-50 transition">
                                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono font-medium text-gray-700">
                                            {token.token_code}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                token.status === 'AVAILABLE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                {token.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                            {token.usedAt 
                                                ? new Date(token.usedAt).toLocaleString() 
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* CONTROLLI PAGINAZIONE */}
                    {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-4 pt-2 border-t border-gray-100">
                            <button 
                                onClick={handlePrev} 
                                disabled={currentPage === 1}
                                className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
                                    currentPage === 1 
                                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed' 
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                ← Indietro
                            </button>
                            
                            <span className="text-sm text-gray-600">
                                Pagina <b>{currentPage}</b> di <b>{totalPages}</b>
                            </span>

                            <button 
                                onClick={handleNext} 
                                disabled={currentPage === totalPages}
                                className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
                                    currentPage === totalPages
                                    ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed' 
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                Avanti →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}