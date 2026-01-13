import { Player, Match } from '../types';

// --- CONFIG CONSTANTS ---
const D_FACTOR = 1.2;
const SUPPORT_CUTOFF = 2.6; // Rating below this is considered "support" (weak)
const TARGET_DIFF = 1.4; // Ideal rating difference between partners (Strong carries Weak)
const USE_SCORE_DATE = new Date('2026-01-01T00:00:00').getTime();

// FORM CONSTANTS
const FORM_MAX = 0.30;
const SCALE_FACTOR = 0.20;
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
const calculatePlayerForms = (players: Player[], matches: Match[]): Map<string, PlayerForm> => {
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
                
                // Always count games/wins (even Binary)
                s.games++;
                if (isWin) s.wins++;

                // Only count margin stats if NOT binary
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

        // Margin Quality from NON-BINARY games
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

// --- STEP 3: PAIRING COST FUNCTION ---
const getPairingCost = (
    p1: PlayerForm, 
    p2: PlayerForm, 
    synergyMatrix: Map<string, number>,
    recentPairs: Set<string>
): number => {
    const diff = Math.abs(p1.effectiveRating - p2.effectiveRating);
    
    let cost = 1.0 * Math.pow(diff - TARGET_DIFF, 2);
    if (diff < 0.6) cost += 1.5;
    if (diff > 2.0) cost += 3.0;
    if (p1.effectiveRating < SUPPORT_CUTOFF && p2.effectiveRating < SUPPORT_CUTOFF) {
        cost += 10.0;
    }

    const pairKey = [p1.id, p2.id].sort().join('-');
    const syn = synergyMatrix.get(pairKey) || 0;
    if (Math.abs(syn) > 0.35) {
        cost += Math.abs(syn) * 2.0; 
    }

    if (recentPairs.has(pairKey)) {
        cost += 15.0;
    }

    return cost;
};

// --- STEP 4: PAIRING ALGORITHM ---
const generateOptimalPairs = (
    pool: PlayerForm[], 
    synergyMatrix: Map<string, number>,
    recentPairs: Set<string>
): GeneratedPair[] => {
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

    // Local Swap Optimization
    let currentTotalCost = pairs.reduce((sum, p) => sum + p.cost, 0);
    for (let iter = 0; iter < 200; iter++) {
        if (pairs.length < 2) break;
        const idx1 = Math.floor(Math.random() * pairs.length);
        let idx2 = Math.floor(Math.random() * pairs.length);
        while (idx1 === idx2) idx2 = Math.floor(Math.random() * pairs.length);

        const pairA = pairs[idx1];
        const pairB = pairs[idx2];

        const costSwap1 = getPairingCost(pairA.player1, pairB.player2, synergyMatrix, recentPairs);
        const costSwap2 = getPairingCost(pairB.player1, pairA.player2, synergyMatrix, recentPairs);
        
        const newTotalCost = currentTotalCost - pairA.cost - pairB.cost + costSwap1 + costSwap2;

        if (newTotalCost < currentTotalCost) {
            const newPairA: GeneratedPair = {
                player1: pairA.player1,
                player2: pairB.player2,
                strength: pairA.player1.effectiveRating + pairB.player2.effectiveRating,
                structure: Math.abs(pairA.player1.effectiveRating - pairB.player2.effectiveRating),
                cost: costSwap1
            };
            const newPairB: GeneratedPair = {
                player1: pairB.player1,
                player2: pairA.player2,
                strength: pairB.player1.effectiveRating + pairA.player2.effectiveRating,
                structure: Math.abs(pairB.player1.effectiveRating - pairA.player2.effectiveRating),
                cost: costSwap2
            };
            pairs[idx1] = newPairA;
            pairs[idx2] = newPairB;
            currentTotalCost = newTotalCost;
        }
    }

    return pairs;
};

// --- HELPER: CALCULATE HANDICAP WITH CALIBRATION ---
const calculateHandicap = (t1: GeneratedPair, t2: GeneratedPair, history: Match[]): GeneratedMatch['handicap'] => {
    let points = 0; // Use float for intermediate calculation
    const details: string[] = [];
    
    // Determine Strong/Weak based on raw strength
    const strong = t1.strength > t2.strength ? t1 : t2;
    const weak = t1.strength > t2.strength ? t2 : t1;
    const teamStrong = t1.strength > t2.strength ? 1 : 2;
    const teamWeak = teamStrong === 1 ? 2 : 1;

    // STEP 1: BASE RATING DIFF
    const diff = Math.abs(t1.strength - t2.strength);
    
    details.push(`1. CHÊNH LỆCH RATING (GỐC + PHONG ĐỘ)`);
    
    const printPlayerDetail = (p: PlayerForm) => {
        // Safe display logic to avoid -0.00
        const displayForm = Math.abs(p.form) < 0.005 ? 0 : p.form;
        const sign = displayForm >= 0 ? '+' : '';
        const wr = Math.round(p.last10WinRate * 100);
        details.push(`  - ${p.name}: ${p.baseRating.toFixed(2)} (Gốc) ${sign}${displayForm.toFixed(2)} (Phong độ) [WR 10 trận: ${wr}%]`);
    };

    details.push(`• Kèo Trên (Tổng ${strong.strength.toFixed(2)}):`);
    printPlayerDetail(strong.player1);
    printPlayerDetail(strong.player2);
    
    details.push(`• Kèo Dưới (Tổng ${weak.strength.toFixed(2)}):`);
    printPlayerDetail(weak.player1);
    printPlayerDetail(weak.player2);

    details.push(`• Hiệu số: ${diff.toFixed(2)}`);

    let ratingPoints = 0;
    if (diff > 1.2) ratingPoints = 4;
    else if (diff > 0.9) ratingPoints = 3;
    else if (diff > 0.6) ratingPoints = 2;
    else if (diff > 0.3) ratingPoints = 1;

    points += ratingPoints;
    if (ratingPoints > 0) {
        const range = diff > 1.2 ? "> 1.2" : diff > 0.9 ? "0.9 - 1.2" : diff > 0.6 ? "0.6 - 0.9" : "0.3 - 0.6";
        details.push(`• Quy đổi: Hiệu số thuộc khoảng [${range}] => +${ratingPoints} quả`);
    } else {
        details.push(`• Quy đổi: Hiệu số < 0.3 => 0 quả`);
    }

    // STEP 2: SUPPORT OVERRIDE
    // Rule: Add +1 handicap ONLY if the weaker team has MORE support players than the stronger team.
    const countSupport = (t: GeneratedPair) => 
        (t.player1.effectiveRating < SUPPORT_CUTOFF ? 1 : 0) + 
        (t.player2.effectiveRating < SUPPORT_CUTOFF ? 1 : 0);
    
    const weakSupport = countSupport(weak);
    const strongSupport = countSupport(strong);

    if (weakSupport > strongSupport) {
        points += 1;
        details.push(`2. VỊ TRÍ YẾU (SUPPORT OVERRIDE)`);
        details.push(`• Kèo dưới có ${weakSupport} support, Kèo trên có ${strongSupport} => +1 quả`);
    }

    // STEP 3: FORM OVERRIDE (WR10 PRIORITY)
    const getWR10 = (t: GeneratedPair) => (t.player1.last10WinRate + t.player2.last10WinRate) / 2;
    const wrWeak = getWR10(weak);
    const wrStrong = getWR10(strong);
    const wrGap = wrWeak - wrStrong;

    if (wrGap >= 0.2) { // 20%
        details.push(`3. PHONG ĐỘ (WR10 OVERRIDE)`);
        const reduction = wrGap >= 0.3 ? 2 : 1;
        points -= reduction;
        details.push(`• Kèo dưới có WR10 cao hơn ${(wrGap * 100).toFixed(0)}% => -${reduction} quả`);
    }

    // STEP 4: BLOWOUT DIRECTION CHECK
    // Rule: Apply blowout bonus ONLY IF teamBlowoutIndex > 0.35 AND points > 0 (still weaker)
    const w1LossRatio = weak.player1.nonBinaryLosses > 0 ? weak.player1.totalMarginRatioInLosses / weak.player1.nonBinaryLosses : 0;
    const w2LossRatio = weak.player2.nonBinaryLosses > 0 ? weak.player2.totalMarginRatioInLosses / weak.player2.nonBinaryLosses : 0;
    const teamBlowoutIndex = (w1LossRatio + w2LossRatio) / 2;

    if (teamBlowoutIndex > 0.35) {
        if (points > 0) {
            points += 1;
            details.push(`4. CHỈ SỐ DỄ VỠ TRẬN (BLOWOUT)`);
            details.push(`• Index ${teamBlowoutIndex.toFixed(3)} > 0.35 và vẫn ở cửa dưới => +1 quả`);
        }
    }

    // STEP 5: HEAD-TO-HEAD CALIBRATION
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const weakIds = [weak.player1.id, weak.player2.id];
    const strongIds = [strong.player1.id, strong.player2.id];
    
    // Filter history for matches between these specific pairs
    const h2hMatches = history.filter(m => {
        const mTime = new Date(m.date).getTime();
        if (mTime < thirtyDaysAgo) return false;
        
        const t1Ids = m.team1.map(String);
        const t2Ids = m.team2.map(String);
        
        const isMatch = (
            (hasId(t1Ids, weakIds[0]) && hasId(t1Ids, weakIds[1]) && hasId(t2Ids, strongIds[0]) && hasId(t2Ids, strongIds[1])) ||
            (hasId(t2Ids, weakIds[0]) && hasId(t2Ids, weakIds[1]) && hasId(t1Ids, strongIds[0]) && hasId(t1Ids, strongIds[1]))
        );
        return isMatch;
    });

    if (h2hMatches.length > 0) {
        let strongLosses = 0;
        h2hMatches.forEach(m => {
            // Determine if strong team was team1 or team2 in that match
            const t1Ids = m.team1.map(String);
            const strongIsT1 = hasId(t1Ids, strongIds[0]); // Strong pair is Team 1
            
            let s1 = Number(m.score1); let s2 = Number(m.score2);
            let winner = s1 > s2 ? 1 : 2; 
            
            // Did strong lose?
            if (strongIsT1 && winner === 2) strongLosses++;
            if (!strongIsT1 && winner === 1) strongLosses++;
        });

        if (strongLosses > 0) {
            details.push(`5. LỊCH SỬ ĐỐI ĐẦU (30 NGÀY)`);
            const reduction = h2hMatches.length === 1 ? 0.5 : 1;
            points -= reduction;
            details.push(`• Kèo trên đã thua ${strongLosses}/${h2hMatches.length} trận gần đây => -${reduction} quả`);
        }
    }

    // FINAL SAFETY
    let finalPoints = Math.round(points);
    
    if (finalPoints > 4) {
        finalPoints = 4;
        details.push(`• Giới hạn trần: 4 quả`);
    }
    
    // If points dropped to 0 or below, no handicap
    if (finalPoints <= 0) {
        return undefined;
    }

    return {
        team: teamWeak as 1 | 2,
        points: finalPoints,
        reason: `Chấp ${finalPoints} quả`,
        details: details
    };
};


// --- STEP 5: MATCHMAKING BETWEEN TEAMS (SCORE-AWARE) ---
const generateMatchups = (
    teams: GeneratedPair[],
    recentMatches: Set<string>,
    allMatches: Match[]
): GeneratedMatch[] => {
    let pool = [...teams].sort((a, b) => b.strength - a.strength);
    const matches: GeneratedMatch[] = [];

    while (pool.length >= 2) {
        const t1 = pool[0];
        pool.shift(); 

        let bestOpponentIdx = -1;
        let minMatchCost = Infinity;

        for (let i = 0; i < pool.length; i++) {
            const t2 = pool[i];
            
            // Base MatchCost
            let cost = 1.0 * Math.pow(t1.strength - t2.strength, 2);
            cost += 0.7 * Math.pow(t1.structure - t2.structure, 2);

            // Score-aware blowout cost (Expected Margin Ratio)
            const expectedMarginRatio = clamp(Math.abs(t1.strength - t2.strength) / 2.0, 0, 1);
            cost += 0.6 * Math.pow(expectedMarginRatio, 2);

            // Repeat Penalty
            const allIds = [t1.player1.id, t1.player2.id, t2.player1.id, t2.player2.id].sort().join('-');
            if (recentMatches.has(allIds)) {
                cost += 50.0;
            }

            if (cost < minMatchCost) {
                minMatchCost = cost;
                bestOpponentIdx = i;
            }
        }

        if (bestOpponentIdx !== -1) {
            const t2 = pool[bestOpponentIdx];
            pool.splice(bestOpponentIdx, 1);
            
            // --- STEP 6: HANDICAP WITH BREAKDOWN ---
            const handicap = calculateHandicap(t1, t2, allMatches);

            matches.push({
                team1: t1,
                team2: t2,
                matchCost: minMatchCost,
                handicap,
                analysis: {
                    team2Synergy: 0,
                    team2Form: 0,
                    qualityScore: Math.max(0, 100 - minMatchCost)
                }
            });
        }
    }

    return matches;
};

// --- FIND TOP MATCHUPS FOR FIXED TEAM ---
export const findTopMatchupsForTeam = (
    fixedTeamIds: [string, string], 
    poolIds: string[], 
    allPlayers: Player[],
    allMatches: Match[]
): GeneratedMatch[] => {
    
    const playerForms = calculatePlayerForms(allPlayers, allMatches);
    const synergyMatrix = calculateSynergyMatrix(allMatches);

    const p1 = playerForms.get(String(fixedTeamIds[0]));
    const p2 = playerForms.get(String(fixedTeamIds[1]));

    if (!p1 || !p2) return [];

    const fixedTeam: GeneratedPair = {
        player1: p1,
        player2: p2,
        strength: p1.effectiveRating + p2.effectiveRating,
        structure: Math.abs(p1.effectiveRating - p2.effectiveRating),
        cost: 0 
    };

    // 2. Candidate Pairs from Pool
    const pool = poolIds.map(id => playerForms.get(String(id))).filter(p => p !== undefined) as PlayerForm[];
    const candidatePairs: GeneratedPair[] = [];

    for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
            const opp1 = pool[i];
            const opp2 = pool[j];
            const pairCost = getPairingCost(opp1, opp2, synergyMatrix, new Set());

            candidatePairs.push({
                player1: opp1,
                player2: opp2,
                strength: opp1.effectiveRating + opp2.effectiveRating,
                structure: Math.abs(opp1.effectiveRating - opp2.effectiveRating),
                cost: pairCost
            });
        }
    }

    // 3. Match Cost
    const recentMatches = new Set<string>();
    const sortedMatches = [...allMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);
    sortedMatches.forEach(m => {
        if (m.team1.length === 2 && m.team2.length === 2) {
            recentMatches.add([...m.team1, ...m.team2].map(String).sort().join('-'));
        }
    });

    const rankedMatchups = candidatePairs.map(candidate => {
        let matchCost = 0;
        
        matchCost += 1.0 * Math.pow(fixedTeam.strength - candidate.strength, 2);
        matchCost += 0.7 * Math.pow(fixedTeam.structure - candidate.structure, 2);
        matchCost += candidate.cost * 0.5;

        // Score-aware blowout cost
        const expectedMarginRatio = clamp(Math.abs(fixedTeam.strength - candidate.strength) / 2.0, 0, 1);
        matchCost += 0.6 * Math.pow(expectedMarginRatio, 2);

        const allIds = [p1.id, p2.id, candidate.player1.id, candidate.player2.id].sort().join('-');
        if (recentMatches.has(allIds)) {
            matchCost += 50.0;
        }

        // --- HANDICAP ---
        const handicap = calculateHandicap(fixedTeam, candidate, allMatches);

        const pairKey = [candidate.player1.id, candidate.player2.id].sort().join('-');
        const syn = synergyMatrix.get(pairKey) || 0;
        const combinedForm = candidate.player1.form + candidate.player2.form;

        return {
            team1: fixedTeam,
            team2: candidate,
            matchCost,
            handicap,
            analysis: {
                team2Synergy: syn,
                team2Form: combinedForm,
                qualityScore: Math.max(0, 100 - matchCost)
            }
        } as GeneratedMatch;
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

// --- PREDICT MATCH OUTCOME ---
export const predictMatchOutcome = (
    team1Ids: string[],
    team2Ids: string[],
    allPlayers: Player[],
    allMatches: Match[]
): GeneratedMatch | null => {
    if (team1Ids.length === 0 || team2Ids.length === 0) return null;

    const playerForms = calculatePlayerForms(allPlayers, allMatches);
    
    const t1p1 = playerForms.get(String(team1Ids[0]));
    const t1p2 = team1Ids.length > 1 ? playerForms.get(String(team1Ids[1])) : null;
    if (!t1p1) return null;

    const t1Rating = t1p1.effectiveRating + (t1p2 ? t1p2.effectiveRating : 0);
    const t1Structure = t1p2 ? Math.abs(t1p1.effectiveRating - t1p2.effectiveRating) : 0;

    const team1Pair: GeneratedPair = {
        player1: t1p1,
        player2: t1p2 || t1p1,
        strength: t1Rating,
        structure: t1Structure,
        cost: 0,
        // @ts-ignore - Mocking forms for GeneratedPair type compatibility
    };

    const t2p1 = playerForms.get(String(team2Ids[0]));
    const t2p2 = team2Ids.length > 1 ? playerForms.get(String(team2Ids[1])) : null;
    if (!t2p1) return null;

    const t2Rating = t2p1.effectiveRating + (t2p2 ? t2p2.effectiveRating : 0);
    const t2Structure = t2p2 ? Math.abs(t2p1.effectiveRating - t2p2.effectiveRating) : 0;

    const team2Pair: GeneratedPair = {
        player1: t2p1,
        player2: t2p2 || t2p1,
        strength: t2Rating,
        structure: t2Structure,
        cost: 0
    };

    // --- HANDICAP ---
    const handicap = calculateHandicap(team1Pair, team2Pair, allMatches);

    const diff = Math.abs(team1Pair.strength - team2Pair.strength);
    const quality = Math.max(0, 100 - (diff * 50));

    return {
        team1: team1Pair,
        team2: team2Pair,
        matchCost: 0,
        handicap,
        analysis: {
            qualityScore: quality,
            team2Form: 0, 
            team2Synergy: 0 
        }
    };
};

export const runAutoMatchmaker = (
    selectedPlayerIds: string[],
    allPlayers: Player[],
    allMatches: Match[]
): AutoMatchResult => {
    const selectedPlayers = allPlayers.filter(p => selectedPlayerIds.includes(String(p.id)));
    if (selectedPlayers.length % 2 !== 0) {
        throw new Error("Số lượng người chơi phải là số chẵn.");
    }

    const playerForms = calculatePlayerForms(allPlayers, allMatches);
    const synergyMatrix = calculateSynergyMatrix(allMatches);

    const pool = selectedPlayers.map(p => playerForms.get(String(p.id))!);

    const sortedMatches = [...allMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
    const recentPairs = new Set<string>();
    const recentMatches = new Set<string>();

    sortedMatches.forEach(m => {
        if (m.team1.length === 2) recentPairs.add([...m.team1].map(String).sort().join('-'));
        if (m.team2.length === 2) recentPairs.add([...m.team2].map(String).sort().join('-'));
        if (m.team1.length === 2 && m.team2.length === 2) {
            recentMatches.add([...m.team1, ...m.team2].map(String).sort().join('-'));
        }
    });

    const pairs = generateOptimalPairs(pool, synergyMatrix, recentPairs);
    const matchesResult = generateMatchups(pairs, recentMatches, allMatches);

    return {
        players: pool,
        pairs,
        matches: matchesResult
    };
};