'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'react-qr-code'; 
import confetti from 'canvas-confetti'; 
import LegalModal from '../components/LegalModal';
import LiveLeaderboard from './components/LiveLeaderboard';
import { LEGAL_TEXTS } from '../lib/legalData';
import { getApiUrl } from '../lib/api'; // <--- MODIFICA 1: Import aggiunto

// --- COSTANTI DI STILE CAMPARI ---
const CAMPARI_RED = '#E3001B';

// const API_URL = ... <--- MODIFICA 2: Rimossa costante locale

type GameState = 'LOADING' | 'REGISTER' | 'READY' | 'PLAYING' | 'RESULT' | 'ERROR';

interface PlayResult {
    win: boolean;
    prize: any;
    assignment: any;
    leaderboard: any[];
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
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [finalResult, setFinalResult] = useState<PlayResult | null>(null);

    // Form
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [customerId, setCustomerId] = useState(''); 

    // Privacy
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptMarketing, setAcceptMarketing] = useState(false);
    
    // Modali
    const [modalOpen, setModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', text: '' });

    // --- LOGICHE ---
    const registerUser = async (fName: string, lName: string, ph: string, promoId: string, saveLocal: boolean, marketing: boolean) => {
        try {
            // MODIFICA 3: Uso getApiUrl
            const res = await fetch(getApiUrl('api/customer/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    promotion_id: promoId,
                    phone: ph,
                    first_name: fName,
                    last_name: lName,
                    marketing_consent: marketing 
                })
            });
            const data = await res.json();
            if (res.ok) {
                setCustomerId(data.id);
                setGameState('READY');
                if (saveLocal) {
                    localStorage.setItem('campari_user', JSON.stringify({ firstName: fName, lastName: lName, phone: ph }));
                }
            } else {
                alert('Errore registrazione: ' + (data.error || 'Dati non validi'));
            }
        } catch (err) { alert('Errore di connessione.'); }
    };

    useEffect(() => {
        if (!token) { setGameState('ERROR'); setErrorMessage('Codice QR mancante.'); return; }
        const validateToken = async () => {
            try {
                // MODIFICA 4: Uso getApiUrl con query string
                const res = await fetch(getApiUrl(`api/customer/token/validate?token=${token}`));
                const data = await res.json();
                if (!data.valid) { setGameState('ERROR'); setErrorMessage(data.reason); return; }
                setPromotionId(data.promotion.id);
                const savedUser = localStorage.getItem('campari_user');
                if (savedUser) {
                    const user = JSON.parse(savedUser);
                    setFirstName(user.firstName);
                    setLastName(user.lastName);
                    setPhone(user.phone);
                    await registerUser(user.firstName, user.lastName, user.phone, data.promotion.id, false, false);
                } else { setGameState('REGISTER'); }
            } catch (err) { setGameState('ERROR'); setErrorMessage('Errore connessione.'); }
        };
        validateToken();
    }, [token]);

    const handleRegistrationSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!acceptTerms) { alert('Accetta il regolamento.'); return; }
        registerUser(firstName, lastName, phone, promotionId, true, acceptMarketing);
    };

    const handlePlay = async () => {
        setGameState('PLAYING');
        await new Promise(r => setTimeout(r, 2000));

        try {
            // MODIFICA 5: Uso getApiUrl
            const res = await fetch(getApiUrl('api/customer/play'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ promotion_id: promotionId, token_code: token, customer_id: customerId })
            });
            const data: any = await res.json(); 
            if (res.ok) {
                const finalData: PlayResult = data;
                setPrize(finalData.assignment);
                setLeaderboard(finalData.leaderboard || []);
                setFinalResult(finalData); 
                setGameState('RESULT');
                if (finalData.win) {
                    confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#E3001B', '#FFFFFF'] });
                }
            } else { setGameState('ERROR'); setErrorMessage(data.error); }
        } catch (err) { setGameState('ERROR'); setErrorMessage("Errore di rete."); }
    };

    const openLegal = (type: 'privacy' | 'terms') => {
        if (type === 'privacy') setModalContent({ title: 'Informativa Privacy', text: LEGAL_TEXTS.privacy });
        if (type === 'terms') setModalContent({ title: 'Regolamento', text: LEGAL_TEXTS.terms });
        setModalOpen(true);
    };

    // --- DESIGN SYSTEM CAMPARI ---
    
    // Sfondo Rosso con bottiglietta ripetuta
    const bgStyle = {
        backgroundColor: CAMPARI_RED,
        // Assicura che bottiglia.png sia in public/
        backgroundImage: `url('/bottiglia.png')`,
        backgroundSize: '80px', // Dimensione bottiglietta
        backgroundRepeat: 'repeat',
        backgroundBlendMode: 'soft-light', // Fonde l'immagine col rosso
    };

    return (
        <div style={bgStyle} className="min-h-screen font-sans text-white pb-12 flex flex-col items-center overflow-x-hidden">
            <LegalModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalContent.title} content={modalContent.text} />

            {/* HEADER LOGO */}
            <header className="pt-8 pb-4 z-10 w-full max-w-xs mx-auto">
                <img 
                    src="/camparisoda.png" 
                    alt="Campari Soda" 
                    className="w-48 mx-auto drop-shadow-md"
                    onError={(e) => e.currentTarget.style.display = 'none'} 
                />
            </header>

            <main className="flex-grow w-full max-w-md px-6 flex flex-col justify-center relative z-10">
                
                {/* 1. REGISTRAZIONE */}
                {gameState === 'REGISTER' && (
                    <div className="animate-fade-in bg-white text-black p-8 rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <h2 className="text-3xl font-bold mb-6 uppercase text-center tracking-tighter">Unisciti<br/>al Rito</h2>
                        <form onSubmit={handleRegistrationSubmit} className="space-y-5">
                            <div className="space-y-4">
                                <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border-b-2 border-black bg-gray-50 p-3 font-bold focus:outline-none focus:bg-red-50" placeholder="NOME" />
                                <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border-b-2 border-black bg-gray-50 p-3 font-bold focus:outline-none focus:bg-red-50" placeholder="COGNOME" />
                                <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full border-b-2 border-black bg-gray-50 p-3 font-bold focus:outline-none focus:bg-red-50" placeholder="CELLULARE" />
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
                        </form>
                    </div>
                )}

                {/* 2. READY */}
                {gameState === 'READY' && (
                    <div className="text-center animate-fade-in bg-white p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,0.5)]">
                        <div className="w-24 h-24 bg-[#E3001B] rounded-full mx-auto mb-6 flex items-center justify-center text-5xl shadow-inner border-4 border-black">
                            🎲
                        </div>
                        
                        <h2 className="text-4xl font-bold uppercase tracking-tighter text-black mb-2 leading-none">CIAO<br/>{firstName}!</h2>
                        <p className="text-gray-600 font-bold mb-8 uppercase text-sm tracking-widest">Il tuo momento è adesso.</p>
                        
                        <button 
                            onClick={handlePlay} 
                            className="w-full bg-[#E3001B] text-white text-2xl font-bold py-5 border-4 border-black hover:bg-black hover:text-white transition-all uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                        >
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
                            <div className="bg-white text-black border-4 border-black p-6 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.3)] mb-8 relative">
                                <h2 className="text-5xl font-bold uppercase tracking-tighter mb-2 text-[#E3001B]">VINTO!</h2>
                                <p className="text-xl font-bold uppercase border-b-4 border-black inline-block pb-1 mb-6">
                                    {prize.prize_type?.name}
                                </p>
                                
                                <div className="bg-black p-4 mb-4 inline-block mx-auto border-4 border-black">
                                    <div className="bg-white p-2">
                                        <QRCode value={prize.prize_code} size={160} fgColor="#000000" />
                                    </div>
                                    <p className="text-white font-mono font-bold text-xl tracking-widest mt-3 uppercase border-2 border-white px-2">
                                        {prize.prize_code}
                                    </p>
                                </div>
                                <p className="text-xs font-bold uppercase text-gray-500">Mostra al banco per ritirare</p>
                            </div>
                        ) : (
                            // LOSE
                            <div className="bg-black text-white border-4 border-white p-8 text-center shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)] mb-8">
                                <h2 className="text-4xl font-bold uppercase tracking-tighter mb-4 text-[#E3001B]">PECCATO!</h2>
                                <p className="font-bold text-lg mb-6 leading-relaxed uppercase">
                                    Niente gadget questa volta.<br/>
                                    Ma un Campari Soda<br/>è sempre una vittoria.
                                </p>
                                <div className="inline-block border-2 border-white px-4 py-2 text-xs font-bold uppercase tracking-widest">
                                    Ritenta col prossimo
                                </div>
                            </div>
                        )}

                        {/* CLASSIFICA */}
                        <div className="bg-white text-black p-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="text-center font-bold uppercase border-b-2 border-black pb-2 mb-2 tracking-widest">Classifica Live</h3>
                            <LiveLeaderboard entries={leaderboard} currentUserPhone={phone} />
                            
                            {finalResult && (
                                <div className="mt-4 pt-2 border-t-2 border-black text-center bg-yellow-50 p-2">
                                    <p className="uppercase font-bold text-sm">
                                        TU: <span className="text-[#E3001B] text-lg">POS. {finalResult.userRank}</span>
                                    </p>
                                    <p className="text-xs font-mono text-gray-500">Giocate totali: {finalResult.userTotalPlays}</p>
                                </div>
                            )}
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