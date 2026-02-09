import { Player, Match } from '../types';

// --- CONFIG CONSTANTS ---
const D_FACTOR = 1.2;
const SUPPORT_CUTOFF = 2.6; // Rating below this is considered "support" (weak)
const TARGET_DIFF = 1.4; // Ideal rating difference between partners (Strong carries Weak)
const USE_SCORE_DATE = new Date('2026-01-01T00:00:00').getTime();

// FORM CONSTANTS
const FORM_MAX = 0.25;
const SCALE_FACTOR = 0.27;
const W_WINLOSS = 0.80;
const W_MARGIN = 0.15;
const W_UPSET = 0.05;
const MARGIN_CAP_RATIO = 0.60;
const UPSET_CAP = 0.30;

interface PlayerForm {
    id: string;
    name: string;
    baseRating: number;
    form: number;
    effectiveRating: number;
    // For blowout index calc (Historical - Binary Safe)
    nonBinaryLosses: number;
    totalMarginRatioInLosses: number;
    // New: Winrate of last 10 matches
    last10WinRate: number;
}

interface GeneratedPair {
    player1: PlayerForm;
    player2: PlayerForm;
    strength: number; // Sum of effective ratings
    structure: number; // Diff of effective ratings
    cost: number;
}

export interface GeneratedMatch {
    team1: GeneratedPair;
    team2: GeneratedPair;
    matchCost: number;
    handicap?: {
        team: 1 | 2; // 1 for Team 1, 2 for Team 2
        points: number;
        reason: string;
        details: string[]; // Detailed formula breakdown
    };
    // Detailed Analysis for UI
    analysis: {
        team2Synergy: number; // Chemistry score of opponent
        team2Form: number; // Recent performance bonus of opponent
        qualityScore: number; // 0-100 score of match balance
    };
}

export interface AutoMatchResult {
    players: PlayerForm[];
    pairs: GeneratedPair[];
    matches: GeneratedMatch[];
}

// --- HELPER: CLAMP ---
const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

// --- HELPER: ROBUST ID CHECK ---
// Fixes issue where ID "02" (string) != 2 (number) or vice versa
const hasId = (list: any[], id: string | number): boolean => {
    if (!list || !Array.isArray(list)) return false;
    const strId = String(id);
    return list.some(item => String(item) === strId);
};

// --- HELPER: BINARY MATCH CHECK ---
// A match is BINARY if score is 1-0 or 0-1
const isBinaryMatch = (s1: number, s2: number): boolean => {
    return (s1 === 1 && s2 === 0) || (s1 === 0 && s2 === 1);
};

