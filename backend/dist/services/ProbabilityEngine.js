"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.probabilityEngine = exports.ProbabilityEngine = void 0;
const genderDetection_1 = require("../utils/genderDetection");
// Costanti temporali
const ONE_HOUR_MS = 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
/**
 * Calcola il fattore di penalizzazione per giocatori frequenti.
 *
 * REGOLE GIOCATE:
 * - Sotto 5 giocate: nessuna penalita
 * - Dalla 6a giocata: -10%
 * - Ogni giocata successiva: ulteriore -2%
 * - Cap massimo: -50%
 *
 * REGOLE VITTORIE:
 * - 1 vittoria: -20%
 * - 2 vittorie: -40%
 * - 3+ vittorie: -60% (cap)
 *
 * Le penalita si combinano moltiplicativamente.
 * Floor minimo: 10% della probabilita originale.
 */
function calculateFatigueFactor(totalPlays, totalWins) {
    let factor = 1.0;
    // === PENALITA PER GIOCATE FREQUENTI ===
    if (totalPlays >= 6) {
        const extraPlays = totalPlays - 5;
        // Prima extra play = -10%, ogni successiva +2%
        const playPenalty = 0.1 + (extraPlays - 1) * 0.02;
        factor *= 1 - Math.min(playPenalty, 0.5); // Cap -50%
    }
    // === PENALITA PER VITTORIE PRECEDENTI ===
    if (totalWins >= 1) {
        const winPenalty = Math.min(totalWins * 0.2, 0.6); // Cap -60%
        factor *= 1 - winPenalty;
    }
    // Floor: minimo 10% di probabilita residua
    return Math.max(factor, 0.1);
}
/**
 * Calcola il fattore di pacing base (senza time pressure).
 * Usato quando non siamo nell'ultima ora o mancano i dati temporali.
 */
function calculateBasePacingFactor(usedTokens, totalTokens, prizesAssigned, totalInitialPrizes) {
    if (usedTokens === 0 || totalTokens === 0 || totalInitialPrizes === 0) {
        return 1.0;
    }
    const tokenProgress = usedTokens / totalTokens;
    const prizeProgress = prizesAssigned / totalInitialPrizes;
    if (tokenProgress === 0)
        return 1.0;
    const ratio = prizeProgress / tokenProgress;
    if (ratio > 1.3) {
        return 0.6; // Troppo veloce: -40%
    }
    else if (ratio > 1.15) {
        return 0.8; // Un po' troppo veloce: -20%
    }
    else if (ratio < 0.7) {
        return 1.4; // Troppo lento: +40%
    }
    else if (ratio < 0.85) {
        return 1.2; // Un po' troppo lento: +20%
    }
    return 1.0;
}
/**
 * Calcola il fattore di time pressure per l'ultima ora.
 *
 * FASI:
 * - > 1 ora rimanente: pacing standard (ritorna 1.0, usa base pacing)
 * - 1 ora -> 5 min: conservazione (rallenta se premi finirebbero troppo presto)
 * - 5 min -> 1 min: distribuzione aggressiva (2x-5x boost)
 * - < 1 min: massimo boost (fino a 10x)
 *
 * OBIETTIVO: I premi non devono finire prima degli ultimi 5 minuti
 */
