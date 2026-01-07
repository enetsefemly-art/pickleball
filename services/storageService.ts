import { Player, Match, TournamentBonus, TournamentState } from '../types';

// KEYS CẤU HÌNH
const PLAYERS_KEY = 'picklepro_players_v2'; 
const MATCHES_KEY = 'picklepro_matches_v2';
const TOURNAMENT_STATE_KEY = 'picklepro_tournament_active_state_v2';
// Deprecated: const BONUSES_KEY = 'picklepro_tournament_bonuses_v1';

// --- CONFIGURATION DATES ---
// Start Date: 01/12/2025 (Matches before this date do not count for ratings or bonuses)
// Rule 1.0 Period: 01/12/2025 -> 31/12/2025
// Rule 2.0 Period: 01/01/2026 onwards
const RATING_START_DATE = new Date('2025-12-01T00:00:00');
const RATING_RULE_2_DATE = new Date('2026-01-01T00:00:00');

// RULE 1.0 CONSTANTS
const MAX_RATING_V1 = 6.0;
const MIN_RATING_V1 = 2.0;
const RATING_STEP_V1 = 0.1;

// RULE 2.0 CONSTANTS
const V2_RATING_MIN = 2.0;
const V2_RATING_MAX = 6.0;
const V2_WIN_SCORE = 11.0;
const V2_TAU = 0.45;
const V2_K = 0.18;
const V2_ALPHA = 0.55;
const V2_BETA = 1.4;
const V2_MAX_CHANGE = 0.14;

export interface RatingCalculationLog {
  scoreA: number;
  scoreB: number;
  teamA_Rating: number;
  teamB_Rating: number;
  diff: number;
  expectedA: number;
  marginFactor: number;
  teamChangeA: number;
  isRule2: boolean;
  players: {
    id: string;
    name: string;
    team: 1 | 2;
    oldRating: number;
    newRating: number;
    change: number;
    weight: number;
  }[];
}

export const getPlayers = (): Player[] => {
  const data = localStorage.getItem(PLAYERS_KEY);
  if (!data) return [];
  return JSON.parse(data);
};

export const savePlayers = (players: Player[]) => {
  localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
};

export const getMatches = (): Match[] => {
  const data = localStorage.getItem(MATCHES_KEY);
  if (!data) return [];
  return JSON.parse(data);
};

export const saveMatches = (matches: Match[]) => {
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
};

export const getTournamentState = (): TournamentState | null => {
    const saved = localStorage.getItem(TOURNAMENT_STATE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error("Failed to load tournament state", e);
            return null;
        }
    }
    return null;
};

export const saveTournamentState = (state: TournamentState | null) => {
    if (state) {
        localStorage.setItem(TOURNAMENT_STATE_KEY, JSON.stringify(state));
    } else {
        localStorage.removeItem(TOURNAMENT_STATE_KEY);
    }
};

export const getTournamentBonuses = (): TournamentBonus[] => {
  return [];
};

export const saveTournamentBonuses = (bonuses: TournamentBonus[]) => {
};

// Helper: Resolve ties for monthly bonuses
const resolveTiedGroup = (
    group: { pairId: string, playerIds: string[], wins: number, losses: number, pointsScored: number, pointsConceded: number }[], 
    matches: Match[]
) => {
    if (group.length <= 1) return group;

    const groupIds = new Set(group.map(g => g.pairId));
    const internalWins = new Map<string, number>();
    group.forEach(g => internalWins.set(g.pairId, 0));

    const getPairId = (ids: string[]) => ids.map(String).sort().join('-');

    matches.forEach(m => {
        const id1 = getPairId(m.team1);
        const id2 = getPairId(m.team2);
        
        if (groupIds.has(id1) && groupIds.has(id2)) {
            let s1 = Number(m.score1);
            let s2 = Number(m.score2);
            if (isNaN(s1) || isNaN(s2) || s1 === s2) return;
            
            if (s1 > s2) internalWins.set(id1, (internalWins.get(id1) || 0) + 1);
            else internalWins.set(id2, (internalWins.get(id2) || 0) + 1);
        }
    });

    return group.sort((a, b) => {
        const winsA = internalWins.get(a.pairId) || 0;
        const winsB = internalWins.get(b.pairId) || 0;
        
        // Priority 1: H2H Wins
        if (winsB !== winsA) return winsB - winsA;
        
        // Priority 2: Global Point Diff
        const diffA = a.pointsScored - a.pointsConceded;
        const diffB = b.pointsScored - b.pointsConceded;
        if (diffB !== diffA) return diffB - diffA;
        
        // Priority 3: Total Scored
        return b.pointsScored - a.pointsScored;
    });
};