// --- STEP 1: LEARN PLAYER FORM (WIN/LOSS FIRST + BINARY SAFE) ---
// EXPORTED NOW for usage in other components
export const calculatePlayerForms = (players: Player[], matches: Match[]): Map<string, PlayerForm> => {
    // 1. Initialize Player Stats Map
    const playerStats = new Map<string, PlayerForm>();
    const baseRatings = new Map<string, number>();

    players.forEach(p => {
        const rawRating = (p.tournamentRating || p.initialPoints || 0);
        const baseRating = rawRating > 20 ? 3.0 : (rawRating || 3.0);
        const pIdStr = String(p.id);
        baseRatings.set(pIdStr, baseRating);
        
        playerStats.set(pIdStr, {
            id: pIdStr,
            name: p.name,
            baseRating: baseRating,
            form: 0,
            effectiveRating: baseRating, 
            nonBinaryLosses: 0,
            totalMarginRatioInLosses: 0,
            last10WinRate: 0
        });
    });

    // 2. Process Each Player Individually
    // "For each player p: Collect all matches where p appears, Sort by timestamp descending"

    players.forEach(p => {
        const pId = String(p.id);
        const pStats = playerStats.get(pId);
        if (!pStats) return;

        // Collect matches for this player using robust hasId check
        const pMatches = matches.filter(m => hasId(m.team1, pId) || hasId(m.team2, pId));
        
        // Sort by timestamp descending (Newest first)
        pMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Take the first 10 matches (Last 10 matches chronologically descending)
        const recentMatches = pMatches.slice(0, 10);

        if (recentMatches.length === 0) return;

        // --- COMPONENT A: WIN/LOSS CORE ---
        let wins = 0;
        recentMatches.forEach(m => {
            let s1 = Number(m.score1); let s2 = Number(m.score2);
            if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
            
            // Determine winner based on score
            let winner = s1 > s2 ? 1 : 2;
            if (s1 === s2) winner = Number(m.winner) === 1 ? 1 : 2; // Fallback

            const isTeam1 = hasId(m.team1, pId);
            const isWin = isTeam1 ? (winner === 1) : (winner === 2);
            if (isWin) wins++;
        });

        const games = recentMatches.length;
        
        // Calculate Win Rate for Display
        pStats.last10WinRate = games > 0 ? (wins / games) : 0;

        const winRate = (wins + 2) / (games + 4);
        const winCore = (winRate - 0.50) / 0.50;

        // --- COMPONENT B: MARGIN ADJUSTMENT (IGNORE BINARY) ---
        let marginSum = 0;
        let nonBinaryCount = 0;

        recentMatches.forEach(m => {
            let s1 = Number(m.score1); let s2 = Number(m.score2);
            if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
            
            // Skip binary for margin components
            if (isBinaryMatch(s1, s2)) return;

            nonBinaryCount++;
            
            const matchTime = new Date(m.date).getTime();
            const isScoreAware = matchTime >= USE_SCORE_DATE;
            
            let winner = s1 > s2 ? 1 : 2;
            if (s1 === s2) winner = Number(m.winner) === 1 ? 1 : 2;
            const isTeam1 = hasId(m.team1, pId);
            const isWin = isTeam1 ? (winner === 1) : (winner === 2);

            let marginRatio = 0;
            if (isScoreAware) {
                const gameTo = 11;
                const margin = Math.abs(s1 - s2);
                marginRatio = clamp(margin / gameTo, 0, 1);
            } else {
                marginRatio = 0.5; // Default for old matches
            }

            let signedMargin = isWin ? marginRatio : -marginRatio;
            signedMargin = clamp(signedMargin, -MARGIN_CAP_RATIO, MARGIN_CAP_RATIO);
            marginSum += signedMargin;

            // Also track for Blowout Index (Step 6) - only Non-Binary Losses
            if (!isWin && isScoreAware) {
                pStats.nonBinaryLosses++;
                pStats.totalMarginRatioInLosses += marginRatio;
            }
        });

        let marginAdj = 0;
        if (nonBinaryCount > 0) {
            marginAdj = marginSum / nonBinaryCount;
        }
        const marginNorm = marginAdj / MARGIN_CAP_RATIO;

        // --- COMPONENT C: UPSET ADJUSTMENT (BINARY OK) ---
        let upsetSum = 0;
        recentMatches.forEach(m => {
            let s1 = Number(m.score1); let s2 = Number(m.score2);
            if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
            let winner = s1 > s2 ? 1 : 2;
            if (s1 === s2) winner = Number(m.winner) === 1 ? 1 : 2;

            const isTeam1 = hasId(m.team1, pId);
            const isWin = isTeam1 ? (winner === 1) : (winner === 2);

            // Compute expected using BASE RATINGS ONLY
            const getBase = (id: string | number) => baseRatings.get(String(id)) || 3.0;
            const t1Rating = m.team1.reduce((a, b) => a + getBase(b), 0);
            const t2Rating = m.team2.reduce((a, b) => a + getBase(b), 0);
            
            const expectedT1 = 1 / (1 + Math.pow(10, (t2Rating - t1Rating) / D_FACTOR));
            const expectedWin = isTeam1 ? expectedT1 : (1 - expectedT1);

            let upsetSignal = 0;
            if (isWin) {
                upsetSignal = 0.5 - expectedWin; // Won when low expectation -> Positive
            } else {
                upsetSignal = -(expectedWin - 0.5); // Lost when high expectation -> Negative
            }
            upsetSignal = clamp(upsetSignal, -UPSET_CAP, UPSET_CAP);
            upsetSum += upsetSignal;
        });

        const upsetAdj = upsetSum / games;
        const upsetNorm = upsetAdj / UPSET_CAP;

        // --- COMBINE ---
        const raw = (W_WINLOSS * winCore) + (W_MARGIN * marginNorm) + (W_UPSET * upsetNorm);
        let formVal = clamp(raw * SCALE_FACTOR, -FORM_MAX, FORM_MAX);

        // FIX -0.00 DISPLAY ISSUE
        // Snap very small values to pure 0
        if (Math.abs(formVal) < 0.005) {
            formVal = 0;
        }

        pStats.form = formVal;
        pStats.effectiveRating = Number((pStats.baseRating + formVal).toFixed(2));
    });

    return playerStats;
};

