'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';
import { getApiUrl } from '../lib/api'; // <--- MODIFICA: Import getApiUrl

// RIMOZIONE: Rimosso API_URL locale, usiamo solo getApiUrl

type ScanStatus = 'IDLE' | 'SCANNING' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'WARNING';

interface ScanResult {
    prizeType?: string;
    redeemedAt?: string;
    redeemedBy?: string;
    error?: string;
}

export default function StaffPage() {
    const router = useRouter();
    const [status, setStatus] = useState<ScanStatus>('SCANNING');
    const [resultMessage, setResultMessage] = useState('');
    const [resultDetails, setResultDetails] = useState<ScanResult | null>(null);
    const [manualCode, setManualCode] = useState('');

    // 1. Check Sessione (Staff/Admin)
    useEffect(() => {
        const checkSession = async () => {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                router.push('/admin/login');
                return;
            }

            try {
                const res = await fetch(getApiUrl('api/auth/me'), {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    credentials: 'include'
                });

                if (!res.ok) {
                    localStorage.removeItem('admin_token');
                    router.push('/admin/login');
                }
            } catch (err) {
                console.error("Connection error during session check:", err);
                // Non reindirizziamo in caso di errore di rete temporaneo
            }
        };

        checkSession();
    }, [router]);

    // 2. Gestione Scansione QR
    const handleScan = async (rawResult: unknown) => {
        if (!rawResult || status !== 'SCANNING') return;

        // La libreria può ritornare un array o un oggetto singolo, normalizziamo
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const code = Array.isArray(rawResult) ? (rawResult[0] as any)?.rawValue : (rawResult as any)?.rawValue;
        if (!code) return;

        processCode(code);
    };

    // 3. Gestione Input Manuale
    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCode.trim().length > 0) {
            processCode(manualCode.trim());
        }
    };

    // 4. Logica di Riscatto (Chiamata Backend)
    const processCode = async (code: string) => {
        setStatus('PROCESSING');
        setResultMessage('');
        setResultDetails(null);

        const token = localStorage.getItem('admin_token');
        if (!token) {
            setStatus('ERROR');
            setResultMessage('Sessione scaduta. Effettua nuovamente il login.');
            return;
        }

        try {
            const res = await fetch(getApiUrl('api/staff/redeem'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // FIX: Aggiunto Authorization header
                },
                credentials: 'include',
                body: JSON.stringify({ prizeCode: code })
            });

            const data = await res.json();

            if (res.ok) {
                // SUCCESSO: Premio valido e bruciato ora
                setStatus('SUCCESS');
                setResultDetails(data);
            } else {
                // ERRORE o GIÀ RITIRATO (Assumiamo che il backend dia dettagli sul 400)
                if (res.status === 400 && data.redeemedAt) {
                    setStatus('WARNING'); // Già ritirato
                    setResultDetails(data);
                } else {
                    setStatus('ERROR'); // Codice non valido o altro errore
                    setResultMessage(data.error || 'Codice non valido');
                }
            }
        } catch (error) {
            setStatus('ERROR');
            setResultMessage('Errore di connessione al server.');
            console.error(error);
        }
    };

    const resetScanner = () => {
        setStatus('SCANNING');
        setResultMessage('');
        setResultDetails(null);
        setManualCode('');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
            {/* Header */}
            <header className="p-4 bg-gray-800 flex justify-between items-center shadow-md z-10">
                <h1 className="font-bold text-lg text-red-500 tracking-wider">STAFF AREA</h1>
                <button onClick={() => router.push('/admin/dashboard')} className="text-xs text-gray-400 border border-gray-600 px-3 py-1 rounded">
                    Dashboard
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex flex-col items-center justify-start p-4 relative">

                {/* MODALITÀ SCANSIONE */}
                {(status === 'SCANNING' || status === 'PROCESSING' || status === 'IDLE') && (
                    <div className="w-full max-w-md space-y-6">
                        <div className="text-center mb-2">
                            <p className="text-gray-300 text-sm">Inquadra il QR Code del cliente</p>
                        </div>

                        <div className="relative overflow-hidden rounded-xl border-2 border-red-500 shadow-2xl bg-black aspect-square">
                            {/* Mostra Scanner solo in stato 'SCANNING' */}
                            {status === 'SCANNING' && (
                                <Scanner
                                    onScan={handleScan}
                                    styles={{ container: { width: '100%', height: '100%' } }}
                                    components={{ finder: false }}
                                />
                            )}

                            {/* Stato di Processing */}
                            {status === 'PROCESSING' && (
                                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                                    <div className="animate-spin w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full"></div>
                                </div>
                            )}

                            {/* Overlay grafico mirino */}
                            <div className="absolute inset-0 border-[40px] border-black/50 flex items-center justify-center pointer-events-none">
                                <div className="w-64 h-64 border-4 border-red-500/50 rounded-lg"></div>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="text-gray-500 text-xs mb-2">- OPPURE -</p>
                            <form onSubmit={handleManualSubmit} className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                    placeholder="Inserisci codice manuale"
                                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-center font-mono tracking-widest text-white focus:ring-2 focus:ring-red-500 outline-none"
                                />
                                <button type="submit" className="bg-gray-700 px-4 rounded-lg font-bold">OK</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* SCHERMATA SUCCESSO (VERDE) */}
                {status === 'SUCCESS' && (
                    <div className="absolute inset-0 bg-green-600 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl">
                            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h2 className="text-4xl font-bold mb-2">PREMIO VALIDO!</h2>
                        <p className="text-green-100 text-lg mb-8">Consegna al cliente:</p>

                        <div className="bg-white text-green-900 p-6 rounded-xl shadow-lg w-full max-w-sm mb-8">
                            <h3 className="text-2xl font-bold break-words">{resultDetails?.prizeType}</h3>
                            <p className="text-sm text-gray-500 mt-2">Ritirato il: {resultDetails?.redeemedAt ? new Date(resultDetails.redeemedAt).toLocaleString() : 'Ora'}</p>
                        </div>

                        <button onClick={resetScanner} className="bg-green-800 text-white px-10 py-4 rounded-full font-bold text-xl shadow-lg hover:bg-green-900 transition">
                            Prossima Scansione
                        </button>
                    </div>
                )}

                {/* SCHERMATA GIÀ RITIRATO (GIALLO/ARANCIO) */}
                {status === 'WARNING' && (
                    <div className="absolute inset-0 bg-yellow-500 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl">
                            <span className="text-5xl">⚠️</span>
                        </div>
                        <h2 className="text-3xl font-bold mb-2 text-white shadow-sm">GIÀ RITIRATO</h2>
                        <p className="text-yellow-100 font-medium mb-8">Questo premio è già stato consegnato.</p>

                        <div className="bg-white/90 text-yellow-900 p-6 rounded-xl shadow-lg w-full max-w-sm mb-8 text-left text-sm">
                            <p><strong>Premio:</strong> {resultDetails?.prizeType}</p>
                            <p><strong>Data Ritiro:</strong> {resultDetails?.redeemedAt ? new Date(resultDetails.redeemedAt).toLocaleString() : 'N/D'}</p>
                            <p><strong>Staff:</strong> {resultDetails?.redeemedBy || 'N/D'}</p>
                        </div>

                        <button onClick={resetScanner} className="bg-white text-yellow-600 px-10 py-4 rounded-full font-bold text-xl shadow-lg">
                            Torna allo Scanner
                        </button>
                    </div>
                )}

                {/* SCHERMATA ERRORE (ROSSO) */}
                {status === 'ERROR' && (
                    <div className="absolute inset-0 bg-red-600 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl">
                            <span className="text-5xl">❌</span>
                        </div>
                        <h2 className="text-3xl font-bold mb-4 text-white">ERRORE</h2>
                        <p className="text-red-100 text-xl mb-8">{resultMessage}</p>

                        <button onClick={resetScanner} className="bg-white text-red-600 px-10 py-4 rounded-full font-bold text-xl shadow-lg">
                            Riprova
                        </button>
                    </div>
                )}

            </main>
        </div>
    );
}