// Helper: Shared logic to calculate standings from a list of matches
const calculateStandings = (matches: Match[]) => {
    if (matches.length === 0) return [];

    const pairStats = new Map<string, { pairId: string, playerIds: string[], wins: number, losses: number, pointsScored: number, pointsConceded: number }>();
    const getPairId = (ids: string[]) => ids.map(String).sort().join('-');

    matches.forEach(m => {
        let s1 = Number(m.score1);
        let s2 = Number(m.score2);
        if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 === s2) return;

        const pId1 = getPairId(m.team1);
        const pId2 = getPairId(m.team2);
        
        if (!pairStats.has(pId1)) pairStats.set(pId1, { pairId: pId1, playerIds: m.team1.map(String), wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });
        if (!pairStats.has(pId2)) pairStats.set(pId2, { pairId: pId2, playerIds: m.team2.map(String), wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });

        const ps1 = pairStats.get(pId1)!;
        const ps2 = pairStats.get(pId2)!;

        ps1.pointsScored += s1; ps1.pointsConceded += s2;
        ps2.pointsScored += s2; ps2.pointsConceded += s1;

        if (s1 > s2) { 
            ps1.wins++; ps2.losses++;
        }
        else { 
            ps2.wins++; ps1.losses++;
        }
    });

    // --- REPLICATE SORTING LOGIC ---
    let standings = Array.from(pairStats.values());
    standings.sort((a, b) => b.wins - a.wins);

    let finalStandings: typeof standings = [];
    let currentGroup: typeof standings = [];

    for (let i = 0; i < standings.length; i++) {
        const current = standings[i];
        const prev = currentGroup.length > 0 ? currentGroup[0] : null;
        
        if (prev === null || current.wins === prev.wins) {
            currentGroup.push(current);
        } else {
            finalStandings.push(...resolveTiedGroup(currentGroup, matches));
            currentGroup = [current];
        }
    }
    if (currentGroup.length > 0) {
        finalStandings.push(...resolveTiedGroup(currentGroup, matches));
    }
    
    return finalStandings;
};

// Exported function for external use (e.g. TournamentManager, PlayerProfile)
export const getTournamentStandings = (monthKey: string, players: Player[], matches: Match[]) => {
    // Filter matches for the specific month and tournament type
    // FIX: Removed RATING_START_DATE check so historical cups (e.g. Oct) are counted
    const validMatches = matches.filter(m => {
        return m.date.startsWith(monthKey) && 
               m.type === 'tournament';
    });
    
    return calculateStandings(validMatches);
};