// --- STEP 2: LEARN SYNERGY (WINRATE + MARGIN QUALITY, BINARY-SAFE) ---
const calculateSynergyMatrix = (matches: Match[]): Map<string, number> => {
    const pairStats = new Map<string, { games: number, wins: number, nonBinaryGames: number, totalMarginRatio: number }>();
    const getPairKey = (id1: string | number, id2: string | number) => [String(id1), String(id2)].sort().join('-');

    matches.forEach(m => {
        if (!m.team1 || !m.team2) return;
        let s1 = Number(m.score1); let s2 = Number(m.score2);
        if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
        const isBinary = isBinaryMatch(s1, s2);
        const matchTime = new Date(m.date).getTime();
        const isScoreAware = matchTime >= USE_SCORE_DATE;
        let marginRatio = 0;
        if (isScoreAware) {
            const margin = Math.abs(s1 - s2);
            marginRatio = clamp(margin / 11, 0, 1);
        } else {
            marginRatio = 0.5;
        }
        const processTeam = (ids: any[], isWin: boolean) => {
            if (ids.length === 2) {
                const k = getPairKey(ids[0], ids[1]);
                if (!pairStats.has(k)) pairStats.set(k, { games: 0, wins: 0, nonBinaryGames: 0, totalMarginRatio: 0 });
                const s = pairStats.get(k)!;
                s.games++;
                if (isWin) s.wins++;
                if (!isBinary) {
                    s.nonBinaryGames++;
                    s.totalMarginRatio += marginRatio;
                }
            }
        };
        const winner = s1 > s2 ? 1 : (s2 > s1 ? 2 : m.winner);
        processTeam(m.team1, winner === 1);
        processTeam(m.team2, winner === 2);
    });
    const synergyMap = new Map<string, number>();
    pairStats.forEach((stat, key) => {
        const p = (stat.wins + 2) / (stat.games + 4);
        const safeP = Math.max(0.01, Math.min(0.99, p));
        const baseSynergy = Math.log(safeP / (1 - safeP)) * (stat.games / (stat.games + 6));
        let avgMarginRatio = 0;
        let quality = 1.0;
        if (stat.nonBinaryGames > 0) {
            avgMarginRatio = stat.totalMarginRatio / stat.nonBinaryGames;
            quality = 0.75 + 0.50 * clamp(avgMarginRatio, 0, 1);
        }
        synergyMap.set(key, baseSynergy * quality);
    });
    return synergyMap;
};

// --- STEP 3: COST FUNCTION ---
const getPairingCost = (p1: PlayerForm, p2: PlayerForm, synergyMatrix: Map<string, number>, recentPairs: Set<string>): number => {
    const diff = Math.abs(p1.effectiveRating - p2.effectiveRating);
    let cost = 1.0 * Math.pow(diff - TARGET_DIFF, 2);
    if (diff < 0.6) cost += 1.5;
    if (diff > 2.0) cost += 3.0;
    if (p1.effectiveRating < SUPPORT_CUTOFF && p2.effectiveRating < SUPPORT_CUTOFF) cost += 10.0;
    const pairKey = [p1.id, p2.id].sort().join('-');
    const syn = synergyMatrix.get(pairKey) || 0;
    if (Math.abs(syn) > 0.35) cost += Math.abs(syn) * 2.0; 
    if (recentPairs.has(pairKey)) cost += 15.0;
    return cost;
};

