'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'react-qr-code';
import confetti from 'canvas-confetti';
import LegalModal from '../components/LegalModal';
import LiveLeaderboard from './components/LiveLeaderboard';
import { LEGAL_TEXTS } from '../lib/legalData';
import { getApiUrl } from '../lib/api';

// --- COSTANTI DI STILE CAMPARI ---
const CAMPARI_RED = '#E3001B';

type GameState = 'LOADING' | 'PHONE_INPUT' | 'NAME_INPUT' | 'READY' | 'PLAYING' | 'RESULT' | 'ERROR';

interface PlayResult {
    win: boolean;
    prize: any;
    assignment: any;
    // leaderboard: any[]; // Non serve più qui, lo gestisce il componente
    userRank: number;
    userTotalPlays: number;
}

function PlayContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    // Stati
    const [gameState, setGameState] = useState<GameState>('LOADING');
    const [errorMessage, setErrorMessage] = useState('');

    // Dati
    const [promotionId, setPromotionId] = useState('');
    const [prize, setPrize] = useState<any>(null);
    // const [leaderboard, setLeaderboard] = useState<any[]>([]); // Rimosso
    // const [finalResult, setFinalResult] = useState<PlayResult | null>(null); // Rimosso uso diretto

    // Form
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [customerId, setCustomerId] = useState('');

    // Utente esistente (per flusso "Bentornato")
    const [existingUser, setExistingUser] = useState<{ firstName: string; lastName: string } | null>(null);

    // Privacy
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptMarketing, setAcceptMarketing] = useState(false);

    // Modali
    const [modalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', text: '' });

    // --- LOGICHE ---

    // Funzione per verificare se il telefono è già registrato
    const checkPhone = useCallback(async (phoneNumber: string) => {
        if (!phoneNumber.trim()) {
            alert('Inserisci un numero di telefono valido.');
            return;
        }

        try {
            const res = await fetch(getApiUrl('api/customer/check-phone'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promotionId, phoneNumber: phoneNumber.trim() })
            });
            const data = await res.json();

            if (data.exists) {
                // Utente esistente: pre-compila i campi
                setExistingUser({ firstName: data.firstName, lastName: data.lastName });
                setFirstName(data.firstName);
                setLastName(data.lastName);
            } else {
                // Nuovo utente: reset dei campi
                setExistingUser(null);
                setFirstName('');
                setLastName('');
            }
            setGameState('NAME_INPUT');
        } catch (err) {
            console.error('Errore check-phone:', err);
            alert('Errore di connessione. Riprova.');
        }
    }, [promotionId]);

    const registerUser = useCallback(async (fName: string, lName: string, ph: string, promoId: string, saveLocal: boolean, marketing: boolean) => {
        try {
            const res = await fetch(getApiUrl('api/customer/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    promotionId: promoId,
                    firstName: fName,
                    lastName: lName,
                    phoneNumber: ph,
                    consentMarketing: marketing,
                    consentTerms: true
                })
            });
            const data = await res.json();
            if (res.ok) {
                setCustomerId(data.customerId);

                // Salva il JWT token per le richieste successive
                if (data.token) {
                    localStorage.setItem('customer_token', data.token);
                }

                setGameState('READY');
                if (saveLocal) {
                    localStorage.setItem('campari_user', JSON.stringify({ firstName: fName, lastName: lName, phone: ph }));
                }
            } else {
                alert('Errore registrazione: ' + (data.error || 'Dati non validi'));
            }
        } catch (err) { alert('Errore di connessione.'); }
    }, []);

    useEffect(() => {
        let mounted = true;

        const validateToken = async () => {
            if (!token) {
                if (mounted) {
                    setGameState('ERROR');
                    setErrorMessage('Codice QR mancante.');
                }
                return;
            }

            try {
                const res = await fetch(getApiUrl(`api/customer/validate-token/${token}`));
                const data = await res.json();

                if (!mounted) return;

                if (!data.valid) {
                    setGameState('ERROR');
                    setErrorMessage(data.message);
                    return;
                }

                setPromotionId(data.promotionId);

                // NUOVO FLUSSO: Sempre partire da PHONE_INPUT
                // Se c'è un utente salvato, pre-compiliamo solo il telefono
                const savedUser = localStorage.getItem('campari_user');
                if (savedUser) {
                    try {
                        const user = JSON.parse(savedUser);
                        // Pre-compila solo il telefono, l'utente lo confermerà
                        setPhone(user.phone || '');
                    } catch (error) {
                        // JSON corrotto, rimuovi
                        localStorage.removeItem('campari_user');
                    }
                }
                // Vai sempre a PHONE_INPUT come primo step
                setGameState('PHONE_INPUT');
            } catch (err) {
                if (mounted) {
                    setGameState('ERROR');
                    setErrorMessage('Errore connessione.');
                }
            }
        };

        validateToken();

        return () => { mounted = false; };
    }, [token]);

    const handleRegistrationSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!acceptTerms) { alert('Accetta il regolamento.'); return; }
        registerUser(firstName, lastName, phone, promotionId, true, acceptMarketing);
    };

    const handlePlay = async () => {
        setGameState('PLAYING');
        // Piccolo delay per suspence
        await new Promise(r => setTimeout(r, 1500));

        try {
            // Recupera il JWT token dal localStorage
            const customerToken = localStorage.getItem('customer_token');

            if (!customerToken) {
                setGameState('ERROR');
                setErrorMessage('Sessione scaduta. Registrati di nuovo.');
                return;
            }

            interface PlayResponse {
                isWinner: boolean;
                prizeAssignment: any; // Keeping any on assignment for now as structure depends on backend, but defining top level
                error?: string;
            }

            const res = await fetch(getApiUrl('api/customer/play'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${customerToken}` // NUOVO: Invia JWT token
                },
                credentials: 'include', // Invia anche i cookie
                body: JSON.stringify({
                    promotion_id: Number(promotionId),
                    token_code: token
                    // RIMOSSO: customer_id (viene preso dal JWT token dal backend)
                })
            });
            const data: PlayResponse = await res.json();

            if (res.ok) {
                // data contiene { isWinner, prizeAssignment }
                if (data.isWinner) {
                    setPrize(data.prizeAssignment);
                    confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#E3001B', '#FFFFFF'] });
                } else {
                    setPrize(null);
                }
                setGameState('RESULT');
            } else {
                setGameState('ERROR');
                setErrorMessage(data.error || 'Errore di gioco');
            }
        } catch (err) { setGameState('ERROR'); setErrorMessage("Errore di rete."); }
    };

    const openLegal = (type: 'privacy' | 'terms') => {
        if (type === 'privacy') setModalContent({ title: 'Informativa Privacy', text: LEGAL_TEXTS.privacy });
        if (type === 'terms') setModalContent({ title: 'Regolamento', text: LEGAL_TEXTS.terms });
        setModalOpen(true);
    };

    // --- DESIGN SYSTEM ---
    const bgStyle = {
        backgroundColor: CAMPARI_RED,
        backgroundImage: `url('/bottiglia.png')`,
        backgroundSize: '80px',
        backgroundRepeat: 'repeat',
        backgroundBlendMode: 'soft-light',
    };

    return (
        <div style={bgStyle} className="min-h-screen font-sans text-white pb-12 flex flex-col items-center overflow-x-hidden">
            <LegalModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalContent.title} content={modalContent.text} />

            {/* HEADER */}
            <header className="pt-8 pb-4 z-10 w-full max-w-xs mx-auto">
                <img
                    src="/camparisoda.png"
                    alt="Campari Soda"
                    className="w-48 mx-auto drop-shadow-md"
                    onError={(e) => e.currentTarget.style.display = 'none'}
                />
            </header>

            <main className="flex-grow w-full max-w-md px-6 flex flex-col justify-center relative z-10">

                {/* STEP 1: INSERIMENTO TELEFONO */}
                {gameState === 'PHONE_INPUT' && (
                    <div className="animate-fade-in bg-white text-black p-8 rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h2 className="text-3xl font-bold mb-2 uppercase text-center tracking-tighter">Unisciti<br />al Rito</h2>
                        <p className="text-gray-500 text-center text-sm mb-6 font-medium">Inserisci il tuo numero di cellulare</p>
                        <div className="space-y-5">
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full border-b-2 border-black bg-gray-50 p-4 font-bold text-xl text-center focus:outline-none focus:bg-red-50 tracking-wider"
                                placeholder="ES: 3401234567"
                                autoFocus
                            />
                            <button
                                onClick={() => checkPhone(phone)}
                                disabled={!phone.trim()}
                                className="w-full bg-black text-white font-bold text-xl py-4 hover:bg-[#E3001B] hover:text-white transition-colors uppercase tracking-widest border-2 border-transparent hover:border-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                                CONTINUA
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: NOME E COGNOME */}
                {gameState === 'NAME_INPUT' && (
                    <div className="animate-fade-in bg-white text-black p-8 rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        {existingUser ? (
                            // UTENTE GIÀ REGISTRATO
                            <>
                                <div className="text-center mb-6">
                                    <span className="text-5xl">👋</span>
                                    <h2 className="text-3xl font-bold uppercase tracking-tighter mt-2">Bentornato!</h2>
                                    <p className="text-gray-500 text-sm font-medium mt-1">Conferma i tuoi dati per continuare</p>
                                </div>
                                <form onSubmit={handleRegistrationSubmit} className="space-y-5">
                                    <div className="space-y-4">
                                        <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border-b-2 border-black bg-gray-50 p-3 font-bold focus:outline-none focus:bg-red-50" placeholder="NOME" />
                                        <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border-b-2 border-black bg-gray-50 p-3 font-bold focus:outline-none focus:bg-red-50" placeholder="COGNOME" />
                                    </div>
                                    <div className="space-y-3 text-sm font-bold">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input type="checkbox" required checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-1 w-5 h-5 accent-black" />
                                            <span>Accetto <button type="button" onClick={() => openLegal('terms')} className="underline">Regolamento</button> e <button type="button" onClick={() => openLegal('privacy')} className="underline">Privacy</button></span>
                                        </label>
                                    </div>
                                    <button type="submit" className="w-full bg-[#E3001B] text-white font-bold text-xl py-4 hover:bg-black hover:text-white transition-colors uppercase tracking-widest border-2 border-transparent hover:border-white">
                                        GIOCA
                                    </button>
                                    <button type="button" onClick={() => { setExistingUser(null); setGameState('PHONE_INPUT'); }} className="w-full text-gray-400 text-xs underline">
                                        Non sono io, cambia numero
                                    </button>
                                </form>
                            </>
                        ) : (
                            // NUOVO UTENTE
                            <>
                                <h2 className="text-3xl font-bold mb-2 uppercase text-center tracking-tighter">Come ti chiami?</h2>
                                <p className="text-gray-500 text-center text-sm mb-6 font-medium">Completa la registrazione</p>
                                <form onSubmit={handleRegistrationSubmit} className="space-y-5">
                                    <div className="space-y-4">
                                        <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border-b-2 border-black bg-gray-50 p-3 font-bold focus:outline-none focus:bg-red-50" placeholder="NOME" autoFocus />
                                        <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border-b-2 border-black bg-gray-50 p-3 font-bold focus:outline-none focus:bg-red-50" placeholder="COGNOME" />
                                    </div>
                                    <div className="space-y-3 text-sm font-bold">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input type="checkbox" required checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="mt-1 w-5 h-5 accent-black" />
                                            <span>Accetto <button type="button" onClick={() => openLegal('terms')} className="underline">Regolamento</button> e <button type="button" onClick={() => openLegal('privacy')} className="underline">Privacy</button></span>
                                        </label>
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input type="checkbox" checked={acceptMarketing} onChange={e => setAcceptMarketing(e.target.checked)} className="mt-1 w-5 h-5 accent-black" />
                                            <span>Marketing (Opzionale)</span>
                                        </label>
                                    </div>
                                    <button type="submit" className="w-full bg-black text-white font-bold text-xl py-4 hover:bg-[#E3001B] hover:text-white transition-colors uppercase tracking-widest border-2 border-transparent hover:border-white">
                                        AVANTI
                                    </button>
                                    <button type="button" onClick={() => setGameState('PHONE_INPUT')} className="w-full text-gray-400 text-xs underline">
                                        Torna indietro
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                )}

                {/* 2. READY */}
                {gameState === 'READY' && (
                    <div className="text-center animate-fade-in bg-white p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,0.5)]">
                        <div className="w-24 h-24 bg-[#E3001B] rounded-full mx-auto mb-6 flex items-center justify-center text-5xl shadow-inner border-4 border-black">
                            🎲
                        </div>
                        <h2 className="text-4xl font-bold uppercase tracking-tighter text-black mb-2 leading-none">CIAO<br />{firstName}!</h2>
                        <p className="text-gray-600 font-bold mb-8 uppercase text-sm tracking-widest">Il tuo momento è adesso.</p>
                        <button onClick={handlePlay} className="w-full bg-[#E3001B] text-white text-2xl font-bold py-5 border-4 border-black hover:bg-black hover:text-white transition-all uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none">
                            GIOCA ORA
                        </button>
                    </div>
                )}

                {/* 3. LOADING */}
                {(gameState === 'PLAYING' || gameState === 'LOADING') && (
                    <div className="flex flex-col items-center justify-center text-center py-20">
                        <div className="w-28 h-28 border-8 border-white border-t-black rounded-full animate-spin mb-8 shadow-xl"></div>
                        <h3 className="text-3xl font-bold uppercase tracking-tighter animate-pulse drop-shadow-md">Estrazione...</h3>
                    </div>
                )}

                {/* 4. RESULT */}
                {gameState === 'RESULT' && (
                    <div className="animate-fade-in text-center">
                        {prize ? (
                            // WIN
                            <div className="bg-white text-black border-4 border-black p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.3)] mb-8 relative flex flex-col items-center text-center">
                                <h2 className="text-5xl font-bold uppercase tracking-tighter mb-2 text-[#E3001B]">HAI VINTO!</h2>
                                <p className="text-xl font-bold uppercase border-b-4 border-black inline-block pb-1 mb-6">
                                    {prize.prize_type?.name}
                                </p>
                                <div className="bg-black p-4 mb-4 border-4 border-black flex flex-col items-center">
                                    <div className="bg-white p-2">
                                        <QRCode value={prize.prize_code} size={160} fgColor="#000000" />
                                    </div>
                                    <p className="text-white font-mono font-bold text-xl tracking-widest mt-3 uppercase border-2 border-white px-2">
                                        {prize.prize_code}
                                    </p>
                                </div>
                                <p className="text-xs font-bold uppercase text-gray-500 max-w-[250px] leading-tight">
                                    MOSTRA IL CODICE AD UN CAMERIERE PER RITIRARE IL TUO PREMIO
                                </p>
                            </div>
                        ) : (
                            // LOSE
                            <div className="bg-black text-white border-4 border-white p-8 text-center shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] mb-8">
                                <h2 className="text-4xl font-bold uppercase tracking-tighter mb-4 text-[#E3001B]">PECCATO!</h2>
                                <p className="font-bold text-lg mb-6 leading-relaxed uppercase">
                                    Niente gadget questa volta.<br />
                                    Ma un Campari Soda<br />è sempre una vittoria.
                                </p>
                                <div className="inline-block border-2 border-white px-4 py-2 text-xs font-bold uppercase tracking-widest">
                                    Ritenta col prossimo
                                </div>
                            </div>
                        )}

                        {/* CLASSIFICA LIVE */}
                        <div className="bg-white text-black p-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="text-center font-bold uppercase border-b-2 border-black pb-2 mb-2 tracking-widest">Classifica Live</h3>

                            {/* FIX: Uso corretto del componente con le nuove props */}
                            <LiveLeaderboard
                                promotionId={Number(promotionId)}
                                currentCustomerId={Number(customerId)}
                            />
                        </div>
                    </div>
                )}

                {/* ERROR */}
                {gameState === 'ERROR' && (
                    <div className="bg-white text-black p-8 text-center border-4 border-black">
                        <h1 className="text-3xl font-bold mb-4 uppercase">Ops!</h1>
                        <p className="font-bold mb-6">{errorMessage}</p>
                        <button onClick={() => window.location.reload()} className="bg-black text-white px-6 py-3 font-bold uppercase hover:bg-gray-800">Ricarica</button>
                    </div>
                )}

            </main>

            {/* FOOTER */}
            <footer className="text-center text-[10px] text-white/80 py-4 mt-auto uppercase font-bold tracking-widest z-10">
                <div className="space-x-4">
                    <button onClick={() => openLegal('terms')} className="hover:text-white hover:underline">Regolamento</button>
                    <span>•</span>
                    <button onClick={() => openLegal('privacy')} className="hover:text-white hover:underline">Privacy</button>
                </div>
            </footer>
        </div>
    );
}

export default function PlayPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#E3001B] flex items-center justify-center text-white font-bold uppercase">Caricamento...</div>}>
            <PlayContent />
        </Suspense>
    );
}