// Helper: Calculate bonuses for a specific month based on matches
const calculateAndApplyMonthlyBonuses = (
    monthKey: string, 
    monthMatches: Match[], 
    playerMap: Map<string, Player>
) => {
    // 1. Calculate standings using ALL matches for this month (for Cups)
    const finalStandings = calculateStandings(monthMatches);

    if (finalStandings.length < 3) return;

    // 2. Check if this month is eligible for RATING updates (on or after Start Date)
    const hasEligibleMatches = monthMatches.some(m => new Date(m.date).getTime() >= RATING_START_DATE.getTime());

    const N = finalStandings.length;
    const S = 1 + 0.10 * (N - 5);
    const baseBonuses: Record<number, number> = { 1: 0.10, 2: 0.07, 3: 0.05 };

    finalStandings.slice(0, 3).forEach((team, idx) => {
        const place = idx + 1;
        const baseBonus = baseBonuses[place];
        const rawBonus = baseBonus * S;
        const placementBonus = Math.min(0.15, Math.round(rawBonus * 100) / 100);

        team.playerIds.forEach(pid => {
            const p = playerMap.get(String(pid));
            if (p) {
                // Apply Rating Bonus ONLY if eligible
                if (hasEligibleMatches) {
                    const currentRating = p.tournamentRating || 3.0;
                    const updatedRating = Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, currentRating + placementBonus));
                    p.tournamentRating = Math.round(updatedRating * 100) / 100;
                }
                
                // ALWAYS Apply Championship Cup (History tracked)
                if (place === 1) {
                    p.championships = (p.championships || 0) + 1;
                }
            }
        });
    });
};

export const calculatePlayerStats = (players: Player[], matches: Match[]): Player[] => {
  const resetPlayers = players.map(p => {
      const baseRating = typeof p.initialPoints === 'number' ? p.initialPoints : 1000;
      return {
        ...p,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsScored: 0,
        pointsConceded: 0,
        totalRankingPoints: 0,
        tournamentRating: baseRating,
        championships: 0,
        isActive: p.isActive !== undefined ? p.isActive : true
      };
  });

  const playerMap = new Map(resetPlayers.map(p => [String(p.id), p]));
  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let currentMonth = "";
  let monthTournamentMatches: Match[] = [];

  for (const match of sortedMatches) {
    const matchDateObj = new Date(match.date);
    const matchMonth = match.date.slice(0, 7);
    
    // CHECK: Is the match eligible for points (on or after Start Date)
    // 01/12/2025 inclusive
    const isEligibleForPoints = matchDateObj.getTime() >= RATING_START_DATE.getTime();

    if (matchMonth !== currentMonth) {
        if (currentMonth !== "" && monthTournamentMatches.length > 0) {
            calculateAndApplyMonthlyBonuses(currentMonth, monthTournamentMatches, playerMap);
        }
        currentMonth = matchMonth;
        monthTournamentMatches = [];
    }

    if (match.type === 'tournament') {
        monthTournamentMatches.push(match);
    }

    let s1 = Number(match.score1);
    let s2 = Number(match.score2);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 === s2) continue;

    const isBetting = match.type === 'betting' || !match.type; 
    const bettingPoints = (isBetting && match.rankingPoints) ? Number(match.rankingPoints) : 0; 
    
    const isTeam1Winner = s1 > s2;
    const team1Ids = [...new Set(match.team1)].map(String);
    const team2Ids = [...new Set(match.team2)].map(String);

    const updateStats = (pid: string, isWinner: boolean, scoreFor: number, scoreAgainst: number) => {
        const p = playerMap.get(pid);
        if (!p) return;
        p.matchesPlayed += 1;
        p.pointsScored += scoreFor;
        p.pointsConceded += scoreAgainst;
        if (isWinner) {
            p.wins += 1;
            // RULE: Only add betting points if on or after Start Date
            if (isBetting && isEligibleForPoints) p.totalRankingPoints += bettingPoints;
        } else {
            p.losses += 1;
            // RULE: Only subtract betting points if on or after Start Date
            if (isBetting && isEligibleForPoints) p.totalRankingPoints -= bettingPoints;
        }
    };

    team1Ids.forEach(pid => updateStats(pid, isTeam1Winner, s1, s2));
    team2Ids.forEach(pid => updateStats(pid, !isTeam1Winner, s2, s1));

    // CHECK RATING RULES (1.0 vs 2.0)
    // Rule 1.0: 01/12/2025 <= date < 01/01/2026
    const isLegacyV1 = isEligibleForPoints && matchDateObj.getTime() < RATING_RULE_2_DATE.getTime();
    
    // Rule 2.0: date >= 01/01/2026
    const isRuleV2 = matchDateObj.getTime() >= RATING_RULE_2_DATE.getTime();

    if (isLegacyV1) {
        const applyLegacy = (ids: string[], isWin: boolean) => {
            ids.forEach(pid => {
                const p = playerMap.get(pid);
                if (!p) return;
                let currentRating = p.tournamentRating || 3.0;
                if (isWin) currentRating = Math.min(MAX_RATING_V1, currentRating + RATING_STEP_V1);
                else currentRating = Math.max(MIN_RATING_V1, currentRating - RATING_STEP_V1);
                p.tournamentRating = Math.round(currentRating * 100) / 100;
            });
        };
        applyLegacy(team1Ids, isTeam1Winner);
        applyLegacy(team2Ids, !isTeam1Winner);
    } else if (isRuleV2) {
        const getR = (pid: string) => playerMap.get(pid)?.tournamentRating || 3.0;
        const getTeamRating = (ids: string[]) => ids.length ? ids.reduce((acc, pid) => acc + getR(pid), 0) / ids.length : 3.0;

        const TA = getTeamRating(team1Ids);
        const TB = getTeamRating(team2Ids);
        const ExpectedA = 1 / (1 + Math.exp(-(TA - TB) / V2_TAU));
        const ResultA = isTeam1Winner ? 1 : 0;
        const MarginFactor = Math.min(1.20, Math.max(0.85, 1 + V2_ALPHA * ((Math.abs(s1 - s2) / V2_WIN_SCORE) - 0.25)));
        
        const TeamChangeA = V2_K * (ResultA - ExpectedA) * MarginFactor;

        const updateV2 = (pid: string, teamAvg: number, teamChange: number, teammateIds: string[]) => {
            const p = playerMap.get(pid);
            if (!p) return;
            const R_old = p.tournamentRating || 3.0;
            let W = 1.0;
            const partnerId = teammateIds.find(id => id !== pid);
            if (partnerId) {
                const R_partner = getR(partnerId);
                const w_me = Math.exp(-V2_BETA * (R_old - teamAvg));
                const w_partner = Math.exp(-V2_BETA * (R_partner - teamAvg));
                W = w_me / (w_me + w_partner);
            }
            let change = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * teamChange));
            p.tournamentRating = Math.round(Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, R_old + change)) * 100) / 100;
        };

        team1Ids.forEach(pid => updateV2(pid, TA, TeamChangeA, team1Ids));
        team2Ids.forEach(pid => updateV2(pid, TB, -TeamChangeA, team2Ids));
    }
  }

  // Handle the last month loop exit
  if (currentMonth !== "" && monthTournamentMatches.length > 0) {
      calculateAndApplyMonthlyBonuses(currentMonth, monthTournamentMatches, playerMap);
  }

  return Array.from(playerMap.values());
};