// --- STEP 4: OPTIMAL PAIRING (Greedy with Optimization) ---
const generateOptimalPairs = (pool: PlayerForm[], synergyMatrix: Map<string, number>, recentPairs: Set<string>): GeneratedPair[] => {
    const sortedPool = [...pool].sort((a, b) => a.effectiveRating - b.effectiveRating);
    const pairs: GeneratedPair[] = [];
    const used = new Set<string>();
    for (let i = 0; i < sortedPool.length; i++) {
        const p1 = sortedPool[i];
        if (used.has(p1.id)) continue;
        let bestPartner: PlayerForm | null = null;
        let minCost = Infinity;
        for (let j = i + 1; j < sortedPool.length; j++) {
            const p2 = sortedPool[j];
            if (used.has(p2.id)) continue;
            const c = getPairingCost(p1, p2, synergyMatrix, recentPairs);
            if (c < minCost) {
                minCost = c;
                bestPartner = p2;
            }
        }
        if (bestPartner) {
            used.add(p1.id);
            used.add(bestPartner.id);
            pairs.push({
                player1: p1,
                player2: bestPartner,
                strength: p1.effectiveRating + bestPartner.effectiveRating,
                structure: Math.abs(p1.effectiveRating - bestPartner.effectiveRating),
                cost: minCost
            });
        }
    }
    return pairs;
};

// --- STEP 5: HANDICAP CALCULATION ---
const calculateHandicap = (t1: GeneratedPair, t2: GeneratedPair, history: Match[]): GeneratedMatch['handicap'] => {
    let points = 0;
    const details: string[] = [];
    const strong = t1.strength > t2.strength ? t1 : t2;
    const weak = t1.strength > t2.strength ? t2 : t1;
    const teamStrong = t1.strength > t2.strength ? 1 : 2;
    const teamWeak = teamStrong === 1 ? 2 : 1;
    const diff = Math.abs(t1.strength - t2.strength);
    
    // Base Rating Diff
    let ratingPoints = 0;
    if (diff > 1.2) ratingPoints = 4;
    else if (diff > 0.9) ratingPoints = 3;
    else if (diff > 0.6) ratingPoints = 2;
    else if (diff > 0.3) ratingPoints = 1;
    points += ratingPoints;
    if (ratingPoints > 0) details.push(`Rating Diff (${diff.toFixed(2)}): +${ratingPoints}`);

    // Support Override
    const countSupport = (t: GeneratedPair) => (t.player1.effectiveRating < SUPPORT_CUTOFF ? 1 : 0) + (t.player2.effectiveRating < SUPPORT_CUTOFF ? 1 : 0);
    if (countSupport(weak) > countSupport(strong)) {
        points += 1;
        details.push(`Support Override: +1 (Weak team has more support players)`);
    }

    // Form Override
    const getWR10 = (t: GeneratedPair) => (t.player1.last10WinRate + t.player2.last10WinRate) / 2;
    const wrGap = getWR10(weak) - getWR10(strong);
    if (wrGap >= 0.2) {
        const deduction = wrGap >= 0.3 ? 2 : 1;
        points -= deduction;
        details.push(`Form Override: -${deduction} (Weak team is on fire)`);
    }

    // Blowout
    const w1LossRatio = weak.player1.nonBinaryLosses > 0 ? weak.player1.totalMarginRatioInLosses / weak.player1.nonBinaryLosses : 0;
    const w2LossRatio = weak.player2.nonBinaryLosses > 0 ? weak.player2.totalMarginRatioInLosses / weak.player2.nonBinaryLosses : 0;
    const teamBlowoutIndex = (w1LossRatio + w2LossRatio) / 2;
    if (teamBlowoutIndex > 0.35 && points > 0) {
        points += 1;
        details.push(`Blowout Risk: +1 (Weak team prone to heavy losses)`);
    }

    // H2H
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const weakIds = [weak.player1.id, weak.player2.id];
    const strongIds = [strong.player1.id, strong.player2.id];
    const h2hMatches = history.filter(m => {
        const mTime = new Date(m.date).getTime();
        if (mTime < thirtyDaysAgo) return false;
        const t1Ids = m.team1.map(String);
        const t2Ids = m.team2.map(String);
        return (
            (hasId(t1Ids, weakIds[0]) && hasId(t1Ids, weakIds[1]) && hasId(t2Ids, strongIds[0]) && hasId(t2Ids, strongIds[1])) ||
            (hasId(t2Ids, weakIds[0]) && hasId(t2Ids, weakIds[1]) && hasId(t1Ids, strongIds[0]) && hasId(t1Ids, strongIds[1]))
        );
    });
    if (h2hMatches.length > 0) {
        let strongLosses = 0;
        h2hMatches.forEach(m => {
            const t1Ids = m.team1.map(String);
            const strongIsT1 = hasId(t1Ids, strongIds[0]);
            let s1 = Number(m.score1); let s2 = Number(m.score2);
            let winner = s1 > s2 ? 1 : 2; 
            if (strongIsT1 && winner === 2) strongLosses++;
            if (!strongIsT1 && winner === 1) strongLosses++;
        });
        if (strongLosses > 0) {
            const h2hDed = h2hMatches.length === 1 ? 0.5 : 1;
            points -= h2hDed;
            details.push(`H2H History: -${h2hDed} (Strong team lost recently)`);
        }
    }

    let finalPoints = Math.round(points);
    if (finalPoints > 4) finalPoints = 4;
    if (finalPoints <= 0) return undefined;

    return {
        team: teamWeak as 1 | 2,
        points: finalPoints,
        reason: `Chấp ${finalPoints} quả`,
        details: details
    };
};