function calculateTimePressureFactor(usedTokens, totalTokens, prizesAssigned, totalInitialPrizes, promotionStartTime, promotionEndTime) {
    const now = new Date();
    const timeRemaining = promotionEndTime.getTime() - now.getTime();
    const timeElapsed = now.getTime() - promotionStartTime.getTime();
    const prizesRemaining = totalInitialPrizes - prizesAssigned;
    const tokensRemaining = totalTokens - usedTokens;
    // Edge cases
    if (prizesRemaining <= 0)
        return 1.0; // Nessun premio rimasto
    if (tokensRemaining <= 0)
        return 1.0; // Nessun token rimasto
    if (timeRemaining <= 0)
        return 1.0; // Promo terminata
    if (timeElapsed <= 0)
        return 1.0; // Promo non ancora iniziata
    // === FASE 1: Piu' di 1 ora rimanente ===
    // Usa pacing standard, ritorna 1.0 (nessun time pressure)
    if (timeRemaining > ONE_HOUR_MS) {
        return 1.0;
    }
    // Calcola il ritmo attuale di distribuzione premi (premi/ms)
    const currentPrizeRate = timeElapsed > 0 ? prizesAssigned / timeElapsed : 0;
    // Stima quando i premi finiranno al ritmo attuale
    const estimatedTimeToEmpty = currentPrizeRate > 0
        ? prizesRemaining / currentPrizeRate
        : Infinity;
    // === FASE 2: Ultima ora, ma non ultimi 5 minuti ===
    // Obiettivo: conservare premi per gli ultimi 5 minuti
    if (timeRemaining > FIVE_MINUTES_MS) {
        const timeUntilFinalPhase = timeRemaining - FIVE_MINUTES_MS;
        if (estimatedTimeToEmpty < timeUntilFinalPhase) {
            // I premi finirebbero PRIMA degli ultimi 5 minuti -> RALLENTA
            const slowdownRatio = estimatedTimeToEmpty / timeUntilFinalPhase;
            // Rallenta proporzionalmente, minimo 0.3, massimo 0.8
            return Math.max(0.3, Math.min(0.8, slowdownRatio));
        }
        else {
            // I premi dureranno fino alla fase finale
            const margin = estimatedTimeToEmpty / timeUntilFinalPhase;
            if (margin > 3) {
                // Grande margine: leggero boost per non accumulare troppi premi
                return 1.3;
            }
            else if (margin > 2) {
                return 1.15;
            }
            return 1.0;
        }
    }
    // === FASE 3: Ultimi 5 minuti, ma non ultimo minuto ===
    // Obiettivo: distribuire aggressivamente i premi rimanenti
    if (timeRemaining > ONE_MINUTE_MS) {
        // Calcola giocate attese nel tempo rimanente (basato su storico)
        const playsPerMs = usedTokens / timeElapsed;
        const expectedRemainingPlays = playsPerMs * timeRemaining;
        if (expectedRemainingPlays <= 0) {
            // Nessuna giocata attesa, massimo boost
            return 5.0;
        }
        // Probabilita' richiesta = premi_rimasti / giocate_attese
        const requiredWinRate = prizesRemaining / expectedRemainingPlays;
        // Probabilita' base attuale = premi_rimasti / token_rimasti
        const baseWinRate = prizesRemaining / tokensRemaining;
        // Boost necessario per raggiungere il win rate richiesto
        const boostNeeded = baseWinRate > 0 ? requiredWinRate / baseWinRate : 5.0;
        // Limita boost tra 1.5x e 5x
        return Math.max(1.5, Math.min(5.0, boostNeeded));
    }
    // === FASE 4: Ultimo minuto ===
    // Massima urgenza: distribuire tutti i premi rimasti
    if (prizesRemaining > 0) {
        // Boost massimo 10x per garantire distribuzione
        // Il fatigue continua ad applicarsi, quindi giocatori frequenti
        // avranno comunque probabilita' ridotta
        return 10.0;
    }
    return 1.0;
}
class ProbabilityEngine {
    /**
     * Determina se l'utente ha vinto e quale premio.
     *
     * Logica v2.1:
     * 1. Rileva genere (se non gia' salvato)
     * 2. Filtra premi disponibili e compatibili con genere
     * 3. Calcola fatigue factor (penalita giocatori frequenti)
     * 4. Calcola base pacing factor (distribuzione uniforme)
     * 5. Calcola time pressure factor (boost ultima ora)
     * 6. Combina i fattori e applica alla probabilita base
     * 7. Esegue estrazione casuale
     */
    determineOutcome(input) {
        const { customer, prizeTypes, totalTokens, usedTokens, prizesAssignedTotal, promotionStartTime, promotionEndTime } = input;
        // Risultato default (perdita)
        const lossResult = {
            winner: false,
            prize: null,
            factors: { fatigue: 1, pacing: 1, timePressure: 1, finalModifier: 1 },
        };
        // Verifica token rimasti
        const tokensRemaining = totalTokens - usedTokens;
        if (tokensRemaining <= 0) {
            return lossResult;
        }
        // 1. RILEVAMENTO GENERE
        const gender = customer.detectedGender || (0, genderDetection_1.detectGender)(customer.firstName).gender;
        // 2. FILTRA PREMI DISPONIBILI E COMPATIBILI CON GENERE
        const eligiblePrizes = prizeTypes.filter((prize) => {
            if (prize.remainingStock <= 0)
                return false;
            if (prize.genderRestriction === 'F' && gender !== 'F')
                return false;
            if (prize.genderRestriction === 'M' && gender !== 'M')
                return false;
            return true;
        });
        if (eligiblePrizes.length === 0) {
            return lossResult;
        }
        // 3. CALCOLO FATIGUE FACTOR
        const fatigue = calculateFatigueFactor(customer.totalPlays, customer.totalWins);
        // 4. CALCOLO BASE PACING FACTOR
        const totalInitialPrizes = prizeTypes.reduce((sum, p) => sum + p.initialStock, 0);
        const basePacing = calculateBasePacingFactor(usedTokens, totalTokens, prizesAssignedTotal, totalInitialPrizes);
        // 5. CALCOLO TIME PRESSURE FACTOR
        let timePressure = 1.0;
        if (promotionStartTime && promotionEndTime) {
            const startTime = new Date(promotionStartTime);
            const endTime = new Date(promotionEndTime);
            timePressure = calculateTimePressureFactor(usedTokens, totalTokens, prizesAssignedTotal, totalInitialPrizes, startTime, endTime);
        }
        // 6. COMBINA I FATTORI
        // Se siamo nell'ultima ora (timePressure != 1), usiamo timePressure invece di basePacing
        // Questo perche' timePressure include gia' la logica di conservazione/distribuzione
        const pacing = timePressure !== 1.0 ? timePressure : basePacing;
        const globalModifier = fatigue * pacing;
        // 7. CALCOLO PROBABILITA CUMULATIVE
        let cumulative = 0;
        const probabilities = [];
        for (const prize of eligiblePrizes) {
            const baseProbability = prize.remainingStock / tokensRemaining;
            const adjustedProbability = baseProbability * globalModifier;
            cumulative += adjustedProbability;
            probabilities.push({ prize, threshold: cumulative });
        }
        // 8. ESTRAZIONE CASUALE
        const random = Math.random();
        for (const { prize, threshold } of probabilities) {
            if (random < threshold) {
                return {
                    winner: true,
                    prize,
                    factors: {
                        fatigue,
                        pacing: basePacing,
                        timePressure,
                        finalModifier: globalModifier
                    },
                };
            }
        }
        // Nessuna vincita
        return {
            winner: false,
            prize: null,
            factors: {
                fatigue,
                pacing: basePacing,
                timePressure,
                finalModifier: globalModifier
            },
        };
    }
}
exports.ProbabilityEngine = ProbabilityEngine;
// Singleton export
exports.probabilityEngine = new ProbabilityEngine();
