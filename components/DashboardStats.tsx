import React, { useMemo, useState } from 'react';
import { Match, Player } from '../types';
import { Card } from './Card';
import { Trophy, TrendingUp, Users, Banknote, Medal, Calendar, Grid3X3, Filter, Award, TrendingDown, Activity, Minus, Scale, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, ArrowUpDown, Percent, Hash } from 'lucide-react';
import { HeadToHeadMatrix } from './HeadToHeadMatrix';
import { getDailyRatingHistory } from '../services/storageService';

interface DashboardStatsProps {
  matches: Match[];
  players: Player[];
}

interface IndStat {
  wins: number;
  matches: number;
  bettingPoints: number;
}

interface PairStat {
  id: string;
  ids: string[];
  names: string;
  wins: number;
  matches: number;
  type: 'betting' | 'tournament';
  bettingPoints: number;
}

// Handicap Stats Interface
interface HandicapCategoryStats {
    total: number;
    wins: number;
}

interface PlayerHandicapStats {
    id: string;
    name: string;
    balanced: HandicapCategoryStats;
    underdog: HandicapCategoryStats;
    favorite: HandicapCategoryStats;
}

type SortMetric = 'count' | 'rate';
type SortDirection = 'asc' | 'desc';
type SortKey = 'name' | 'total' | 'balanced' | 'underdog' | 'favorite';