// --- STEP 6: MATCHMAKING (Top Down) ---
const generateMatchups = (teams: GeneratedPair[], recentMatches: Set<string>, allMatches: Match[]): GeneratedMatch[] => {
    let pool = [...teams].sort((a, b) => b.strength - a.strength);
    const matches: GeneratedMatch[] = [];
    while (pool.length >= 2) {
        const t1 = pool[0]; pool.shift(); 
        let bestOpponentIdx = -1; let minMatchCost = Infinity;
        for (let i = 0; i < pool.length; i++) {
            const t2 = pool[i];
            let cost = 1.0 * Math.pow(t1.strength - t2.strength, 2) + 0.7 * Math.pow(t1.structure - t2.structure, 2);
            const expectedMarginRatio = clamp(Math.abs(t1.strength - t2.strength) / 2.0, 0, 1);
            cost += 0.6 * Math.pow(expectedMarginRatio, 2);
            const allIds = [t1.player1.id, t1.player2.id, t2.player1.id, t2.player2.id].sort().join('-');
            if (recentMatches.has(allIds)) cost += 50.0;
            if (cost < minMatchCost) { minMatchCost = cost; bestOpponentIdx = i; }
        }
        if (bestOpponentIdx !== -1) {
            const t2 = pool[bestOpponentIdx]; pool.splice(bestOpponentIdx, 1);
            const handicap = calculateHandicap(t1, t2, allMatches);
            matches.push({ team1: t1, team2: t2, matchCost: minMatchCost, handicap, analysis: { team2Synergy: 0, team2Form: 0, qualityScore: Math.max(0, 100 - minMatchCost) } });
        }
    }
    return matches;
};

// --- PUBLIC API ---

