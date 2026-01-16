import React, { useMemo, useState } from 'react';
import { Match, Player } from '../types';
import { Card } from './Card';
import { Trophy, TrendingUp, Users, Banknote, Medal, Calendar, Grid3X3, Filter, Award, TrendingDown, Activity, Minus } from 'lucide-react';
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

export const DashboardStats: React.FC<DashboardStatsProps> = ({ matches, players }) => {
  // Added 'all' to allowed state types
  const [winrateTab, setWinrateTab] = useState<'betting' | 'tournament' | 'all'>('all');
  
  // Matrix Filter State
  const [matrixTimeFilter, setMatrixTimeFilter] = useState<'all' | 'month'>('all');
  
  // Helper to get current month key YYYY-MM
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  
  // Create a lookup map, ensuring keys are always Strings
  const playerLookup = useMemo(() => new Map(players.map(p => [String(p.id), p])), [players]);

  // Filter out inactive players for highlights and tables
  const activePlayers = useMemo(() => players.filter(p => p.isActive !== false), [players]);
  const activePlayerIds = useMemo(() => new Set(activePlayers.map(p => String(p.id))), [activePlayers]);

  // --- CALCULATION LOGIC ---
  const stats = useMemo<{ indStats: Map<string, IndStat>; pairStats: Map<string, PairStat> }>(() => {
    const monthMatches = matches.filter(m => m.date.startsWith(currentMonthKey));

    // 1. Individual Stats (For Highlights)
    const indStats = new Map<string, IndStat>();
    
    // 2. Pair Stats (For Tables)
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


  // --- PREPARE TABLE DATA ---
  const winrateTableData = useMemo(() => {
    let sourceData: PairStat[] = [];

    if (winrateTab === 'all') {
        // Aggregate betting and tournament stats for the same pair
        const aggMap = new Map<string, PairStat>();
        stats.pairStats.forEach((stat) => {
            if (!aggMap.has(stat.id)) {
                // Clone the object to avoid mutation issues
                aggMap.set(stat.id, { ...stat });
            } else {
                const existing = aggMap.get(stat.id);
                if (existing) {
                    existing.wins += stat.wins;
                    existing.matches += stat.matches;
                }
                // Note: We don't really care about mixed 'type' here as it's for 'all' view
            }
        });
        sourceData = Array.from(aggMap.values());
    } else {
        sourceData = (Array.from(stats.pairStats.values()) as PairStat[])
            .filter((p: PairStat) => p.type === winrateTab);
    }

    return sourceData.sort((a: PairStat, b: PairStat) => {
            const wrA = a.matches ? (a.wins / a.matches) : 0;
            const wrB = b.matches ? (b.wins / b.matches) : 0;
            if (wrB !== wrA) return wrB - wrA;
            return b.matches - a.matches;
        });
  }, [stats.pairStats, winrateTab]);

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

      {/* 4. WINRATE TABLE */}
      <Card className="overflow-hidden p-0 sm:p-6" classNameTitle="px-4 sm:px-6">
         <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 p-4 gap-4 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="w-5 h-5 text-slate-500" />
                Tỉ Lệ Thắng Cặp Đôi
            </h3>
            <div className="flex bg-slate-200 rounded-lg p-1 w-full sm:w-auto">
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
    </div>
  );
};