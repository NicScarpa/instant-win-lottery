'use client';

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { getApiUrl } from '../../../lib/api';

interface Customer {
    id: number;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    totalPlays: number;
    consentMarketing: boolean;
    registeredAt: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function PlayersArchive({ promotionId }: { promotionId: string }) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState(false);

    // Paginazione
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Ricerca
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce per la ricerca
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchCustomers = useCallback(async (page: number, perPage: number, search: string) => {
        if (!promotionId) return;

        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                setError('Token non trovato');
                setLoading(false);
                return;
            }

            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: perPage.toString(),
                ...(search && { search })
            });

            const res = await fetch(getApiUrl(`api/admin/customers/${promotionId}?${queryParams}`), {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
            });

            if (res.ok) {
                const data = await res.json();
                setCustomers(data.customers || []);
                setTotalCustomers(data.total || 0);
            } else {
                const errData = await res.json();
                setError(errData.error || 'Errore nel recupero dei clienti.');
            }
        } catch (err) {
            console.error(err);
            setError('Errore di connessione al server.');
        } finally {
            setLoading(false);
        }
    }, [promotionId]);

    useEffect(() => {
        setCurrentPage(1);
        fetchCustomers(1, itemsPerPage, debouncedSearch);
    }, [promotionId, itemsPerPage, debouncedSearch, fetchCustomers]);

    useEffect(() => {
        if (currentPage > 1) {
            fetchCustomers(currentPage, itemsPerPage, debouncedSearch);
        }
    }, [currentPage, itemsPerPage, debouncedSearch, fetchCustomers]);

    const totalPages = Math.max(1, Math.ceil(totalCustomers / itemsPerPage));

    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(prev => prev - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
    };

    const handlePageSizeChange = (newSize: number) => {
        setItemsPerPage(newSize);
        setCurrentPage(1);
    };

    const handleExportCSV = async () => {
        setExporting(true);
        try {
            const token = localStorage.getItem('admin_token');
            if (!token) return;

            const res = await fetch(getApiUrl(`api/admin/customers/${promotionId}/export`), {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `archivio_giocatori_promo_${promotionId}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Errore export:', err);
        } finally {
            setExporting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 rounded-xl">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">Archivio Giocatori</h3>
                        <p className="text-sm text-gray-500">{totalCustomers} giocatori registrati</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 sm:flex-none">
                        <input
                            type="text"
                            placeholder="Cerca per nome o telefono..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={handleExportCSV}
                        disabled={exporting || totalCustomers === 0}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm ${
                            exporting || totalCustomers === 0
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                    >
                        {exporting ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Esportazione...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Esporta CSV
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error/Loading States */}
            {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

            {loading ? (
                <div className="text-gray-400 text-sm animate-pulse py-8 text-center">Caricamento...</div>
            ) : customers.length === 0 ? (
                <div className="py-12 text-center">
                    <div className="text-gray-300 text-5xl mb-3">👥</div>
                    <p className="text-gray-500">Nessun giocatore registrato</p>
                    <p className="text-gray-400 text-sm mt-1">I giocatori appariranno qui dopo la registrazione</p>
                </div>
            ) : (
                <>
                    {/* Table */}
                    <div className="overflow-x-auto border border-gray-200 rounded-xl">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nome</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cognome</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Telefono</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Giocate</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Marketing</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Registrato il</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {customers.map((customer) => (
                                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {customer.firstName}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                            {customer.lastName}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                                            {customer.phoneNumber}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                            <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-semibold">
                                                {customer.totalPlays}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                                            {customer.consentMarketing ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                                    Sì
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-semibold">
                                                    No
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(customer.registeredAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-4 border-t border-gray-100 gap-4">
                        <div className="flex items-center gap-3">
                            <label className="text-xs text-gray-500">Righe:</label>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                {PAGE_SIZE_OPTIONS.map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={handlePrev}
                                disabled={currentPage === 1}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                                    currentPage === 1
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                ← Indietro
                            </button>

                            <span className="text-xs text-gray-400">
                                Pagina {currentPage} di {totalPages}
                            </span>

                            <button
                                onClick={handleNext}
                                disabled={currentPage === totalPages}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                                    currentPage === totalPages
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                Avanti →
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
