import React, { useMemo, useState } from 'react';
import { Player, Match } from '../types';
import { calculatePlayerStats } from '../services/storageService';
import { Trophy, Medal, TrendingUp, TrendingDown, Filter, Banknote, Users, User, Eye, X, Calendar, AlertTriangle, Layers } from 'lucide-react';

interface LeaderboardProps {
  players: Player[]; // Original list of players
  matches: Match[]; // All matches to calculate from
}

type FilterType = 'all' | 'month' | 'week' | 'day';
type LeaderboardType = 'betting' | 'tournament';
type TournamentViewType = 'pairs' | 'individual';

interface PairStats {
    id: string; // "p1-p2"
    playerIds: string[];
    names: string;
    wins: number;
    losses: number;
    pointsScored: number;
    pointsConceded: number;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ players: initialPlayers, matches }) => {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('betting');
  const [tournamentView, setTournamentView] = useState<TournamentViewType>('pairs');
  const [sortBy, setSortBy] = useState<'points' | 'wins' | 'winRate'>('points');
  
  const [filterType, setFilterType] = useState<FilterType>('month');
  
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); 
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]); 
  
  const [auditPlayerId, setAuditPlayerId] = useState<string | null>(null);
  
  const getCurrentWeekVal = () => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  };
  const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekVal());

  // Filter Active Players for list display
  const activePlayers = useMemo(() => initialPlayers.filter(p => p.isActive !== false), [initialPlayers]);
  
  // ROBUST PLAYER LOOKUP: Map with forced string keys from FULL initialPlayers list
  const playerLookup = useMemo(() => {
      const map = new Map<string, Player>();
      initialPlayers.forEach(p => map.set(String(p.id), p));
      return map;
  }, [initialPlayers]);

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
        const matchType = match.type || 'betting';
        if (matchType !== activeTab) return false;

        if (filterType === 'all') return true;
        const matchDate = match.date; 
        
        if (filterType === 'day') return matchDate.startsWith(selectedDay);
        if (filterType === 'month') return matchDate.startsWith(selectedMonth);
        if (filterType === 'week') {
            const d = new Date(matchDate);
            d.setHours(0,0,0,0);
            d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
            const week1 = new Date(d.getFullYear(), 0, 4);
            const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
            const matchWeekVal = `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
            return matchWeekVal === selectedWeek;
        }
        return true;
    });
  }, [matches, filterType, selectedMonth, selectedWeek, selectedDay, activeTab]);

  const bettingStats = useMemo(() => {
    if (activeTab !== 'betting') return [];
    return calculatePlayerStats(activePlayers, filteredMatches);
  }, [activePlayers, filteredMatches, activeTab]);

  const sortedBettingPlayers = useMemo(() => {
    return [...bettingStats]
      .filter(p => p.matchesPlayed > 0) 
      .sort((a, b) => {
      if (sortBy === 'points') {
        if (b.totalRankingPoints !== a.totalRankingPoints) return b.totalRankingPoints - a.totalRankingPoints;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return (b.pointsScored - b.pointsConceded) - (a.pointsScored - a.pointsConceded);
      } else if (sortBy === 'wins') {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return (b.pointsScored - b.pointsConceded) - (a.pointsScored - a.pointsConceded);
      } else {
        const rateA = a.matchesPlayed ? a.wins / a.matchesPlayed : 0;
        const rateB = b.matchesPlayed ? b.wins / b.matchesPlayed : 0;
        if (rateB !== rateA) return rateB - rateA;
         return (b.pointsScored - b.pointsConceded) - (a.pointsScored - a.pointsConceded);
      }
    });
  }, [bettingStats, sortBy]);

  // --- REFACTORED TOURNAMENT PAIRS SORTING ---
  const sortedTournamentPairs = useMemo(() => {
      if (activeTab !== 'tournament' || tournamentView !== 'pairs') return [];

      const pairsMap = new Map<string, PairStats>();
      const getPairId = (ids: string[]) => ids.map(String).sort().join('-');
      const getPairName = (ids: string[]) => ids.map(id => playerLookup.get(String(id))?.name || 'Unknown').join(' & ');

      filteredMatches.forEach(match => {
          if (match.team1.length === 0 || match.team2.length === 0) return;
          
          let s1 = Number(match.score1);
          let s2 = Number(match.score2);
          if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 === s2) return; 

          const pId1 = getPairId(match.team1);
          const pId2 = getPairId(match.team2);

          if (!pairsMap.has(pId1)) {
              pairsMap.set(pId1, { id: pId1, playerIds: match.team1.map(String), names: getPairName(match.team1), wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });
          }
          if (!pairsMap.has(pId2)) {
            pairsMap.set(pId2, { id: pId2, playerIds: match.team2.map(String), names: getPairName(match.team2), wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });
          }

          const stats1 = pairsMap.get(pId1)!;
          const stats2 = pairsMap.get(pId2)!;

          stats1.pointsScored += s1; stats1.pointsConceded += s2;
          stats2.pointsScored += s2; stats2.pointsConceded += s1;

          if (s1 > s2) {
              stats1.wins++; stats2.losses++;
          } else {
              stats2.wins++; stats1.losses++;
          }
      });

      // Convert to array and filter empty
      let standings = Array.from(pairsMap.values()).filter(p => (p.wins + p.losses) > 0);

      // 1. Sort by Wins (Primary)
      standings.sort((a, b) => b.wins - a.wins);

      // 2. Resolve Ties
      const finalStandings: PairStats[] = [];
      let currentGroup: PairStats[] = [];

      // Helper for tie resolution
      const resolveTies = (group: PairStats[]) => {
          if (group.length <= 1) return group;

          const groupIds = new Set(group.map(g => g.id));
          const internalWins = new Map<string, number>();
          group.forEach(g => internalWins.set(g.id, 0));

          filteredMatches.forEach(m => {
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
              const winsA = internalWins.get(a.id) || 0;
              const winsB = internalWins.get(b.id) || 0;
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

      for (let i = 0; i < standings.length; i++) {
          const current = standings[i];
          const prev = currentGroup.length > 0 ? currentGroup[0] : null;

          if (prev === null || current.wins === prev.wins) {
              currentGroup.push(current);
          } else {
              finalStandings.push(...resolveTies(currentGroup));
              currentGroup = [current];
          }
      }
      if (currentGroup.length > 0) {
          finalStandings.push(...resolveTies(currentGroup));
      }

      return finalStandings;

  }, [activeTab, tournamentView, filteredMatches, playerLookup]);

  const sortedTournamentIndividuals = useMemo(() => {
    if (activeTab !== 'tournament' || tournamentView !== 'individual') return [];

    const statsMap = new Map<string, {
        player: Player;
        wins: number;
        losses: number;
    }>();

    filteredMatches.forEach(m => {
        let s1 = Number(m.score1);
        let s2 = Number(m.score2);
        if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 === s2) return;

        const isTeam1Win = s1 > s2;

        [...m.team1, ...m.team2].forEach(id => {
            const pid = String(id);
            if (!statsMap.has(pid)) {
                const p = playerLookup.get(pid);
                if (p) statsMap.set(pid, { player: p, wins: 0, losses: 0 });
            }
        });

        m.team1.forEach(id => {
            const s = statsMap.get(String(id));
            if(s) isTeam1Win ? s.wins++ : s.losses++;
        });
        m.team2.forEach(id => {
            const s = statsMap.get(String(id));
            if(s) !isTeam1Win ? s.wins++ : s.losses++;
        });
    });

    return Array.from(statsMap.values())
        .map(item => {
             const p = initialPlayers.find(x => String(x.id) === String(item.player.id));
             const rating = p?.tournamentRating || 3.0;
             return { ...item, rating };
        })
        .filter(item => (item.wins + item.losses) > 0)
        .sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            return b.wins - a.wins;
        });
  }, [activeTab, tournamentView, filteredMatches, playerLookup, initialPlayers]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-700" />;
    return <span className="font-mono text-slate-500 w-5 text-center">{index + 1}</span>;
  };

  return (
    <div className="space-y-4">
       <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
            <button
                onClick={() => { setActiveTab('betting'); setFilterType('month'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${
                    activeTab === 'betting' 
                    ? 'bg-pickle-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Banknote className="w-4 h-4" /> BXH Kèo
            </button>
            <button
                onClick={() => { setActiveTab('tournament'); setFilterType('month'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${
                    activeTab === 'tournament' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Trophy className="w-4 h-4" /> BXH Giải
            </button>
        </div>

      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between w-full border-b border-slate-100 pb-3 mb-1">
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Thời gian:</span>
                <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value as FilterType)}
                    className="text-sm border border-slate-300 bg-white rounded-md px-2 py-1 focus:ring-2 focus:ring-pickle-500 font-bold text-slate-900"
                >
                    <option value="all">Toàn bộ</option>
                    <option value="month">Theo Tháng</option>
                    <option value="week">Theo Tuần</option>
                    <option value="day">Theo Ngày</option>
                </select>
            </div>

            {filterType === 'day' && (
                <input 
                    type="date" 
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="text-sm border border-slate-300 bg-white rounded-md px-2 py-1 text-slate-900 font-bold focus:outline-none focus:border-pickle-500 shadow-sm"
                />
            )}
            {filterType === 'month' && (
                <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="text-sm border border-slate-300 bg-white rounded-md px-2 py-1 text-slate-900 font-bold focus:outline-none focus:border-pickle-500 shadow-sm"
                />
            )}
            {filterType === 'week' && (
                <input 
                    type="week" 
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="text-sm border border-slate-300 bg-white rounded-md px-2 py-1 text-slate-900 font-bold focus:outline-none focus:border-pickle-500 shadow-sm"
                />
            )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            {activeTab === 'betting' && (
                <div className="flex flex-wrap gap-2 text-sm w-full sm:w-auto">
                    <span className="text-sm font-bold text-slate-900 mr-2 flex items-center w-full sm:w-auto mb-2 sm:mb-0">Xếp theo:</span>
                    <button onClick={() => setSortBy('points')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-full border text-xs sm:text-sm transition-colors font-medium ${sortBy === 'points' ? 'bg-pickle-600 border-pickle-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}>Điểm</button>
                    <button onClick={() => setSortBy('wins')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-full border text-xs sm:text-sm transition-colors font-medium ${sortBy === 'wins' ? 'bg-pickle-600 border-pickle-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}>Thắng</button>
                    <button onClick={() => setSortBy('winRate')} className={`flex-1 sm:flex-none px-3 py-1.5 rounded-full border text-xs sm:text-sm transition-colors font-medium ${sortBy === 'winRate' ? 'bg-pickle-600 border-pickle-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}>Tỉ Lệ</button>
                </div>
            )}

            {activeTab === 'tournament' && (
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
                    <button onClick={() => setTournamentView('pairs')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${tournamentView === 'pairs' ? 'bg-pickle-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><Users className="w-4 h-4" /> Cặp Đôi</button>
                    <button onClick={() => setTournamentView('individual')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${tournamentView === 'individual' ? 'bg-pickle-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><User className="w-4 h-4" /> Cá Nhân</button>
                </div>
            )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="w-full">
          <table className="w-full text-sm text-left table-fixed">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] sm:text-xs font-bold border-b border-slate-100">
              <tr>
                <th className="hidden sm:table-cell px-4 py-4 w-16">Hạng</th>
                <th className="px-3 sm:px-6 py-4 w-[45%] sm:w-auto">{activeTab === 'betting' ? 'Người Chơi' : (tournamentView === 'pairs' ? 'Cặp Đôi' : 'Người Chơi')}</th>
                {activeTab === 'betting' && <th className="px-1 sm:px-6 py-4 text-center w-[20%] sm:w-auto">Điểm Kèo</th>}
                {activeTab === 'tournament' && <th className="px-1 sm:px-6 py-4 text-center w-[20%] sm:w-auto">Rating</th>}
                <th className="hidden sm:table-cell px-6 py-4 text-center">Trận</th>
                <th className="px-2 sm:px-6 py-4 text-center w-[30%] sm:w-auto">Thắng/Thua</th>
                {activeTab === 'betting' && <th className="hidden sm:table-cell px-6 py-4 text-center">Tỉ Lệ</th>}
                {activeTab === 'tournament' && tournamentView === 'pairs' && <th className="hidden sm:table-cell px-6 py-4 text-right">HS (Điểm)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTab === 'betting' && sortedBettingPlayers.map((player, index) => {
                const winRate = player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0;
                return (
                  <tr key={player.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="hidden sm:table-cell px-6 py-4">{getRankIcon(index)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                            <div className="sm:hidden w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200">{index + 1}</div>
                            <div className="font-semibold text-slate-900 truncate text-sm sm:text-base">{player.name}</div>
                        </div>
                    </td>
                    <td className="px-1 sm:px-6 py-3 sm:py-4 text-center">
                        <span className={`font-bold px-2 py-1 rounded text-sm sm:text-base ${player.totalRankingPoints > 0 ? 'text-green-700 bg-green-50' : player.totalRankingPoints < 0 ? 'text-red-700 bg-red-50' : 'text-slate-500 bg-slate-100'}`}>
                            {player.totalRankingPoints > 0 ? '+' : ''}{player.totalRankingPoints || 0}
                        </span>
                    </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-center text-slate-700 font-medium">{player.matchesPlayed}</td>
                    <td className="px-2 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm"><span className="text-green-600 font-bold">{player.wins}</span> / <span className="text-slate-400">{player.losses}</span></td>
                    <td className="hidden sm:table-cell px-6 py-4 text-center"><span className={`${winRate >= 50 ? 'text-green-600' : 'text-orange-500'} font-medium`}>{winRate}%</span></td>
                  </tr>
                );
              })}

              {activeTab === 'tournament' && tournamentView === 'pairs' && sortedTournamentPairs.map((pair, index) => {
                  const p1 = initialPlayers.find(x => String(x.id) === String(pair.playerIds[0]));
                  const p2 = initialPlayers.find(x => String(x.id) === String(pair.playerIds[1]));
                  const avgRating = ((p1?.tournamentRating || 3.0) + (p2?.tournamentRating || 3.0)) / 2;
                  return (
                    <tr key={pair.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="hidden sm:table-cell px-6 py-4">{getRankIcon(index)}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2">
                                <div className="sm:hidden w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200">{index + 1}</div>
                                <div className="font-semibold text-slate-900 whitespace-pre-wrap text-xs sm:text-base leading-tight">{pair.names}</div>
                            </div>
                        </td>
                        <td className="px-1 sm:px-6 py-3 sm:py-4 text-center"><span className="text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded text-xs sm:text-sm">{avgRating.toFixed(2)}</span></td>
                        <td className="hidden sm:table-cell px-6 py-4 text-center text-slate-700 font-medium">{pair.wins + pair.losses}</td>
                        <td className="px-2 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm"><span className="text-pickle-600 font-bold">{pair.wins}</span> - <span className="text-red-500 font-bold">{pair.losses}</span></td>
                        <td className="hidden sm:table-cell px-6 py-4 text-right text-slate-500">{pair.pointsScored - pair.pointsConceded}</td>
                    </tr>
                  )
              })}

              {activeTab === 'tournament' && tournamentView === 'individual' && sortedTournamentIndividuals.map((item, index) => (
                <tr key={item.player.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="hidden sm:table-cell px-6 py-4">{getRankIcon(index)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                            <div className="sm:hidden w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200">{index + 1}</div>
                            <div className="font-semibold text-slate-900 text-sm sm:text-base truncate">{item.player.name}</div>
                        </div>
                    </td>
                    <td className="px-1 sm:px-6 py-3 sm:py-4 text-center"><div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs sm:text-sm font-bold bg-blue-100 text-blue-800 border border-blue-200">{item.rating.toFixed(2)}</div></td>
                    <td className="hidden sm:table-cell px-6 py-4 text-center text-slate-700 font-medium">{item.wins + item.losses}</td>
                    <td className="px-2 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm"><span className="text-pickle-600 font-bold">{item.wins}</span> - <span className="text-red-500 font-bold">{item.losses}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};