// Scenario: "Find Opponents" (Existing)
export const findTopMatchupsForTeam = (fixedTeamIds: [string, string], poolIds: string[], allPlayers: Player[], allMatches: Match[]): GeneratedMatch[] => {
    const playerForms = calculatePlayerForms(allPlayers, allMatches);
    const synergyMatrix = calculateSynergyMatrix(allMatches);
    const p1 = playerForms.get(String(fixedTeamIds[0]));
    const p2 = playerForms.get(String(fixedTeamIds[1]));
    if (!p1 || !p2) return [];
    const fixedTeam: GeneratedPair = { player1: p1, player2: p2, strength: p1.effectiveRating + p2.effectiveRating, structure: Math.abs(p1.effectiveRating - p2.effectiveRating), cost: 0 };
    const pool = poolIds.map(id => playerForms.get(String(id))).filter(p => p !== undefined) as PlayerForm[];
    const candidatePairs: GeneratedPair[] = [];
    for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
            const opp1 = pool[i]; const opp2 = pool[j];
            const pairCost = getPairingCost(opp1, opp2, synergyMatrix, new Set());
            candidatePairs.push({ player1: opp1, player2: opp2, strength: opp1.effectiveRating + opp2.effectiveRating, structure: Math.abs(opp1.effectiveRating - opp2.effectiveRating), cost: pairCost });
        }
    }
    const recentMatches = new Set<string>();
    const sortedMatches = [...allMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);
    sortedMatches.forEach(m => { if (m.team1.length === 2 && m.team2.length === 2) recentMatches.add([...m.team1, ...m.team2].map(String).sort().join('-')); });
    const rankedMatchups = candidatePairs.map(candidate => {
        let matchCost = 1.0 * Math.pow(fixedTeam.strength - candidate.strength, 2) + 0.7 * Math.pow(fixedTeam.structure - candidate.structure, 2) + candidate.cost * 0.5;
        const expectedMarginRatio = clamp(Math.abs(fixedTeam.strength - candidate.strength) / 2.0, 0, 1);
        matchCost += 0.6 * Math.pow(expectedMarginRatio, 2);
        const allIds = [p1.id, p2.id, candidate.player1.id, candidate.player2.id].sort().join('-');
        if (recentMatches.has(allIds)) matchCost += 50.0;
        const handicap = calculateHandicap(fixedTeam, candidate, allMatches);
        const pairKey = [candidate.player1.id, candidate.player2.id].sort().join('-');
        const syn = synergyMatrix.get(pairKey) || 0;
        const combinedForm = candidate.player1.form + candidate.player2.form;
        return { team1: fixedTeam, team2: candidate, matchCost, handicap, analysis: { team2Synergy: syn, team2Form: combinedForm, qualityScore: Math.max(0, 100 - matchCost) } } as GeneratedMatch;
    });
    return rankedMatchups.sort((a, b) => {
        const handicapA = a.handicap ? a.handicap.points : 0;
        const handicapB = b.handicap ? b.handicap.points : 0;
        if (handicapA === 0 && handicapB > 0) return -1;
        if (handicapA > 0 && handicapB === 0) return 1;
        if (handicapA !== handicapB) return handicapA - handicapB;
        return a.matchCost - b.matchCost;
    }).slice(0, 10);
};

