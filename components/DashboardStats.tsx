import React, { useMemo, useState } from 'react';
import { Match, Player } from '../types';
import { Card } from './Card';
import { Trophy, TrendingUp, Users, Banknote, Medal, Calendar, Grid3X3, Filter, Award, TrendingDown, Activity } from 'lucide-react';
import { HeadToHeadMatrix } from './HeadToHeadMatrix';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

  // --- TOP RATING PLAYERS ---
  const topRatedPlayers = useMemo(() => {
      // Create shallow copy to sort
      return [...activePlayers]
        .filter(p => (p.matchesPlayed || 0) > 0) // Only show active players
        .sort((a, b) => {
            const rA = a.tournamentRating || 0;
            const rB = b.tournamentRating || 0;
            if (rA !== rB) return rB - rA; // Descending
            return b.matchesPlayed - a.matchesPlayed;
        });
  }, [activePlayers]);

  // --- RATING CHART DATA ---
  const ratingChartData = useMemo(() => {
      // 1. Get full daily history
      const history = getDailyRatingHistory(players, matches);
      
      // 2. Filter for current month
      const currentMonthHistory = history.filter(h => h.date.startsWith(currentMonthKey));
      
      // 3. Filter only active players who have matches in this history (to avoid 20 lines)
      // Actually, show all ACTIVE players, assuming team size is small (<15).
      if (currentMonthHistory.length === 0) return [];

      return currentMonthHistory.map(day => {
          const point: any = { name: day.date.slice(8, 10) + '/' + day.date.slice(5, 7) }; // DD/MM
          activePlayers.forEach(p => {
              if (day.ratings[p.id] !== undefined) {
                  point[p.name] = day.ratings[p.id];
              }
          });
          return point;
      });
  }, [players, matches, activePlayers, currentMonthKey]);

  // Color palette for lines
  const lineColors = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#4f46e5', '#ca8a04', '#059669'];

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

      {/* 3. RATING CHART (Position 3) */}
      <Card className="p-0 sm:p-6" classNameTitle="px-4 sm:px-6">
         <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-100 p-4 gap-4 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <Activity className="w-5 h-5 text-indigo-500" />
                Biến Động Rating (Tháng này)
            </h3>
         </div>
         <div className="h-64 w-full p-2 sm:p-4">
            {ratingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ratingChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        {activePlayers.map((p, idx) => (
                            <Line 
                                key={p.id}
                                type="monotone" 
                                dataKey={p.name} 
                                stroke={lineColors[idx % lineColors.length]} 
                                strokeWidth={2} 
                                dot={{r: 2}} 
                                activeDot={{r: 4}} 
                                connectNulls={true}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu biến động tháng này.</div>
            )}
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