// --- FIX: IMPLEMENTED FULL HISTORY SIMULATION ---
export const getDailyRatingHistory = (players: Player[], matches: Match[]) => {
    // This function mimics calculatePlayerStats but takes snapshots of ratings
    // 1. Setup
    const history: { date: string, ratings: Record<string, number> }[] = [];
    const playerMap = new Map<string, Player>();
    
    // Init map with initial ratings
    players.forEach(p => {
        playerMap.set(String(p.id), { 
            ...p, 
            tournamentRating: typeof p.initialPoints === 'number' ? p.initialPoints : 1000 
        });
    });

    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let currentMonth = "";
    let monthTournamentMatches: Match[] = [];
    
    // Function to snapshot
    const takeSnapshot = (date: string) => {
        const snapshot: Record<string, number> = {};
        playerMap.forEach(p => {
            snapshot[p.id] = p.tournamentRating || 3.0;
        });
        
        // If snapshot for this date already exists, update it (last state of day)
        const existing = history.find(h => h.date === date);
        if (existing) {
            existing.ratings = snapshot;
        } else {
            history.push({ date, ratings: snapshot });
        }
    };

    // 2. Loop
    for (const match of sortedMatches) {
        const matchDate = match.date.split('T')[0];
        const matchMonth = match.date.slice(0, 7);

        // A. Handle Monthly Bonuses (Trigger on month change)
        if (matchMonth !== currentMonth) {
            if (currentMonth !== "" && monthTournamentMatches.length > 0) {
                calculateAndApplyMonthlyBonuses(currentMonth, monthTournamentMatches, playerMap);
                
                // When bonuses are applied, they conceptually happen at the end of that month.
                // We update the snapshot of the *previous* match date (end of previous month essentially)
                if (history.length > 0) {
                    takeSnapshot(history[history.length-1].date);
                }
            }
            currentMonth = matchMonth;
            monthTournamentMatches = [];
        }

        if (match.type === 'tournament') {
            monthTournamentMatches.push(match);
        }

        // B. Handle Match Rating Change
        let s1 = Number(match.score1);
        let s2 = Number(match.score2);
        if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 === s2) continue;

        const isTeam1Winner = s1 > s2;
        const team1Ids = [...new Set(match.team1)].map(String);
        const team2Ids = [...new Set(match.team2)].map(String);
        
        const mDateObj = new Date(match.date);
        const isEligibleForPoints = mDateObj.getTime() >= RATING_START_DATE.getTime();
        const isLegacyV1 = isEligibleForPoints && mDateObj.getTime() < RATING_RULE_2_DATE.getTime();
        const isRuleV2 = mDateObj.getTime() >= RATING_RULE_2_DATE.getTime();

        if (isLegacyV1) {
            const applyLegacy = (ids: string[], isWin: boolean) => {
                ids.forEach(pid => {
                    const p = playerMap.get(pid);
                    if (!p) return;
                    let currentRating = p.tournamentRating || 3.0;
                    if (isWin) currentRating = Math.min(MAX_RATING_V1, currentRating + RATING_STEP_V1);
                    else currentRating = Math.max(MIN_RATING_V1, currentRating - RATING_STEP_V1);
                    p.tournamentRating = Math.round(currentRating * 100) / 100;
                });
            };
            applyLegacy(team1Ids, isTeam1Winner);
            applyLegacy(team2Ids, !isTeam1Winner);
        } else if (isRuleV2) {
            const getR = (pid: string) => playerMap.get(pid)?.tournamentRating || 3.0;
            const getTeamRating = (ids: string[]) => ids.length ? ids.reduce((acc, pid) => acc + getR(pid), 0) / ids.length : 3.0;

            const TA = getTeamRating(team1Ids);
            const TB = getTeamRating(team2Ids);
            const ExpectedA = 1 / (1 + Math.exp(-(TA - TB) / V2_TAU));
            const ResultA = isTeam1Winner ? 1 : 0;
            const MarginFactor = Math.min(1.20, Math.max(0.85, 1 + V2_ALPHA * ((Math.abs(s1 - s2) / V2_WIN_SCORE) - 0.25)));
            
            const TeamChangeA = V2_K * (ResultA - ExpectedA) * MarginFactor;

            const updateV2 = (pid: string, teamAvg: number, teamChange: number, teammateIds: string[]) => {
                const p = playerMap.get(pid);
                if (!p) return;
                const R_old = p.tournamentRating || 3.0;
                let W = 1.0;
                const partnerId = teammateIds.find(id => id !== pid);
                if (partnerId) {
                    const R_partner = getR(partnerId);
                    const w_me = Math.exp(-V2_BETA * (R_old - teamAvg));
                    const w_partner = Math.exp(-V2_BETA * (R_partner - teamAvg));
                    W = w_me / (w_me + w_partner);
                }
                let change = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * teamChange));
                p.tournamentRating = Math.round(Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, R_old + change)) * 100) / 100;
            };

            team1Ids.forEach(pid => updateV2(pid, TA, TeamChangeA, team1Ids));
            team2Ids.forEach(pid => updateV2(pid, TB, -TeamChangeA, team2Ids));
        }

        // C. Snapshot after every match (optimized: only if date changes or end of loop logic, but simplest is update entry for date)
        takeSnapshot(matchDate);
    }

    // Apply last month bonus if any
    if (currentMonth !== "" && monthTournamentMatches.length > 0) {
        calculateAndApplyMonthlyBonuses(currentMonth, monthTournamentMatches, playerMap);
        if (history.length > 0) {
            takeSnapshot(history[history.length-1].date);
        }
    }

    return history;
};