// Scenario: "Find Partner" (New)
export const findBestPartners = (
    myId: string, 
    opponentIds: string[], 
    poolIds: string[], 
    allPlayers: Player[], 
    allMatches: Match[]
): GeneratedMatch[] => {
    const playerForms = calculatePlayerForms(allPlayers, allMatches);
    const synergyMatrix = calculateSynergyMatrix(allMatches);
    const recentMatches = new Set<string>();
    
    // Identify Forms
    const myForm = playerForms.get(myId);
    if (!myForm) return [];

    const oppForms = opponentIds.map(id => playerForms.get(id)).filter(p => !!p) as PlayerForm[];
    if (oppForms.length === 0) return []; // Should have at least 1 opponent

    const pool = poolIds.map(id => playerForms.get(id)).filter(p => !!p) as PlayerForm[];

    const results: GeneratedMatch[] = [];

    // CASE 1: 1 User vs 1 Opponent. Need to find Partner for User AND Partner for Opponent.
    if (oppForms.length === 1) {
        const opp = oppForms[0];
        // Iterate every possible partner for Me
        for (let i = 0; i < pool.length; i++) {
            const pMyPartner = pool[i];
            
            // Iterate every possible partner for Opponent (excluding my partner)
            for (let j = 0; j < pool.length; j++) {
                if (i === j) continue; // Same person
                const pOppPartner = pool[j];

                // Construct pairs
                const myTeam: GeneratedPair = { 
                    player1: myForm, player2: pMyPartner, 
                    strength: myForm.effectiveRating + pMyPartner.effectiveRating, 
                    structure: Math.abs(myForm.effectiveRating - pMyPartner.effectiveRating), 
                    cost: getPairingCost(myForm, pMyPartner, synergyMatrix, recentMatches) 
                };
                
                const oppTeam: GeneratedPair = { 
                    player1: opp, player2: pOppPartner, 
                    strength: opp.effectiveRating + pOppPartner.effectiveRating, 
                    structure: Math.abs(opp.effectiveRating - pOppPartner.effectiveRating), 
                    cost: getPairingCost(opp, pOppPartner, synergyMatrix, recentMatches) 
                };

                // Calculate Match Quality
                let matchCost = 1.0 * Math.pow(myTeam.strength - oppTeam.strength, 2) 
                              + 0.5 * Math.pow(myTeam.structure - oppTeam.structure, 2)
                              + (myTeam.cost + oppTeam.cost) * 0.3; // Less weight on pair cost, more on balance

                const handicap = calculateHandicap(myTeam, oppTeam, allMatches);
                
                results.push({
                    team1: myTeam,
                    team2: oppTeam,
                    matchCost,
                    handicap,
                    analysis: { team2Synergy: 0, team2Form: 0, qualityScore: Math.max(0, 100 - matchCost) }
                });
            }
        }
    } 
    // CASE 2: 1 User vs 2 Opponents (Fixed). Need to find Partner for User.
    else if (oppForms.length === 2) {
        const opp1 = oppForms[0];
        const opp2 = oppForms[1];
        
        // Fixed Opponent Pair
        const oppTeam: GeneratedPair = {
            player1: opp1, player2: opp2,
            strength: opp1.effectiveRating + opp2.effectiveRating,
            structure: Math.abs(opp1.effectiveRating - opp2.effectiveRating),
            cost: getPairingCost(opp1, opp2, synergyMatrix, recentMatches)
        };

        // Iterate every possible partner for Me
        for (let i = 0; i < pool.length; i++) {
            const pMyPartner = pool[i];
            
            const myTeam: GeneratedPair = { 
                player1: myForm, player2: pMyPartner, 
                strength: myForm.effectiveRating + pMyPartner.effectiveRating, 
                structure: Math.abs(myForm.effectiveRating - pMyPartner.effectiveRating), 
                cost: getPairingCost(myForm, pMyPartner, synergyMatrix, recentMatches) 
            };

            let matchCost = 1.0 * Math.pow(myTeam.strength - oppTeam.strength, 2) 
                          + 0.5 * Math.pow(myTeam.structure - oppTeam.structure, 2)
                          + myTeam.cost * 0.5;

            const handicap = calculateHandicap(myTeam, oppTeam, allMatches);

            results.push({
                team1: myTeam,
                team2: oppTeam,
                matchCost,
                handicap,
                analysis: { team2Synergy: 0, team2Form: 0, qualityScore: Math.max(0, 100 - matchCost) }
            });
        }
    }

    // Sort by Match Quality (Best Balanced First)
    // Secondary sort: minimize Handicap points
    return results.sort((a, b) => {
        const hA = a.handicap ? a.handicap.points : 0;
        const hB = b.handicap ? b.handicap.points : 0;
        
        // Prefer balanced matches (0 handicap)
        if (hA === 0 && hB > 0) return -1;
        if (hB === 0 && hA > 0) return 1;
        
        // Then by match cost
        return a.matchCost - b.matchCost;
    }).slice(0, 10);
};

