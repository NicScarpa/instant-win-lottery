'use client';

import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../../lib/api'; // <--- IMPORTAZIONE CHIAVE

interface LeaderboardEntry {
    rank: number;
    name: string;
    phone: string;
    plays: number;
    isMe: boolean;
}

interface LiveLeaderboardData {
    leaderboard: LeaderboardEntry[];
    myStats: {
        rank: number;
        plays: number;
    } | null;
}

interface Props {
    promotionId: number;
    currentCustomerId: number; // Ora lo prendiamo dal padre
}

export default function LiveLeaderboard({ promotionId, currentCustomerId }: Props) {
    const [data, setData] = useState<LiveLeaderboardData | null>(null);

    // Effettua la chiamata API per recuperare la classifica
    useEffect(() => {
        if (promotionId && currentCustomerId) {
            // USO getApiUrl QUI per il live fetching
            fetch(getApiUrl(`api/leaderboard/${promotionId}?customerId=${currentCustomerId}`))
                .then(res => res.json())
                .then(setData)
                .catch(console.error);
        }
    }, [promotionId, currentCustomerId]);

    if (!data) {
        return <div className="text-center text-gray-400 py-4 italic text-xs uppercase tracking-widest">Caricamento Classifica...</div>;
    }

    if (data.leaderboard.length === 0) {
        return <div className="text-center text-gray-400 py-4 italic text-xs uppercase tracking-widest">Nessuna giocata registrata</div>;
    }

    // --- DESIGN COMPONENTE ---
    
    return (
        <div className="w-full">
            {/* Intestazione Tabella */}
            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 mb-2 border-b-2 border-gray-200 pb-1 tracking-widest">
                <span>Pos / Giocatore</span>
                <span>Giocate</span>
            </div>

            <ul className="space-y-1">
                {data.leaderboard.map((entry, idx) => {
                    const isMe = entry.isMe;
                    const rank = entry.rank;
                    const CAMPARI_RED = '#E3001B';

                    return (
                        <li 
                            key={idx} 
                            className={`flex justify-between items-center p-3 border-2 transition-all ${
                                isMe 
                                ? 'bg-black text-white border-black transform scale-[1.02] shadow-lg z-10' 
                                : 'bg-white text-gray-800 border-gray-200'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                {/* Badge Posizione */}
                                <div className={`w-6 h-6 flex items-center justify-center font-black text-xs ${
                                    rank === 1 ? `bg-[${CAMPARI_RED}] text-white` : 
                                    rank === 2 ? 'bg-gray-400 text-white' : 
                                    rank === 3 ? 'bg-orange-400 text-white' : 
                                    'bg-transparent text-gray-400'
                                }`}>
                                    {rank}
                                </div>
                                
                                <div className="flex flex-col leading-none">
                                    <span className="font-bold uppercase text-sm tracking-tight">
                                        {entry.name}
                                        {isMe && <span className="ml-2 text-[9px] bg-[#E3001B] text-white px-1 py-0.5 align-top">TU</span>}
                                    </span>
                                    {/* Numero mascherato */}
                                    <span className={`text-[10px] font-mono mt-0.5 ${isMe ? 'text-gray-400' : 'text-gray-400'}`}>
                                        {entry.phone}
                                    </span>
                                </div>
                            </div>

                            <div className="font-black text-xl tracking-tighter">
                                {entry.plays}
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* Posizione dell'utente corrente se non è nella Top N */}
            {data.myStats && !data.leaderboard.some(e => e.isMe) && (
                <div className="mt-4 pt-2 border-t-2 border-black text-center bg-yellow-50 p-2">
                    <p className="uppercase font-bold text-sm">
                        TU: <span className="text-[#E3001B] text-lg">POS. {data.myStats.rank}</span>
                    </p>
                    <p className="text-xs font-mono text-gray-500">Giocate totali: {data.myStats.plays}</p>
                </div>
            )}
        </div>
    );
}