export const DashboardStats: React.FC<DashboardStatsProps> = ({ matches, players }) => {
  // Added 'all' to allowed state types
  const [winrateTab, setWinrateTab] = useState<'betting' | 'tournament' | 'all'>('all');
  
  // Helper to get current month key YYYY-MM
  const currentMonthKey = new Date().toISOString().slice(0, 7);

  // Win Rate Table Time Filter (Default: Current Month)
  const [winRateTimeFilter, setWinRateTimeFilter] = useState<string>(currentMonthKey);

  // Handicap Table Time Filter (Default: Current Month) - Independent
  const [handicapTimeFilter, setHandicapTimeFilter] = useState<string>(currentMonthKey);
  
  // Handicap Sorting State
  const [handicapSortKey, setHandicapSortKey] = useState<SortKey>('total');
  const [handicapSortDir, setHandicapSortDir] = useState<SortDirection>('desc');
  const [handicapSortMetric, setHandicapSortMetric] = useState<SortMetric>('count'); // 'count' or 'rate'

  // Matrix Filter State (H2H)
  const [matrixTimeFilter, setMatrixTimeFilter] = useState<'all' | 'month'>('all');

  // Matrix Filter State (Rating Exchange)
  const [ratingExchangeFilter, setRatingExchangeFilter] = useState<'all' | 'month'>('all');
  
  // Create a lookup map, ensuring keys are always Strings
  const playerLookup = useMemo(() => new Map(players.map(p => [String(p.id), p])), [players]);

  // Filter out inactive players for highlights and tables
  const activePlayers = useMemo(() => players.filter(p => p.isActive !== false), [players]);
  const activePlayerIds = useMemo(() => new Set(activePlayers.map(p => String(p.id))), [activePlayers]);

  // --- GET AVAILABLE MONTHS FOR DROPDOWN ---
  const availableMonths = useMemo(() => {
      const months = new Set<string>();
      matches.forEach(m => months.add(m.date.slice(0, 7)));
      // Add current month if not exists (for empty state)
      months.add(currentMonthKey);
      return Array.from(months).sort().reverse();
  }, [matches, currentMonthKey]);

  // --- GLOBAL MONTHLY CALCULATION (Keep for Highlights & Financials) ---
  const stats = useMemo<{ indStats: Map<string, IndStat>; pairStats: Map<string, PairStat> }>(() => {
    const monthMatches = matches.filter(m => m.date.startsWith(currentMonthKey));

    // 1. Individual Stats (For Highlights)
    const indStats = new Map<string, IndStat>();
    
    // 2. Pair Stats (For Betting Table Only now)
    const pairStats = new Map<string, PairStat>();

    // Ensure IDs are strings before processing
    const getPairId = (ids: string[]) => ids.map(String).sort().join('-');
    const getPairName = (ids: string[]) => ids.map(id => playerLookup.get(String(id))?.name || 'Unknown').join(' & ');

    // Initialize Individual Stats for ACTIVE players only
    activePlayers.forEach(p => indStats.set(String(p.id), { wins: 0, matches: 0, bettingPoints: 0 }));

    monthMatches.forEach(match => {
        const type = match.type || 'betting';
        const points = (type === 'betting' && match.rankingPoints) ? match.rankingPoints : 0;
        
        let s1 = Number(match.score1);
        let s2 = Number(match.score2);
        if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
        
        // STRICT: Ignore draws
        if (s1 === s2) return;

        const isTeam1Win = s1 > s2;

        // --- Process Individuals ---
        [...match.team1, ...match.team2].forEach(pid => {
            const s = indStats.get(String(pid));
            // Only update if player is active (s exists)
            if (s) {
                s.matches++;
                // Check inclusion using String comparison to be safe
                const isPInTeam1 = match.team1.map(String).includes(String(pid));
                const didWin = (isPInTeam1 && isTeam1Win) || (!isPInTeam1 && !isTeam1Win);
                
                if (didWin) {
                    s.wins++;
                    if (type === 'betting') s.bettingPoints += points;
                } else {
                    if (type === 'betting') s.bettingPoints -= points;
                }
            }
        });

        // --- Process Pairs ---
        // Only process pairs where BOTH players are active
        const processPair = (teamIds: string[], isWinner: boolean) => {
            if (teamIds.length === 0) return;
            // Check active status
            if (!teamIds.every(id => activePlayerIds.has(String(id)))) return;

            // Create a unique key combining Pair ID + Match Type so we can split tables later
            const pairId = getPairId(teamIds);
            const key = `${pairId}_${type}`; 
            
            if (!pairStats.has(key)) {
                pairStats.set(key, { 
                    id: pairId, 
                    ids: teamIds,
                    names: getPairName(teamIds), 
                    wins: 0, 
                    matches: 0, 
                    type: type,
                    bettingPoints: 0
                });
            }
            
            const ps = pairStats.get(key)!;
            ps.matches++;
            if (isWinner) {
                ps.wins++;
                if (type === 'betting') ps.bettingPoints += points;
            } else {
                if (type === 'betting') ps.bettingPoints -= points;
            }
        };

        processPair(match.team1, isTeam1Win);
        processPair(match.team2, !isTeam1Win);
    });

    return { indStats, pairStats };
  }, [matches, activePlayers, currentMonthKey, playerLookup, activePlayerIds]);


  // --- EXTRACT HIGHLIGHTS ---
  
  // 1. Tốp Nộp (Lowest Betting Points) - Replaced Best Player
  const topNopPlayer = useMemo(() => {
    let worst = { name: 'Chưa có', points: Infinity };
    stats.indStats.forEach((s, id) => {
        if (s.matches > 0 && s.bettingPoints < worst.points) {
             // Ensure String ID lookup
             worst = { name: playerLookup.get(String(id))?.name || 'Unknown', points: s.bettingPoints };
        }
    });
    return worst.points === Infinity ? { name: 'Chưa có', points: 0 } : worst;
  }, [stats.indStats, playerLookup]);

  // 2. Best Betting Pair (Cặp Đôi Bú) - Highest Betting Points
  const bestBettingPair = useMemo(() => {
    let best = { names: 'Chưa có', points: -Infinity, matches: 0 };
    stats.pairStats.forEach((p) => {
        // Only check betting type
        if (p.type === 'betting' && p.matches > 0) {
            if (p.bettingPoints > best.points) {
                best = { names: p.names, points: p.bettingPoints, matches: p.matches };
            }
        }
    });
    return best.points === -Infinity ? { names: 'Chưa có', points: 0, matches: 0 } : best;
  }, [stats.pairStats]);

  // 3. Highest Betting Points Player
  const kingOfBetting = useMemo(() => {
    let best = { name: 'Chưa có', points: -Infinity };
    stats.indStats.forEach((s, id) => {
        if (s.bettingPoints > best.points && s.matches > 0) {
             // Ensure String ID lookup
             best = { name: playerLookup.get(String(id))?.name || 'Unknown', points: s.bettingPoints };
        }
    });
    return best.points === -Infinity ? { name: 'Chưa có', points: 0 } : best;
  }, [stats.indStats, playerLookup]);


  // --- INDEPENDENT CALCULATION FOR WIN RATE TABLE (To support Time Filter) ---
  const winrateTableData = useMemo(() => {
    // We calculate from scratch using 'matches' to allow "All Time" or specific months
    // independent of the global dashboard month filter.
    
    // 1. Filter Matches by Time
    let filteredMatches = matches;
    if (winRateTimeFilter !== 'all') {
        filteredMatches = matches.filter(m => m.date.startsWith(winRateTimeFilter));
    }

    // 2. Filter by Type Tab
    if (winrateTab !== 'all') {
        filteredMatches = filteredMatches.filter(m => (m.type || 'betting') === winrateTab);
    }

    const pairMap = new Map<string, { id: string, names: string, wins: number, matches: number }>();
    const getPairId = (ids: string[]) => ids.map(String).sort().join('-');
    const getPairName = (ids: string[]) => ids.map(id => playerLookup.get(String(id))?.name || 'Unknown').join(' & ');

    filteredMatches.forEach(m => {
        let s1 = Number(m.score1);
        let s2 = Number(m.score2);
        if (isNaN(s1) || isNaN(s2) || s1 === s2) return;

        const isTeam1Win = s1 > s2;

        const process = (ids: string[], isWin: boolean) => {
            // Must allow pairs even if one player is inactive? No, consistent with other tables
            if (ids.length !== 2) return;
            if (!ids.every(id => activePlayerIds.has(String(id)))) return;

            const pId = getPairId(ids);
            if (!pairMap.has(pId)) {
                pairMap.set(pId, { id: pId, names: getPairName(ids), wins: 0, matches: 0 });
            }
            const s = pairMap.get(pId)!;
            s.matches++;
            if (isWin) s.wins++;
        };

        process(m.team1.map(String), isTeam1Win);
        process(m.team2.map(String), !isTeam1Win);
    });

    return Array.from(pairMap.values()).sort((a, b) => {
        const wrA = a.matches ? (a.wins / a.matches) : 0;
        const wrB = b.matches ? (b.wins / b.matches) : 0;
        if (wrB !== wrA) return wrB - wrA;
        return b.matches - a.matches;
    });
  }, [matches, winRateTimeFilter, winrateTab, playerLookup, activePlayerIds]);

  // --- NEW: HANDICAP STATS CALCULATION (Independent Filter + Form Included) ---
  const handicapStatsData = useMemo(() => {
      // 1. Simulation Setup
      const currentRatings = new Map<string, number>();
      activePlayers.forEach(p => currentRatings.set(String(p.id), p.initialPoints || 1000));

      // History tracker for Form: ID -> array of boolean (last 5 results: win=true, loss=false)
      const playerHistory = new Map<string, boolean[]>();

      const statsMap = new Map<string, PlayerHandicapStats>();
      activePlayers.forEach(p => {
          statsMap.set(String(p.id), {
              id: String(p.id),
              name: p.name,
              balanced: { total: 0, wins: 0 },
              underdog: { total: 0, wins: 0 },
              favorite: { total: 0, wins: 0 }
          });
      });

      // 2. Sort all matches chronologically
      const allSortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Helper to calculate form
      const getForm = (pid: string) => {
          const hist = playerHistory.get(pid) || [];
          if (hist.length === 0) return 0;
          // Simple form: Win Rate of last 5 matches.
          // 100% win = +0.25, 0% win = -0.25
          const wins = hist.filter(Boolean).length;
          const winRate = wins / hist.length;
          return (winRate - 0.5) * 0.5; // Scale to +/- 0.25
      };

      // 3. Iterate
      allSortedMatches.forEach(m => {
          // EXCLUDE TOURNAMENT MATCHES FROM THIS STATS ENTIRELY
          if (m.type === 'tournament') return;

          let s1 = Number(m.score1);
          let s2 = Number(m.score2);
          if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
          if (s1 === s2) return; // Skip draws

          const team1Ids = m.team1.map(String);
          const team2Ids = m.team2.map(String);
          
          // Current Ratings
          const getR = (id: string) => currentRatings.get(id) || 1000;
          
          // Calculate Average Team Rating INCLUDING FORM
          const t1Avg = team1Ids.reduce((sum, id) => sum + getR(id) + getForm(id), 0) / (team1Ids.length || 1);
          const t2Avg = team2Ids.reduce((sum, id) => sum + getR(id) + getForm(id), 0) / (team2Ids.length || 1);
          
          const diff = t1Avg - t2Avg;
          
          const isTeam1Win = s1 > s2;
          
          // Check if match should be counted in Stats
          let shouldCount = true;
          if (handicapTimeFilter !== 'all' && !m.date.startsWith(handicapTimeFilter)) shouldCount = false;

          // Update Stats
          if (shouldCount) {
              const processPlayer = (pid: string, isTeam1: boolean) => {
                  if (!activePlayerIds.has(pid)) return;
                  const pStats = statsMap.get(pid);
                  if (!pStats) return;

                  const isWin = isTeam1 ? isTeam1Win : !isTeam1Win;
                  
                  let category: 'balanced' | 'underdog' | 'favorite' = 'balanced';
                  
                  if (Math.abs(diff) <= 0.25) {
                      category = 'balanced';
                  } else {
                      if (isTeam1) {
                          category = diff > 0.25 ? 'favorite' : 'underdog';
                      } else {
                          category = diff > 0.25 ? 'underdog' : 'favorite';
                      }
                  }

                  pStats[category].total++;
                  if (isWin) pStats[category].wins++;
              };

              team1Ids.forEach(pid => processPlayer(pid, true));
              team2Ids.forEach(pid => processPlayer(pid, false));
          }

          // Update Ratings (Simplified ELO)
          const isEligibleForRating = new Date(m.date) >= new Date('2025-12-01');
          if (isEligibleForRating) {
             const V2_K = 0.18;
             const expectedA = 1 / (1 + Math.exp(-(diff) / 0.45)); // using diff with form here implies match prediction uses form, which is correct for ELO
             const resultA = isTeam1Win ? 1 : 0;
             const change = V2_K * (resultA - expectedA); 
             
             team1Ids.forEach(pid => currentRatings.set(pid, (currentRatings.get(pid)||1000) + change));
             team2Ids.forEach(pid => currentRatings.set(pid, (currentRatings.get(pid)||1000) - change));
          }

          // Update History for Form
          const updateHistory = (ids: string[], win: boolean) => {
              ids.forEach(pid => {
                  if (!playerHistory.has(pid)) playerHistory.set(pid, []);
                  const h = playerHistory.get(pid)!;
                  h.push(win);
                  if (h.length > 5) h.shift(); // Keep last 5
              });
          };
          updateHistory(team1Ids, isTeam1Win);
          updateHistory(team2Ids, !isTeam1Win);
      });

      const filteredList = Array.from(statsMap.values())
          .filter(p => (p.balanced.total + p.underdog.total + p.favorite.total) > 0);

      // --- SORTING LOGIC ---
      const sortedList = filteredList.sort((a, b) => {
          let valA = 0;
          let valB = 0;

          const getRate = (wins: number, total: number) => total > 0 ? (wins / total) : 0;

          if (handicapSortKey === 'name') {
              return handicapSortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
          } else if (handicapSortKey === 'total') {
              valA = a.balanced.total + a.underdog.total + a.favorite.total;
              valB = b.balanced.total + b.underdog.total + b.favorite.total;
          } else {
              // Sorting by specific category columns (Balanced, Underdog, Favorite)
              // Depends on metric: count vs rate
              const catA = a[handicapSortKey];
              const catB = b[handicapSortKey];
              
              if (handicapSortMetric === 'count') {
                  valA = catA.total;
                  valB = catB.total;
              } else {
                  valA = getRate(catA.wins, catA.total);
                  valB = getRate(catB.wins, catB.total);
              }
          }

          if (valA !== valB) {
              return handicapSortDir === 'asc' ? valA - valB : valB - valA;
          }
          return 0; // Fallback?
      });

      return sortedList;

  }, [matches, activePlayers, activePlayerIds, handicapTimeFilter, handicapSortKey, handicapSortDir, handicapSortMetric]);

  // --- NEW: HANDICAP SORT HANDLER ---
  const handleHandicapSort = (key: SortKey) => {
      if (handicapSortKey === key) {
          setHandicapSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
          setHandicapSortKey(key);
          setHandicapSortDir('desc');
      }
  };

  // --- NEW: RATING EXCHANGE MATRIX CALCULATION ---
  const ratingMatrixData = useMemo(() => {
      // 1. Setup Simulation (Similar to handicap but we need granular deltas)
      const currentRatings = new Map<string, number>();
      activePlayers.forEach(p => currentRatings.set(String(p.id), p.initialPoints || 1000));
      
      // Structure: Map<PlayerId, Map<OpponentId, number>> (Net points gained from opponent)
      const matrix = new Map<string, Map<string, number>>();
      
      const ensureInit = (p1: string, p2: string) => {
          if (!matrix.has(p1)) matrix.set(p1, new Map());
          if (!matrix.get(p1)!.has(p2)) matrix.get(p1)!.set(p2, 0);
      };

      const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      sortedMatches.forEach(m => {
          const isEligibleForRating = new Date(m.date) >= new Date('2025-12-01');
          // We assume we want to track rating exchange regardless of type (Betting/Tournament) 
          // as long as it affected rating.
          // Check filter time for DISPLAY accumulation
          let shouldCount = true;
          if (ratingExchangeFilter === 'month' && !m.date.startsWith(currentMonthKey)) shouldCount = false;

          let s1 = Number(m.score1);
          let s2 = Number(m.score2);
          if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
          if (s1 === s2) return;

          const t1Ids = m.team1.map(String);
          const t2Ids = m.team2.map(String);
          const isTeam1Win = s1 > s2;

          // Calculate Rating Change (Simplified ELO logic matching update loop)
          // Note: We use base rating for calc here to keep it simple and consistent with standard ELO updates
          // (Form affects prediction but usually ELO update formula uses raw ratings).
          const getR = (id: string) => currentRatings.get(id) || 1000;
          const t1Avg = t1Ids.reduce((sum, id) => sum + getR(id), 0) / (t1Ids.length || 1);
          const t2Avg = t2Ids.reduce((sum, id) => sum + getR(id), 0) / (t2Ids.length || 1);
          
          let change = 0;
          if (isEligibleForRating) {
              const V2_K = 0.18;
              const expectedA = 1 / (1 + Math.exp(-(t1Avg - t2Avg) / 0.45));
              const resultA = isTeam1Win ? 1 : 0;
              change = V2_K * (resultA - expectedA);
              
              // Apply update to simulated ratings
              t1Ids.forEach(pid => currentRatings.set(pid, (currentRatings.get(pid)||1000) + change));
              t2Ids.forEach(pid => currentRatings.set(pid, (currentRatings.get(pid)||1000) - change));
          }

          // Accumulate Matrix Data if within filter
          if (shouldCount && isEligibleForRating) {
              // For every P1 in Team 1, they engaged with every P2 in Team 2
              t1Ids.forEach(p1 => {
                  if (!activePlayerIds.has(p1)) return;
                  t2Ids.forEach(p2 => {
                      if (!activePlayerIds.has(p2)) return;
                      ensureInit(p1, p2);
                      ensureInit(p2, p1);
                      
                      // P1 gained 'change' (if win) or lost 'change' (if loss).
                      // Note: 'change' calculated above is positive if T1 exceeded expectation (win) or negative if T1 underperformed.
                      // Wait, standard formula: resultA (1) - expected. If A wins, change is positive.
                      // So P1 gains `change` relative to pool.
                      // We attribute this gain vs P2.
                      
                      const p1Map = matrix.get(p1)!;
                      const p2Map = matrix.get(p2)!;
                      
                      p1Map.set(p2, p1Map.get(p2)! + change);
                      p2Map.set(p1, p2Map.get(p1)! - change);
                  });
              });
          }
      });

      return matrix;
  }, [matches, activePlayers, activePlayerIds, ratingExchangeFilter, currentMonthKey]);

  // --- BETTING POINTS TABLE DATA (Uses global stats - Current Month Only) ---
  const bettingPointsTableData = useMemo(() => {
    return Array.from(stats.pairStats.values())
        .filter((p: PairStat) => p.type === 'betting')
        .sort((a: PairStat, b: PairStat) => b.bettingPoints - a.bettingPoints);
  }, [stats.pairStats]);

  // --- TOP RATING PLAYERS (For basic table) ---
  const topRatedPlayers = useMemo(() => {
      return [...activePlayers]
        .filter(p => (p.matchesPlayed || 0) > 0) 
        .sort((a, b) => {
            const rA = a.tournamentRating || 0;
            const rB = b.tournamentRating || 0;
            if (rA !== rB) return rB - rA;
            return b.matchesPlayed - a.matchesPlayed;
        });
  }, [activePlayers]);

  // --- RATING HISTORY TABLE DATA (TRANSPOSED & SORTED BY FLUCTUATION) ---
  const ratingHistoryData = useMemo(() => {
      // 1. Get full history
      const history = getDailyRatingHistory(players, matches);
      
      // 2. Filter for current month and Sort CHRONOLOGICALLY ASCENDING
      const currentMonthHistory = history
          .filter(h => h.date.startsWith(currentMonthKey))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      if (currentMonthHistory.length === 0) return { dates: [], rows: [] };

      // Pre-calculate which players played on which date in this month
      const playedOnDate = new Map<string, Set<string>>();
      const monthMatches = matches.filter(m => m.date.startsWith(currentMonthKey));
      
      monthMatches.forEach(m => {
          const d = m.date.split('T')[0];
          if (!playedOnDate.has(d)) playedOnDate.set(d, new Set());
          const set = playedOnDate.get(d)!;
          m.team1.forEach(id => set.add(String(id)));
          m.team2.forEach(id => set.add(String(id)));
      });

      // 3. Find index of the first entry of this month in the FULL history to determine Start Rating
      const firstDayOfMonthIdx = history.findIndex(h => h.date.startsWith(currentMonthKey));

      // 4. Build Rows for ALL Active Players
      const rows = activePlayers.map(player => {
          const pid = String(player.id);
          
          // Determine Start of Month Rating Logic
          let startRating: number;
          
          if (firstDayOfMonthIdx > 0) {
              const prevMonthSnapshot = history[firstDayOfMonthIdx - 1];
              // Check if player existed in previous month's snapshot
              if (prevMonthSnapshot.ratings[pid] !== undefined) {
                  startRating = prevMonthSnapshot.ratings[pid];
              } else {
                  // Player didn't exist last month. Use initial.
                  startRating = player.initialPoints || 1000;
              }
          } 
          // Case B: This is the very first month of history
          else {
              startRating = player.initialPoints || 1000;
          }

          // VISUAL CURSOR: This tracks the rating shown to the user.
          // It basically "freezes" on the last known played match, unless a "Bonus" event occurs.
          let visualRatingCursor = startRating;

          // Generate cell data for each date in this month
          const cells = currentMonthHistory.map((day, idx) => {
              const currentSnapshotRating = day.ratings[pid];
              
              if (currentSnapshotRating === undefined) return null;

              const dayKey = day.date.split('T')[0];
              const didPlay = playedOnDate.get(dayKey)?.has(pid) || false;
              
              // Detect Passive Change (Bonus/Penalty from Tournament end)
              // If user didn't play, but rating shifted significantly (> 0.001), treat it as a valid update
              const hasPassiveChange = Math.abs(currentSnapshotRating - visualRatingCursor) > 0.001;

              let displayRating: number;
              let delta = 0;
              // Flag to indicate if we should visually emphasize this cell (Play OR Bonus)
              let isActiveEvent = false; 

              if (didPlay || hasPassiveChange) {
                  // Update visual cursor to the new real rating
                  displayRating = currentSnapshotRating;
                  delta = displayRating - visualRatingCursor;
                  visualRatingCursor = displayRating;
                  isActiveEvent = true;
              } else {
                  // Freeze visual cursor
                  displayRating = visualRatingCursor;
                  delta = 0;
                  isActiveEvent = false;
              }

              return { rating: displayRating, delta, isActiveEvent };
          });

          // Calculate Total Change: Current Visual - StartRating
          // This represents the total points gained/lost from PLAYED matches this month.
          const currentVisualRating = cells.length > 0 && cells[cells.length - 1] 
                ? cells[cells.length - 1]!.rating 
                : startRating;
          
          let totalChange = currentVisualRating - startRating;
          if (Math.abs(totalChange) < 0.005) totalChange = 0;

          return {
              player,
              cells,
              startRating,
              totalChange
          };
      });

      // 5. SORT BY TOTAL CHANGE DESCENDING (Most positive to most negative)
      rows.sort((a, b) => {
          if (Math.abs(b.totalChange - a.totalChange) > 0.005) {
              return b.totalChange - a.totalChange;
          }
          // Fallback: Rating
          return (b.player.tournamentRating || 0) - (a.player.tournamentRating || 0);
      });

      return {
          dates: currentMonthHistory.map(h => ({
              full: h.date,
              display: h.date.slice(8, 10) + '/' + h.date.slice(5, 7)
          })),
          rows
      };
  }, [players, matches, currentMonthKey, activePlayers, playerLookup]);

  // --- FILTER MATCHES FOR MATRIX ---
  const matrixMatches = useMemo(() => {
      if (matrixTimeFilter === 'all') return matches;
      return matches.filter(m => m.date.startsWith(currentMonthKey));
  }, [matches, matrixTimeFilter, currentMonthKey]);

  // --- ACTIVE PLAYERS FOR MATRIX ---
  const matrixActivePlayers = useMemo(() => {
      const activeIds = new Set<string>();
      matrixMatches.forEach(m => {
          m.team1.forEach(id => activeIds.add(String(id)));
          m.team2.forEach(id => activeIds.add(String(id)));
      });
      return players
        .filter(p => activeIds.has(String(p.id)))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, matrixMatches]);

  const renderSortHeader = (label: string, sortKey: SortKey, currentKey: SortKey, currentDir: SortDirection) => {
      const isActive = currentKey === sortKey;
      return (
          <div className={`flex items-center justify-center gap-1 cursor-pointer select-none group ${isActive ? 'text-slate-800' : 'text-slate-500'}`} onClick={() => handleHandicapSort(sortKey)}>
              {label}
              <div className="flex flex-col">
                  {isActive ? (
                      currentDir === 'asc' ? <ArrowUpCircle className="w-3 h-3 text-pickle-600" /> : <ArrowDownCircle className="w-3 h-3 text-pickle-600" />
                  ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400" />
                  )}
              </div>
          </div>
      );
  };


  return (
    <div className="space-y-6">
      {/* Month Header */}
      <div className="flex items-center gap-2 text-slate-600 font-bold bg-slate-100 w-fit px-3 py-1 rounded-full text-xs sm:text-sm">
        <Calendar className="w-4 h-4" />
        Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
      </div>

      {/* 1. HIGHLIGHTS ROW */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 md:grid md:grid-cols-3 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
        {/* Card 1: Top Nộp */}
        <div className="snap-center min-w-[85vw] md:min-w-0 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl p-5 text-white shadow-lg relative overflow-hidden flex-shrink-0">
            <TrendingDown className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10 rotate-12" />
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 text-slate-300 text-xs sm:text-sm font-bold uppercase tracking-wider">
                    <TrendingDown className="w-4 h-4" /> Tốp Nộp
                </div>
                <h3 className="text-xl font-bold truncate">{topNopPlayer.name}</h3>
                <div className="flex items-end gap-2 mt-1">
                    <span className="text-3xl font-black text-red-400">
                        {topNopPlayer.points}
                    </span>
                    <span className="text-sm text-slate-300 mb-1">điểm</span>
                </div>
            </div>
        </div>

        {/* Card 2: Cặp Đôi Bú */}
        <div className="snap-center min-w-[85vw] md:min-w-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg relative overflow-hidden flex-shrink-0">
            <Users className="absolute -right-4 -bottom-4 w-24 h-24 text-white/20 rotate-12" />
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 text-purple-100 text-xs sm:text-sm font-bold uppercase tracking-wider">
                    <Users className="w-4 h-4" /> Cặp Đôi Bú
                </div>
                <h3 className="text-xl font-bold truncate">{bestBettingPair.names}</h3>
                <div className="flex items-end gap-2 mt-1">
                     <span className="text-3xl font-black">
                        {bestBettingPair.points > 0 ? '+' : ''}{bestBettingPair.points}
                    </span>
                    <span className="text-sm text-purple-100 mb-1">điểm</span>
                </div>
            </div>
        </div>

        {/* Card 3: Betting King */}
        <div className="snap-center min-w-[85vw] md:min-w-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg relative overflow-hidden flex-shrink-0">
            <Banknote className="absolute -right-4 -bottom-4 w-24 h-24 text-white/20 rotate-12" />
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 text-green-100 text-xs sm:text-sm font-bold uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4" /> Vua Lùa Kèo
                </div>
                <h3 className="text-xl font-bold truncate">{kingOfBetting.name}</h3>
                <div className="flex items-end gap-2 mt-1">
                    <span className="text-3xl font-black">
                        {kingOfBetting.points > 0 ? '+' : ''}{kingOfBetting.points}
                    </span>
                    <span className="text-sm text-green-100 mb-1">điểm</span>
                </div>
            </div>
        </div>
      </div>

      {/* 2. RATING TABLE (BXH) */}
      <Card className="p-0 sm:p-6" classNameTitle="px-4 sm:px-6">
         <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 p-4 gap-4 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <Award className="w-5 h-5 text-blue-500" />
                BXH Điểm Kỹ Năng (Rating)
            </h3>
            <div className="text-[10px] text-slate-400 font-medium bg-white px-2 py-1 rounded border border-slate-200">
                Cập nhật theo thời gian thực
            </div>
         </div>
         
         <div className="w-full">
            <table className="w-full text-sm text-left table-fixed">
                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] sm:text-xs uppercase">
                    <tr>
                        <th className="px-2 sm:px-4 py-3 text-slate-700 w-10 text-center">#</th>
                        <th className="px-2 sm:px-4 py-3 text-slate-700 w-[35%] sm:w-auto">Người Chơi</th>
                        <th className="px-1 sm:px-4 py-3 text-center text-slate-700 w-[20%] sm:w-auto">Rating</th>
                        <th className="px-1 sm:px-4 py-3 text-center text-slate-700 w-[20%] sm:w-auto">Tiến độ</th>
                        <th className="px-2 sm:px-4 py-3 text-right text-slate-700 w-[25%] sm:w-auto" title="Tổng số trận Thắng/Thua (Kèo + Giải)">Record (Tổng)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {topRatedPlayers.length > 0 ? (
                        topRatedPlayers.map((player, idx) => {
                            // Calculate Progress: Current Rating - Initial Rating
                            const initial = player.initialPoints || 3.0; // Fallback default
                            const current = player.tournamentRating || initial;
                            const diff = current - initial;

                            return (
                                <tr key={player.id} className="hover:bg-slate-50/50">
                                    <td className="px-2 sm:px-4 py-3 text-center">
                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                                            idx === 0 ? 'bg-yellow-500 text-white' : 
                                            idx === 1 ? 'bg-gray-400 text-white' : 
                                            idx === 2 ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                    </td>
                                    <td className="px-2 sm:px-4 py-3 font-medium text-slate-900 truncate">
                                        {player.name}
                                    </td>
                                    <td className="px-1 sm:px-4 py-3 text-center">
                                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs sm:text-sm border border-blue-100">
                                            {current.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-1 sm:px-4 py-3 text-center">
                                        <div className={`flex items-center justify-center gap-0.5 text-xs font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                        </div>
                                    </td>
                                    <td className="px-2 sm:px-4 py-3 text-right text-xs sm:text-sm font-medium">
                                        <span className="text-green-600">{player.wins}W</span>
                                        <span className="text-slate-300 mx-1">/</span>
                                        <span className="text-red-500">{player.losses}L</span>
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có dữ liệu thi đấu</td>
                        </tr>
                    )}
                </tbody>
            </table>
         </div>
      </Card>

      {/* 3. RATING TABLE (TRANSPOSED: ROWS=PLAYERS, COLS=DATES) */}
      <Card className="p-0 sm:p-6" classNameTitle="px-4 sm:px-6">
         <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 p-4 gap-4 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <Activity className="w-5 h-5 text-indigo-500" />
                Biến Động Rating (Tất cả - Tháng này)
            </h3>
         </div>
         <div className="w-full overflow-x-auto">
            {ratingHistoryData.rows.length > 0 ? (
                <table className="w-full text-xs text-left border-collapse min-w-[800px]">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                            {/* Sticky First Column Header */}
                            <th className="px-4 py-3 border-b border-slate-200 sticky left-0 bg-slate-50 z-20 w-32 border-r border-slate-200">
                                Người Chơi
                            </th>
                            {/* Monthly Change Column */}
                            <th className="px-4 py-3 border-b border-slate-200 text-center w-24 border-r border-slate-200 bg-slate-50">
                                Biến Động
                            </th>
                            {/* Date Columns */}
                            {ratingHistoryData.dates.map((date, idx) => (
                                <th key={idx} className="px-4 py-3 border-b border-slate-200 text-center min-w-[80px] whitespace-nowrap">
                                    {date.display}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {ratingHistoryData.rows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                                {/* Sticky Player Name */}
                                <td className="px-4 py-3 font-bold text-slate-800 sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] truncate">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white ${rowIdx < 3 ? 'bg-indigo-500' : 'bg-slate-300'}`}>{rowIdx + 1}</div>
                                        <span className="truncate">{row.player?.name}</span>
                                    </div>
                                </td>
                                
                                {/* Monthly Fluctuation */}
                                <td className="px-2 py-3 text-center border-r border-slate-100 bg-slate-50/30">
                                    <div className={`flex items-center justify-center gap-1 font-bold text-xs ${
                                        row.totalChange > 0.005 ? 'text-green-600' : row.totalChange < -0.005 ? 'text-red-500' : 'text-slate-400'
                                    }`}>
                                        {row.totalChange > 0.005 ? <TrendingUp className="w-3 h-3" /> : row.totalChange < -0.005 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                        {row.totalChange > 0 ? '+' : ''}{row.totalChange.toFixed(2)}
                                    </div>
                                </td>

                                {/* Date Cells */}
                                {row.cells.map((cell, cellIdx) => (
                                    <td key={cellIdx} className="px-2 py-3 text-center border-r border-slate-50 last:border-r-0">
                                        {cell ? (
                                            <div className="flex flex-col items-center">
                                                <span className={`font-bold text-sm font-mono ${cell.isActiveEvent ? 'text-slate-800' : 'text-slate-400'}`}>
                                                    {cell.rating.toFixed(2)}
                                                </span>
                                                {/* Show delta if Active Event (Play OR Bonus) */}
                                                {cell.isActiveEvent && Math.abs(cell.delta) > 0.001 ? (
                                                    <span className={`text-[10px] font-bold ${cell.delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {cell.delta > 0 ? '+' : ''}{cell.delta.toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-200">-</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-200 text-lg">-</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="h-32 flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu biến động tháng này.</div>
            )}
         </div>
         <div className="p-2 text-[10px] text-slate-400 text-center italic border-t border-slate-50">
            * Bảng hiển thị mức tăng/giảm rating khi có trận đấu HOẶC khi có điểm thưởng giải đấu. Nếu không có biến động, điểm sẽ được giữ nguyên từ ngày gần nhất.
         </div>
      </Card>

      {/* 4. HANDICAP STATS TABLE (NEW) */}
      <Card className="overflow-hidden p-0 sm:p-6" classNameTitle="px-4 sm:px-6">
         <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 p-4 gap-4 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <Scale className="w-5 h-5 text-purple-500" />
                Thống Kê Thế Trận (Cân/Trên/Dưới)
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-2">
                 {/* Sort Metric Toggle */}
                 <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-lg">
                     <button
                        onClick={() => setHandicapSortMetric('count')}
                        className={`text-xs px-2 py-1 rounded font-bold flex items-center gap-1 ${handicapSortMetric === 'count' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                         <Hash className="w-3 h-3" /> Số Lượng
                     </button>
                     <button
                        onClick={() => setHandicapSortMetric('rate')}
                        className={`text-xs px-2 py-1 rounded font-bold flex items-center gap-1 ${handicapSortMetric === 'rate' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                         <Percent className="w-3 h-3" /> Tỉ Lệ
                     </button>
                 </div>

                 <select 
                    value={handicapTimeFilter}
                    onChange={(e) => setHandicapTimeFilter(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-700 text-xs sm:text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-pickle-500 focus:border-pickle-500 outline-none font-bold"
                >
                    <option value="all">Toàn bộ thời gian</option>
                    {availableMonths.map(month => (
                        <option key={month} value={month}>Tháng {month.slice(5)}/{month.slice(0,4)}</option>
                    ))}
                </select>
            </div>
         </div>
         
         <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[700px]">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                        <th className="px-4 py-3 w-40 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 cursor-pointer hover:bg-slate-100" onClick={() => handleHandicapSort('name')}>
                            <div className="flex items-center gap-1">
                                Người Chơi
                                {handicapSortKey === 'name' && (handicapSortDir === 'asc' ? <ArrowUpCircle className="w-3 h-3 text-slate-400" /> : <ArrowDownCircle className="w-3 h-3 text-slate-400" />)}
                            </div>
                        </th>
                        <th className="px-2 py-3 text-center w-24 border-r border-slate-100 bg-slate-50 text-slate-700">
                            {renderSortHeader('Tổng Trận', 'total', handicapSortKey, handicapSortDir)}
                        </th>
                        <th className="px-2 py-3 text-center bg-red-50/50 text-red-700 border-r border-slate-100">
                            {renderSortHeader('Kèo Dưới', 'underdog', handicapSortKey, handicapSortDir)}
                        </th>
                        <th className="px-2 py-3 text-center bg-blue-50/50 text-blue-700 border-r border-slate-100">
                            {renderSortHeader('Kèo Cân', 'balanced', handicapSortKey, handicapSortDir)}
                        </th>
                        <th className="px-2 py-3 text-center bg-green-50/50 text-green-700">
                            {renderSortHeader('Kèo Trên', 'favorite', handicapSortKey, handicapSortDir)}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {handicapStatsData.map((stat, idx) => {
                        const totalMatches = stat.balanced.total + stat.underdog.total + stat.favorite.total;
                        
                        const renderCell = (data: HandicapCategoryStats, colorClass: string, barColor: string) => {
                            if (data.total === 0) return <span className="text-slate-300">-</span>;
                            const rate = Math.round((data.wins / data.total) * 100);
                            const share = Math.round((data.total / totalMatches) * 100); // Proportion of total games

                            return (
                                <div className="flex flex-col items-center justify-center gap-0.5 w-full">
                                    <span className={`font-black text-sm ${rate >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                                        {rate}%
                                    </span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-[11px] text-slate-800 font-bold">
                                            {data.total}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-medium">
                                            ({share}%)
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium hidden">
                                        ({data.wins} thắng)
                                    </div>
                                    {/* Share Bar */}
                                    <div className="w-16 h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                        <div className={`h-full ${barColor}`} style={{ width: `${share}%` }}></div>
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <tr key={stat.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${idx < 3 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {idx + 1}
                                        </div>
                                        <span className="truncate">{stat.name}</span>
                                    </div>
                                </td>
                                <td className="px-2 py-3 text-center border-r border-slate-100 font-bold text-slate-700 text-sm">
                                    {totalMatches}
                                </td>
                                <td className="px-2 py-3 text-center border-r border-slate-50 bg-red-50/10">
                                    {renderCell(stat.underdog, 'red', 'bg-red-400')}
                                </td>
                                <td className="px-2 py-3 text-center border-r border-slate-50 bg-blue-50/10">
                                    {renderCell(stat.balanced, 'blue', 'bg-blue-400')}
                                </td>
                                <td className="px-2 py-3 text-center bg-green-50/10">
                                    {renderCell(stat.favorite, 'green', 'bg-green-400')}
                                </td>
                            </tr>
                        );
                    })}
                    {handicapStatsData.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-6 text-slate-400">Chưa có dữ liệu phù hợp.</td></tr>
                    )}
                </tbody>
            </table>
         </div>
         <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500">
            <div className="font-bold mb-1 uppercase tracking-wider text-slate-400">Định nghĩa (Theo chênh lệch Rating Thực Tế = Gốc + Form):</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span><b>Kèo Cân:</b> Chênh lệch ≤ 0.25</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span><b>Kèo Trên:</b> Rating cao hơn &gt; 0.25</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span><b>Kèo Dưới:</b> Rating thấp hơn &gt; 0.25</span>
                </div>
            </div>
            <div className="mt-1 text-[9px] text-slate-400 italic">
                * Form (Phong độ) = (Tỉ lệ thắng 5 trận gần nhất - 50%) * 0.5 (Tối đa +/- 0.25 điểm).
            </div>
         </div>
      </Card>

      {/* 4. WINRATE TABLE (Updated with Time Filter) */}
      <Card className="overflow-hidden p-0 sm:p-6" classNameTitle="px-4 sm:px-6">
         <div className="flex flex-col xl:flex-row items-center justify-between border-b border-slate-100 p-4 gap-4 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="w-5 h-5 text-slate-500" />
                Tỉ Lệ Thắng Cặp Đôi
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                {/* Time Filter Dropdown */}
                <select 
                    value={winRateTimeFilter}
                    onChange={(e) => setWinRateTimeFilter(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-700 text-xs sm:text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-pickle-500 focus:border-pickle-500 outline-none font-bold"
                >
                    <option value="all">Toàn bộ thời gian</option>
                    {availableMonths.map(month => (
                        <option key={month} value={month}>Tháng {month.slice(5)}/{month.slice(0,4)}</option>
                    ))}
                </select>

                <div className="flex bg-slate-200 rounded-lg p-1">
                    <button 
                        onClick={() => setWinrateTab('all')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-bold transition-all ${
                            winrateTab === 'all' 
                            ? 'bg-purple-600 text-white shadow-md' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Tất Cả
                    </button>
                    <button 
                        onClick={() => setWinrateTab('betting')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-bold transition-all ${
                            winrateTab === 'betting' 
                            ? 'bg-pickle-600 text-white shadow-md' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Kèo
                    </button>
                    <button 
                        onClick={() => setWinrateTab('tournament')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-bold transition-all ${
                            winrateTab === 'tournament' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Giải
                    </button>
                </div>
            </div>
         </div>
         
         <div className="w-full">
            <table className="w-full text-sm text-left table-fixed">
                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] sm:text-xs uppercase">
                    <tr>
                        <th className="px-2 sm:px-4 py-3 text-slate-700 w-[55%] sm:w-auto">Cặp Đôi</th>
                        <th className="hidden sm:table-cell px-2 sm:px-4 py-3 text-center text-slate-700">Số Trận</th>
                        <th className="px-1 sm:px-4 py-3 text-center text-slate-700 w-[25%] sm:w-auto">Thắng/Thua</th>
                        <th className="px-2 sm:px-4 py-3 text-right text-slate-700 w-[20%] sm:w-auto">Rate</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {winrateTableData.length > 0 ? (
                        winrateTableData.map((pair, idx) => {
                            const wr = pair.matches ? Math.round((pair.wins / pair.matches) * 100) : 0;
                            return (
                                <tr key={pair.id} className="hover:bg-slate-50/50">
                                    <td className="px-2 sm:px-4 py-3 font-medium text-slate-900 truncate">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${idx < 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                {idx + 1}
                                            </span>
                                            <div className="flex flex-col truncate">
                                                <span className="truncate" title={pair.names}>{pair.names}</span>
                                                <span className="text-[10px] text-slate-400 font-normal sm:hidden">{pair.matches} trận</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="hidden sm:table-cell px-2 sm:px-4 py-3 text-center text-slate-600 font-medium">{pair.matches}</td>
                                    <td className="px-1 sm:px-4 py-3 text-center text-slate-600 text-xs sm:text-sm">
                                        <span className="text-green-600 font-bold">{pair.wins}</span> - <span className="text-red-500 font-bold">{pair.matches - pair.wins}</span>
                                    </td>
                                    <td className="px-2 sm:px-4 py-3 text-right">
                                        <span className={`font-bold ${wr >= 50 ? 'text-green-600' : 'text-orange-500'}`}>{wr}%</span>
                                    </td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chưa có dữ liệu</td>
                        </tr>
                    )}
                </tbody>
            </table>
         </div>
      </Card>

      {/* 5. BETTING POINTS TABLE */}
      <Card title="Bảng Điểm Cược Cặp Đôi (Tháng)" className="p-0 sm:p-6" classNameTitle="px-4 sm:px-6">
        <div className="w-full">
            <table className="w-full text-sm text-left table-fixed">
                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] sm:text-xs uppercase">
                    <tr>
                        <th className="px-2 sm:px-4 py-3 text-slate-700 w-[60%] sm:w-auto">Cặp Đôi</th>
                        <th className="hidden sm:table-cell px-2 sm:px-4 py-3 text-center text-slate-700">Số Trận Kèo</th>
                        <th className="px-2 sm:px-4 py-3 text-right text-slate-700 w-[40%] sm:w-auto">Điểm</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                     {bettingPointsTableData.length > 0 ? (
                        bettingPointsTableData.map((pair, idx) => (
                            <tr key={pair.id} className="hover:bg-slate-50/50">
                                <td className="px-2 sm:px-4 py-3 font-medium text-slate-900 truncate">
                                     <div className="flex items-center gap-2">
                                        <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${idx < 3 ? 'bg-yellow-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {idx + 1}
                                        </span>
                                        <div className="flex flex-col truncate">
                                            <span className="truncate">{pair.names}</span>
                                            <span className="text-[10px] text-slate-400 font-normal sm:hidden">{pair.matches} trận</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="hidden sm:table-cell px-2 sm:px-4 py-3 text-center text-slate-600 font-medium">{pair.matches}</td>
                                <td className="px-2 sm:px-4 py-3 text-right">
                                    <span className={`font-bold px-2 py-1 rounded text-xs sm:text-sm ${pair.bettingPoints > 0 ? 'bg-green-100 text-green-700' : pair.bettingPoints < 0 ? 'bg-red-100 text-red-700' : 'text-slate-500'}`}>
                                        {pair.bettingPoints > 0 ? '+' : ''}{pair.bettingPoints}
                                    </span>
                                </td>
                            </tr>
                        ))
                     ) : (
                        <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400">Chưa có dữ liệu</td>
                        </tr>
                     )}
                </tbody>
            </table>
        </div>
      </Card>

      {/* 6. HEAD TO HEAD MATRIX */}
      <Card className="p-0 sm:p-6" classNameTitle="px-4 sm:px-6">
         <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 p-4 gap-4 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <Grid3X3 className="w-5 h-5 text-slate-500" />
                Ma Trận Đối Đầu (Win Rate)
            </h3>
            <div className="flex bg-slate-200 rounded-lg p-1 w-full sm:w-auto">
                <button 
                    onClick={() => setMatrixTimeFilter('all')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-bold transition-all ${
                        matrixTimeFilter === 'all' 
                        ? 'bg-slate-800 text-white shadow-md' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Tất Cả
                </button>
                <button 
                    onClick={() => setMatrixTimeFilter('month')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-bold transition-all ${
                        matrixTimeFilter === 'month' 
                        ? 'bg-slate-800 text-white shadow-md' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Tháng Này
                </button>
            </div>
         </div>
         <div className="p-4">
             <HeadToHeadMatrix players={players} matches={matrixMatches} />
             <div className="mt-2 text-center text-[10px] text-slate-400 italic">
                * Tỉ lệ % thắng của hàng (bên trái) khi đối đầu với cột (bên trên).
             </div>
         </div>
      </Card>

      {/* 7. RATING EXCHANGE MATRIX (NEW) */}
      <Card className="p-0 sm:p-6" classNameTitle="px-4 sm:px-6">
         <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 p-4 gap-4 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                Ma Trận Điểm Rating (Được/Mất)
            </h3>
            <div className="flex bg-slate-200 rounded-lg p-1 w-full sm:w-auto">
                <button 
                    onClick={() => setRatingExchangeFilter('all')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-bold transition-all ${
                        ratingExchangeFilter === 'all' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Tất Cả
                </button>
                <button 
                    onClick={() => setRatingExchangeFilter('month')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[10px] sm:text-sm font-bold transition-all ${
                        ratingExchangeFilter === 'month' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Tháng Này
                </button>
            </div>
         </div>
         <div className="w-full overflow-x-auto p-4">
            <table className="min-w-full border-collapse table-fixed">
                <thead>
                    <tr>
                        {/* Top Left Empty Cell */}
                        <th className="sticky left-0 top-0 z-20 bg-slate-50 border-b border-r border-slate-200 p-1 w-[80px] md:w-[120px] text-left text-[10px] font-bold text-slate-400 uppercase align-bottom">
                            <span className="block px-1">Gained</span>
                        </th>
                        
                        {/* Top Header Row (Opponents) */}
                        {matrixActivePlayers.map(colPlayer => (
                            <th key={colPlayer.id} className="p-2 border-b border-slate-200 w-16 md:w-20 text-center text-[10px] font-bold text-slate-700 bg-slate-50 align-bottom">
                                <span className="block truncate" title={colPlayer.name}>
                                    {colPlayer.name}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {matrixActivePlayers.map(rowPlayer => (
                        <tr key={rowPlayer.id} className="hover:bg-slate-50 transition-colors h-10">
                            {/* Left Sticky Column (Player) */}
                            <th className="sticky left-0 z-10 p-1 border-r border-b border-slate-200 bg-slate-50 text-left text-[10px] md:text-xs font-bold text-slate-800 shadow-[1px_0_3px_rgba(0,0,0,0.05)] truncate">
                                <span className="block px-1 truncate" title={rowPlayer.name}>{rowPlayer.name}</span>
                            </th>
                            
                            {/* Data Cells */}
                            {matrixActivePlayers.map(colPlayer => {
                                if (rowPlayer.id === colPlayer.id) {
                                    return <td key={colPlayer.id} className="bg-slate-100 border-b border-slate-200"></td>;
                                }

                                const exchange = ratingMatrixData.get(String(rowPlayer.id))?.get(String(colPlayer.id)) || 0;
                                
                                // Color logic
                                let cellClass = 'text-slate-300';
                                if (exchange > 0) cellClass = 'text-green-600 font-bold bg-green-50/50';
                                if (exchange < 0) cellClass = 'text-red-500 font-bold bg-red-50/50';
                                if (exchange === 0 && ratingMatrixData.get(String(rowPlayer.id))?.has(String(colPlayer.id))) cellClass = 'text-slate-400 font-medium';

                                return (
                                    <td 
                                        key={colPlayer.id} 
                                        className={`p-0 border-b border-slate-100 text-center border-r border-slate-50 last:border-r-0 ${cellClass}`}
                                    >
                                        <div className="flex items-center justify-center h-full text-[10px] md:text-xs">
                                            {exchange !== 0 ? (
                                                <span>{exchange > 0 ? '+' : ''}{exchange.toFixed(1)}</span>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="mt-2 text-center text-[10px] text-slate-400 italic">
                * Tổng điểm Rating mà hàng (bên trái) đã lấy được từ cột (bên trên). Màu xanh là dương, màu đỏ là âm.
            </div>
         </div>
      </Card>
    </div>
  );
};