export const predictMatchOutcome = (team1Ids: string[], team2Ids: string[], allPlayers: Player[], allMatches: Match[]): GeneratedMatch | null => {
    if (team1Ids.length === 0 || team2Ids.length === 0) return null;
    const playerForms = calculatePlayerForms(allPlayers, allMatches);
    const t1p1 = playerForms.get(String(team1Ids[0]));
    const t1p2 = team1Ids.length > 1 ? playerForms.get(String(team1Ids[1])) : null;
    if (!t1p1) return null;
    const t1Rating = t1p1.effectiveRating + (t1p2 ? t1p2.effectiveRating : 0);
    const t1Structure = t1p2 ? Math.abs(t1p1.effectiveRating - t1p2.effectiveRating) : 0;
    const team1Pair: GeneratedPair = { player1: t1p1, player2: t1p2 || t1p1, strength: t1Rating, structure: t1Structure, cost: 0 };
    const t2p1 = playerForms.get(String(team2Ids[0]));
    const t2p2 = team2Ids.length > 1 ? playerForms.get(String(team2Ids[1])) : null;
    if (!t2p1) return null;
    const t2Rating = t2p1.effectiveRating + (t2p2 ? t2p2.effectiveRating : 0);
    const t2Structure = t2p2 ? Math.abs(t2p1.effectiveRating - t2p2.effectiveRating) : 0;
    const team2Pair: GeneratedPair = { player1: t2p1, player2: t2p2 || t2p1, strength: t2Rating, structure: t2Structure, cost: 0 };
    const handicap = calculateHandicap(team1Pair, team2Pair, allMatches);
    const diff = Math.abs(team1Pair.strength - team2Pair.strength);
    const quality = Math.max(0, 100 - (diff * 50));
    return { team1: team1Pair, team2: team2Pair, matchCost: 0, handicap, analysis: { qualityScore: quality, team2Form: 0, team2Synergy: 0 } };
};

export const runAutoMatchmaker = (selectedPlayerIds: string[], allPlayers: Player[], allMatches: Match[]): AutoMatchResult => {
    const selectedPlayers = allPlayers.filter(p => selectedPlayerIds.includes(String(p.id)));
    if (selectedPlayers.length % 2 !== 0) throw new Error("Số lượng người chơi phải là số chẵn.");
    const playerForms = calculatePlayerForms(allPlayers, allMatches);
    const synergyMatrix = calculateSynergyMatrix(allMatches);
    const pool = selectedPlayers.map(p => playerForms.get(String(p.id))!);
    const sortedMatches = [...allMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
    const recentPairs = new Set<string>();
    const recentMatches = new Set<string>();
    sortedMatches.forEach(m => {
        if (m.team1.length === 2) recentPairs.add([...m.team1].map(String).sort().join('-'));
        if (m.team2.length === 2) recentPairs.add([...m.team2].map(String).sort().join('-'));
        if (m.team1.length === 2 && m.team2.length === 2) recentMatches.add([...m.team1, ...m.team2].map(String).sort().join('-'));
    });
    const pairs = generateOptimalPairs(pool, synergyMatrix, recentPairs);
    const matchesResult = generateMatchups(pairs, recentMatches, allMatches);
    return { players: pool, pairs, matches: matchesResult };
};

// --- NEW HELPER: HISTORICAL ANALYSIS ---
export const analyzeHistoryHandicaps = (matches: Match[], players: Player[]): Map<string, 'balanced' | 't1_favorite' | 't2_favorite'> => {
    const historyMap = new Map<string, 'balanced' | 't1_favorite' | 't2_favorite'>();
    
    // Sort chronological: oldest to newest
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sortedMatches.length; i++) {
        const currentMatch = sortedMatches[i];
        
        // Context: Matches UP TO this point (exclusive) determine form/rating entering the match
        const pastMatches = sortedMatches.slice(0, i);
        
        // Calculate Forms at this snapshot
        const forms = calculatePlayerForms(players, pastMatches);
        
        // Calculate Matchup
        const t1Ids = currentMatch.team1.map(String);
        const t2Ids = currentMatch.team2.map(String);
        
        const getStrength = (ids: string[]) => {
            if (ids.length === 0) return 0;
            return ids.reduce((sum, id) => {
                const p = forms.get(id);
                return sum + (p ? p.effectiveRating : 3.0);
            }, 0) / (ids.length === 1 ? 1 : 1); 
        };

        const str1 = getStrength(t1Ids);
        const str2 = getStrength(t2Ids);
        
        const diff = str1 - str2;
        
        if (Math.abs(diff) <= 0.25) {
            historyMap.set(currentMatch.id, 'balanced');
        } else {
            historyMap.set(currentMatch.id, diff > 0 ? 't1_favorite' : 't2_favorite');
        }
    }

    return historyMap;
};