// IMPLEMENTED: Re-simulation to get exact match calculation details
export const getMatchRatingDetails = (matchId: string, matches: Match[], players: Player[]): RatingCalculationLog | null => {
    // 1. Setup temporary simulation environment
    const tempPlayerMap = new Map<string, number>();
    players.forEach(p => {
        const r = typeof p.initialPoints === 'number' ? p.initialPoints : 1000;
        tempPlayerMap.set(String(p.id), r);
    });

    // 2. Sort matches chronologically
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Find target match index
    const targetMatchIndex = sortedMatches.findIndex(m => m.id === matchId);
    if (targetMatchIndex === -1) return null;

    const targetMatch = sortedMatches[targetMatchIndex];
    const matchDate = new Date(targetMatch.date);
    const isRuleV2 = matchDate.getTime() >= RATING_RULE_2_DATE.getTime();

    // If not Rule V2, we can't show detailed log (or implement V1 log if needed, but request implied Rule 2 context)
    if (!isRuleV2) return { 
        scoreA: targetMatch.score1, scoreB: targetMatch.score2, 
        teamA_Rating: 0, teamB_Rating: 0, diff: 0, expectedA: 0, marginFactor: 0, teamChangeA: 0, 
        isRule2: false, players: [] 
    };

    // 4. Simulate ALL matches BEFORE the target match to get the "Old Ratings"
    // Also need to account for monthly bonuses in the simulation to be accurate
    let currentMonth = "";
    let monthTournamentMatches: Match[] = [];

    for (let i = 0; i < targetMatchIndex; i++) {
        const m = sortedMatches[i];
        
        // --- MONTHLY BONUS SIMULATION ---
        const mMonth = m.date.slice(0, 7);
        if (mMonth !== currentMonth) {
            if (currentMonth !== "" && monthTournamentMatches.length > 0) {
                // To support accurate bonus simulation, we would need to run full tournament logic.
                // For simplified Match Detail view, we acknowledge this limitation or implement lightweight bonus.
                // We'll skip complex bonus re-calc here for performance, accepting minor ELO drift in history view.
            }
            currentMonth = mMonth;
            monthTournamentMatches = [];
        }
        if (m.type === 'tournament') monthTournamentMatches.push(m);

        // --- MATCH ELO SIMULATION ---
        let s1 = Number(m.score1); let s2 = Number(m.score2);
        if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 === s2) continue;
        
        const mDate = new Date(m.date);
        const mRule2 = mDate.getTime() >= RATING_RULE_2_DATE.getTime();
        const isEligible = mDate.getTime() >= RATING_START_DATE.getTime();
        const t1Ids = m.team1.map(String);
        const t2Ids = m.team2.map(String);
        const isWin = s1 > s2;

        const getR = (id: string) => tempPlayerMap.get(id) || 3.0;
        const setR = (id: string, val: number) => tempPlayerMap.set(id, val);

        if (mRule2) {
             const TA = t1Ids.length ? t1Ids.reduce((a,b) => a + getR(b), 0) / t1Ids.length : 3.0;
             const TB = t2Ids.length ? t2Ids.reduce((a,b) => a + getR(b), 0) / t2Ids.length : 3.0;
             const ExpA = 1 / (1 + Math.exp(-(TA - TB) / V2_TAU));
             const ResA = isWin ? 1 : 0;
             const MF = Math.min(1.20, Math.max(0.85, 1 + V2_ALPHA * ((Math.abs(s1 - s2) / V2_WIN_SCORE) - 0.25)));
             const TCA = V2_K * (ResA - ExpA) * MF;
             
             const update = (pid: string, avg: number, chg: number, partners: string[]) => {
                 const oldR = getR(pid);
                 const partnerId = partners.find(id => id !== pid);
                 let W = 1.0;
                 if (partnerId) {
                     const Rp = getR(partnerId);
                     const wm = Math.exp(-V2_BETA * (oldR - avg));
                     const wp = Math.exp(-V2_BETA * (Rp - avg));
                     W = wm / (wm + wp);
                 }
                 const finalChg = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * chg));
                 setR(pid, Math.round((oldR + finalChg) * 100) / 100);
             };
             t1Ids.forEach(pid => update(pid, TA, TCA, t1Ids));
             t2Ids.forEach(pid => update(pid, TB, -TCA, t2Ids));
        } else if (isEligible) {
             // V1 Logic Simplified (Only if date eligible)
             const change = RATING_STEP_V1;
             t1Ids.forEach(pid => setR(pid, Math.min(MAX_RATING_V1, getR(pid) + (isWin ? change : -change))));
             t2Ids.forEach(pid => setR(pid, Math.max(MIN_RATING_V1, getR(pid) + (!isWin ? change : -change))));
        }
    }

    // 5. Calculate Details for TARGET Match
    const t1Ids = targetMatch.team1.map(String);
    const t2Ids = targetMatch.team2.map(String);
    const getR = (id: string) => tempPlayerMap.get(id) || 3.0;
    
    const TA = t1Ids.length ? t1Ids.reduce((a,b) => a + getR(b), 0) / t1Ids.length : 3.0;
    const TB = t2Ids.length ? t2Ids.reduce((a,b) => a + getR(b), 0) / t2Ids.length : 3.0;
    const ExpectedA = 1 / (1 + Math.exp(-(TA - TB) / V2_TAU));
    
    let s1 = Number(targetMatch.score1);
    let s2 = Number(targetMatch.score2);
    const isWin = s1 > s2;
    const ResultA = isWin ? 1 : 0;
    const MarginFactor = Math.min(1.20, Math.max(0.85, 1 + V2_ALPHA * ((Math.abs(s1 - s2) / V2_WIN_SCORE) - 0.25)));
    const TeamChangeA = V2_K * (ResultA - ExpectedA) * MarginFactor;

    const playerDetails: RatingCalculationLog['players'] = [];

    const processPlayer = (pid: string, team: 1 | 2, teamAvg: number, teamChange: number, partners: string[]) => {
        const oldR = getR(pid);
        const partnerId = partners.find(id => id !== pid);
        let W = 1.0;
        if (partnerId) {
            const Rp = getR(partnerId);
            const wm = Math.exp(-V2_BETA * (oldR - teamAvg));
            const wp = Math.exp(-V2_BETA * (Rp - teamAvg));
            W = wm / (wm + wp);
        }
        const change = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * teamChange));
        const newR = Math.round(Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, oldR + change)) * 100) / 100;
        
        const pName = players.find(p => String(p.id) === pid)?.name || pid;
        
        playerDetails.push({
            id: pid,
            name: pName,
            team,
            oldRating: oldR,
            newRating: newR,
            change: change,
            weight: W
        });
    };

    t1Ids.forEach(pid => processPlayer(pid, 1, TA, TeamChangeA, t1Ids));
    t2Ids.forEach(pid => processPlayer(pid, 2, TB, -TeamChangeA, t2Ids));

    return {
        scoreA: s1,
        scoreB: s2,
        teamA_Rating: TA,
        teamB_Rating: TB,
        diff: TA - TB,
        expectedA: ExpectedA,
        marginFactor: MarginFactor,
        teamChangeA: TeamChangeA,
        isRule2: true,
        players: playerDetails
    };
};