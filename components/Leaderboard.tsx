import React, { useMemo, useState } from 'react';
import { Player, Match } from '../types';
import { calculatePlayerStats } from '../services/storageService';
import { Trophy, Medal, TrendingUp, TrendingDown, Filter, Banknote, Users, User, Eye, X, Calendar, AlertTriangle } from 'lucide-react';

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
  
  // Advanced Filter State - DEFAULT IS 'month'
  const [filterType, setFilterType] = useState<FilterType>('month');
  
  // Time States
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  
  // Audit State
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

  // Filter Active Players
  const activePlayers = useMemo(() => initialPlayers.filter(p => p.isActive !== false), [initialPlayers]);
  
  // Player Lookup Map
  const playerLookup = useMemo(() => new Map(initialPlayers.map(p => [p.id, p])), [initialPlayers]);

  // Filter matches based on time selection AND tab type
  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
        // 1. Filter by Tab Type
        const matchType = match.type || 'betting';
        if (matchType !== activeTab) return false;

        // 2. Filter by Date
        if (filterType === 'all') return true;
        
        const matchDate = new Date(match.date);
        
        if (filterType === 'day') {
            return match.date.startsWith(selectedDay);
        }

        if (filterType === 'month') {
             return match.date.startsWith(selectedMonth);
        }
        
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

  // --- BETTING (Individual) LOGIC ---
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


  // --- TOURNAMENT (Pair) LOGIC ---
  const sortedTournamentPairs = useMemo(() => {
      if (activeTab !== 'tournament' || tournamentView !== 'pairs') return [];

      const pairsMap = new Map<string, PairStats>();
      const getPairId = (ids: string[]) => ids.slice().sort().join('-');
      const getPairName = (ids: string[]) => ids.map(id => playerLookup.get(id)?.name || 'Unknown').join(' & ');

      // H2H Matrix
      const h2hMatrix = new Map<string, Map<string, number>>();
      
      const updateH2H = (p1Id: string, p2Id: string, winner: 1 | 2) => {
          if (!h2hMatrix.has(p1Id)) h2hMatrix.set(p1Id, new Map());
          if (!h2hMatrix.has(p2Id)) h2hMatrix.set(p2Id, new Map());
          
          const val1 = h2hMatrix.get(p1Id)!.get(p2Id) || 0;
          const val2 = h2hMatrix.get(p2Id)!.get(p1Id) || 0;

          if (winner === 1) {
              h2hMatrix.get(p1Id)!.set(p2Id, val1 + 1);
              h2hMatrix.get(p2Id)!.set(p1Id, val2 - 1);
          } else {
              h2hMatrix.get(p1Id)!.set(p2Id, val1 - 1);
              h2hMatrix.get(p2Id)!.set(p1Id, val2 + 1);
          }
      };

      filteredMatches.forEach(match => {
          if (match.team1.length === 0 || match.team2.length === 0) return;
          
          const p1Valid = match.team1.every(id => playerLookup.has(id));
          const p2Valid = match.team2.every(id => playerLookup.has(id));
          if (!p1Valid || !p2Valid) return; 

          let s1 = Number(match.score1);
          let s2 = Number(match.score2);
          if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;

          if (s1 === s2) return; // Ignore draws

          const winner = s1 > s2 ? 1 : 2;
          const pId1 = getPairId(match.team1);
          const pId2 = getPairId(match.team2);

          if (!pairsMap.has(pId1)) {
              pairsMap.set(pId1, { id: pId1, playerIds: match.team1, names: getPairName(match.team1), wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });
          }
          const stats1 = pairsMap.get(pId1)!;
          stats1.pointsScored += s1;
          stats1.pointsConceded += s2;
          if (winner === 1) stats1.wins++; else stats1.losses++;

          if (!pairsMap.has(pId2)) {
            pairsMap.set(pId2, { id: pId2, playerIds: match.team2, names: getPairName(match.team2), wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });
          }
          const stats2 = pairsMap.get(pId2)!;
          stats2.pointsScored += s2;
          stats2.pointsConceded += s1;
          if (winner === 2) stats2.wins++; else stats2.losses++;
          
          updateH2H(pId1, pId2, winner);
      });

      return Array.from(pairsMap.values())
          .filter(p => (p.wins + p.losses) > 0)
          .sort((a, b) => {
              const diffA = a.wins - a.losses;
              const diffB = b.wins - b.losses;
              if (diffA !== diffB) return diffB - diffA;
              const h2h = h2hMatrix.get(a.id)?.get(b.id) || 0;
              if (h2h !== 0) return -h2h;
              const pDiffA = a.pointsScored - a.pointsConceded;
              const pDiffB = b.pointsScored - b.pointsConceded;
              return pDiffB - pDiffA;
          });

  }, [activeTab, tournamentView, filteredMatches, activePlayers, playerLookup]);

  // --- TOURNAMENT (Individual) LOGIC ---
  const sortedTournamentIndividuals = useMemo(() => {
    if (activeTab !== 'tournament' || tournamentView !== 'individual') return [];

    const statsMap = new Map<string, {
        player: Player;
        wins: number;
        losses: number;
    }>();

    activePlayers.forEach(p => {
        statsMap.set(p.id, { player: p, wins: 0, losses: 0 });
    });

    filteredMatches.forEach(m => {
        let s1 = Number(m.score1);
        let s2 = Number(m.score2);
        if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
        
        if (s1 === s2) return;

        const isTeam1Win = s1 > s2;

        m.team1.forEach(id => {
            const s = statsMap.get(id);
            if(s) isTeam1Win ? s.wins++ : s.losses++;
        });
        m.team2.forEach(id => {
            const s = statsMap.get(id);
            if(s) !isTeam1Win ? s.wins++ : s.losses++;
        });
    });

    return Array.from(statsMap.values())
        .map(item => {
             const rating = item.player.tournamentRating || (item.player.initialPoints || 0) > 20 ? 6.0 : (item.player.initialPoints || 6.0);
             return { ...item, rating };
        })
        .filter(item => (item.wins + item.losses) > 0)
        .sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            return b.wins - a.wins;
        });
  }, [activeTab, tournamentView, filteredMatches, activePlayers]);

  // --- AUDIT DATA LOGIC ---
  const auditMatches = useMemo(() => {
      if (!auditPlayerId) return [];
      
      const results: { match: Match; result: 'WIN' | 'LOSS'; detail: string }[] = [];
      
      // Sort matches oldest to newest to follow progression, or newest first for checking
      // Let's do newest first for checking
      const playerMatches = filteredMatches
        .filter(m => m.team1.includes(auditPlayerId) || m.team2.includes(auditPlayerId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      playerMatches.forEach(m => {
          let s1 = Number(m.score1);
          let s2 = Number(m.score2);
          if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;

          if (s1 === s2) return; // Draws ignored

          const isTeam1 = m.team1.includes(auditPlayerId);
          const isTeam1Win = s1 > s2;
          
          const isWin = (isTeam1 && isTeam1Win) || (!isTeam1 && !isTeam1Win);
          
          results.push({
              match: m,
              result: isWin ? 'WIN' : 'LOSS',
              detail: isTeam1 
                ? `Bạn ở Team 1. Tỉ số ${s1}-${s2} (${isTeam1Win ? 'Thắng' : 'Thua'})`
                : `Bạn ở Team 2. Tỉ số ${s1}-${s2} (${!isTeam1Win ? 'Thắng' : 'Thua'})`
          });
      });
      
      return results;
  }, [auditPlayerId, filteredMatches]);


  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-700" />;
    return <span className="font-mono text-slate-500 w-5 text-center">{index + 1}</span>;
  };

  const getNames = (ids: string[]) => ids.map(id => playerLookup.get(id)?.name || 'Unknown').join(' & ');

  return (
    <div className="space-y-4">
       {/* Top Tabs */}
       <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
            <button
                onClick={() => setActiveTab('betting')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${
                    activeTab === 'betting' 
                    ? 'bg-pickle-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Banknote className="w-4 h-4" /> BXH Kèo
            </button>
            <button
                onClick={() => setActiveTab('tournament')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${
                    activeTab === 'tournament' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Trophy className="w-4 h-4" /> BXH Giải
            </button>
        </div>

      {/* Filter Controls */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        
        {/* Time Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between w-full border-b border-slate-100 pb-3 mb-1">
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-900">Thời gian:</span>
                <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value as FilterType)}
                    className="text-sm border border-slate-300 bg-white rounded-md px-2 py-1 focus:ring-2 focus:ring-pickle-500 font-bold text-slate-900"
                >
                    <option value="day">Theo Ngày</option>
                    <option value="month">Theo Tháng</option>
                    <option value="week">Theo Tuần</option>
                    <option value="all">Toàn bộ</option>
                </select>
            </div>

            {/* Specific Date Pickers */}
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

        {/* View Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            {/* Betting Sort */}
            {activeTab === 'betting' && (
                <div className="flex flex-wrap gap-2 text-sm w-full sm:w-auto">
                    <span className="text-sm font-bold text-slate-900 mr-2 flex items-center w-full sm:w-auto mb-2 sm:mb-0">Xếp theo:</span>
                    <button
                        onClick={() => setSortBy('points')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-full border text-xs sm:text-sm transition-colors font-medium ${sortBy === 'points' ? 'bg-pickle-600 border-pickle-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}
                    >
                        Điểm
                    </button>
                    <button
                        onClick={() => setSortBy('wins')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-full border text-xs sm:text-sm transition-colors font-medium ${sortBy === 'wins' ? 'bg-pickle-600 border-pickle-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}
                    >
                        Thắng
                    </button>
                    <button
                        onClick={() => setSortBy('winRate')}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-full border text-xs sm:text-sm transition-colors font-medium ${sortBy === 'winRate' ? 'bg-pickle-600 border-pickle-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}
                    >
                        Tỉ Lệ
                    </button>
                </div>
            )}

            {/* Tournament View Toggle */}
            {activeTab === 'tournament' && (
                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
                    <button
                        onClick={() => setTournamentView('pairs')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            tournamentView === 'pairs' 
                            ? 'bg-pickle-600 text-white shadow-sm' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Users className="w-4 h-4" /> Cặp Đôi
                    </button>
                    <button
                        onClick={() => setTournamentView('individual')}
                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                            tournamentView === 'individual' 
                            ? 'bg-pickle-600 text-white shadow-sm' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <User className="w-4 h-4" /> Cá Nhân
                    </button>
                </div>
            )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-0 sm:p-0">
        <div className="w-full">
          <table className="w-full text-sm text-left table-fixed">
            <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] sm:text-xs font-bold border-b border-slate-100">
              <tr>
                <th className="hidden sm:table-cell px-4 py-4 w-16">Hạng</th>
                <th className="px-3 sm:px-6 py-4 w-[50%] sm:w-auto">
                    {activeTab === 'betting' ? 'Người Chơi' : (tournamentView === 'pairs' ? 'Cặp Đôi' : 'Người Chơi')}
                </th>
                
                {activeTab === 'betting' && <th className="px-1 sm:px-6 py-4 text-center w-[20%] sm:w-auto">Điểm XH</th>}
                
                {activeTab === 'tournament' && tournamentView === 'individual' && (
                    <th className="px-1 sm:px-6 py-4 text-center w-[20%] sm:w-auto">Rating</th>
                )}

                <th className="hidden sm:table-cell px-6 py-4 text-center">Trận</th>
                <th className="px-2 sm:px-6 py-4 text-center w-[30%] sm:w-auto">Thắng/Thua</th>
                
                {activeTab === 'betting' && <th className="hidden sm:table-cell px-6 py-4 text-center">Tỉ Lệ</th>}
                
                {(activeTab === 'betting' || tournamentView === 'pairs') && (
                     <th className="hidden sm:table-cell px-6 py-4 text-right">Hiệu Số</th>
                )}
                
                {activeTab === 'tournament' && tournamentView === 'pairs' && (
                    <th className="hidden sm:table-cell px-6 py-4 text-right">HS (Điểm)</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* BETTING LIST */}
              {activeTab === 'betting' && sortedBettingPlayers.map((player, index) => {
                const winRate = player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0;
                // CHANGED: Display Match Difference (Wins - Losses) instead of Point Difference
                const matchDiff = player.wins - player.losses;
                
                return (
                  <tr key={player.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* PC Rank */}
                    <td className="hidden sm:table-cell px-6 py-4 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        {getRankIcon(index)}
                      </div>
                    </td>
                    
                    {/* Name & Mobile Info */}
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-0">
                         {/* Mobile Rank Badge */}
                         <div className="sm:hidden flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200">
                             {index + 1}
                         </div>
                         <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <div className="font-semibold text-slate-900 truncate text-sm sm:text-base">{player.name}</div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setAuditPlayerId(player.id); }}
                                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-colors"
                                    title="Soi kèo (Xem chi tiết trận đấu)"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2 sm:hidden text-[10px] text-slate-500 mt-0.5">
                                <span className={`${winRate >= 50 ? 'text-green-600' : 'text-orange-500'}`}>{winRate}% Win</span>
                                <span>•</span>
                                {/* Mobile Display: Match Diff */}
                                <span className={`${matchDiff > 0 ? 'text-green-600' : 'text-slate-400'}`}>{matchDiff > 0 ? '+' : ''}{matchDiff} HS</span>
                            </div>
                         </div>
                      </div>
                    </td>
                    
                    {/* Points */}
                    <td className="px-1 sm:px-6 py-3 sm:py-4 text-center">
                        <span className="font-bold text-pickle-700 bg-pickle-50/50 px-2 py-1 rounded text-sm sm:text-base">
                            {player.totalRankingPoints}
                        </span>
                    </td>
                    
                    {/* PC Matches */}
                    <td className="hidden sm:table-cell px-6 py-4 text-center text-slate-700 font-medium">{player.matchesPlayed}</td>
                    
                    {/* W/L */}
                    <td className="px-2 sm:px-6 py-3 sm:py-4 text-center font-medium text-slate-700 text-xs sm:text-sm">
                        <span className="text-green-600">{player.wins}</span> / <span className="text-slate-400">{player.losses}</span>
                        <div className="sm:hidden text-[10px] text-slate-400 mt-0.5">({player.matchesPlayed} trận)</div>
                    </td>
                    
                    {/* PC Winrate */}
                    <td className="hidden sm:table-cell px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`${winRate >= 50 ? 'text-green-600' : 'text-orange-500'} font-medium`}>{winRate}%</span>
                      </div>
                    </td>
                    
                    {/* PC Diff (Changed to Match Diff) */}
                    <td className="hidden sm:table-cell px-6 py-4 text-right">
                       <span className={`inline-flex items-center gap-1 ${matchDiff > 0 ? 'text-green-600' : matchDiff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                         {matchDiff > 0 ? '+' : ''}{matchDiff}
                         {matchDiff > 0 ? <TrendingUp className="w-3 h-3"/> : matchDiff < 0 ? <TrendingDown className="w-3 h-3"/> : null}
                       </span>
                    </td>
                  </tr>
                );
              })}

              {/* TOURNAMENT PAIRS LIST */}
              {activeTab === 'tournament' && tournamentView === 'pairs' && sortedTournamentPairs.map((pair, index) => {
                  const matchDiff = pair.wins - pair.losses;
                  const pointDiff = pair.pointsScored - pair.pointsConceded;
                  const totalMatches = pair.wins + pair.losses;

                  return (
                    <tr key={pair.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="hidden sm:table-cell px-6 py-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                                {getRankIcon(index)}
                            </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-0">
                                <div className="sm:hidden flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200">
                                     {index + 1}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <div className="font-semibold text-slate-900 whitespace-pre-wrap text-xs sm:text-base leading-tight">{pair.names}</div>
                                    <div className="flex items-center gap-2 sm:hidden text-[10px] text-slate-500 mt-1">
                                         <span>HS: {matchDiff > 0 ? '+' : ''}{matchDiff}</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        
                        <td className="hidden sm:table-cell px-6 py-4 text-center text-slate-700 font-medium">{totalMatches}</td>
                        <td className="px-2 sm:px-6 py-3 sm:py-4 text-center font-medium text-slate-700 text-xs sm:text-sm">
                            <span className="text-pickle-600">{pair.wins}</span> - <span className="text-red-500">{pair.losses}</span>
                            <div className="sm:hidden text-[10px] text-slate-400 mt-0.5">({totalMatches} trận)</div>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 text-right font-bold text-slate-800">
                            {matchDiff > 0 ? '+' : ''}{matchDiff}
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 text-right text-slate-500">
                            {pointDiff > 0 ? '+' : ''}{pointDiff}
                        </td>
                    </tr>
                  )
              })}

              {/* TOURNAMENT INDIVIDUALS LIST */}
              {activeTab === 'tournament' && tournamentView === 'individual' && sortedTournamentIndividuals.map((item, index) => {
                  return (
                    <tr key={item.player.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="hidden sm:table-cell px-6 py-4 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                                {getRankIcon(index)}
                            </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-0">
                                <div className="sm:hidden flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200">
                                     {index + 1}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="font-semibold text-slate-900 text-sm sm:text-base truncate">{item.player.name}</div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setAuditPlayerId(item.player.id); }}
                                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-colors"
                                        title="Soi kèo (Xem chi tiết trận đấu)"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </td>
                        <td className="px-1 sm:px-6 py-3 sm:py-4 text-center">
                            <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs sm:text-sm font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                {/* CHANGED: Rating rounded to 2 decimals */}
                                {item.rating.toFixed(2)}
                            </div>
                        </td>
                        <td className="hidden sm:table-cell px-6 py-4 text-center text-slate-700 font-medium">{item.wins + item.losses}</td>
                        <td className="px-2 sm:px-6 py-3 sm:py-4 text-center font-medium text-slate-700 text-xs sm:text-sm">
                            <span className="text-pickle-600">{item.wins}</span> - <span className="text-red-500">{item.losses}</span>
                            <div className="sm:hidden text-[10px] text-slate-400 mt-0.5">({item.wins + item.losses} trận)</div>
                        </td>
                    </tr>
                  )
              })}
            </tbody>
          </table>
        </div>
        
        {/* Empty States */}
        {((activeTab === 'betting' && sortedBettingPlayers.length === 0) || 
          (activeTab === 'tournament' && tournamentView === 'pairs' && sortedTournamentPairs.length === 0) ||
          (activeTab === 'tournament' && tournamentView === 'individual' && sortedTournamentIndividuals.length === 0)
         ) && (
          <div className="p-8 text-center text-slate-500">
              <p className="mb-2">Chưa có dữ liệu cho bộ lọc này.</p>
              <p className="text-xs">Chỉ những người chơi đã thi đấu trong thời gian chọn mới được hiển thị.</p>
          </div>
        )}
      </div>

      {/* AUDIT MODAL */}
      {auditPlayerId && (
          <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                  <div className="bg-slate-100 p-4 flex items-center justify-between border-b border-slate-200">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                          Rà Soát Kết Quả: {playerLookup.get(auditPlayerId)?.name}
                      </h3>
                      <button onClick={() => setAuditPlayerId(null)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-3 bg-yellow-50 text-yellow-800 text-xs border-b border-yellow-100 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>Danh sách này hiển thị <strong>chính xác</strong> cách hệ thống đang tính điểm cho BXH hiện tại (dựa trên bộ lọc thời gian bạn chọn). Hãy tìm trận đấu có kết quả <strong>WIN</strong> nhưng thực tế là thua.</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {auditMatches.length > 0 ? (
                          auditMatches.map((item, idx) => (
                              <div key={idx} className={`border rounded-lg p-3 flex flex-col gap-2 ${item.result === 'WIN' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                  <div className="flex justify-between items-start">
                                      <div className="flex items-center gap-2 text-xs text-slate-500">
                                          <Calendar className="w-3 h-3" />
                                          {new Date(item.match.date).toLocaleDateString('vi-VN')} {new Date(item.match.date).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                      </div>
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${item.result === 'WIN' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                          {item.result}
                                      </span>
                                  </div>
                                  
                                  <div className="text-sm font-bold text-slate-800 flex justify-between items-center bg-white/50 p-2 rounded">
                                      <span className={item.match.team1.includes(auditPlayerId) ? 'text-blue-700 underline decoration-2' : 'text-slate-600'}>
                                          {getNames(item.match.team1)}
                                      </span>
                                      <div className="flex items-center gap-1 font-mono text-lg mx-2">
                                          <span className={Number(item.match.score1) > Number(item.match.score2) ? 'text-green-600' : 'text-slate-400'}>{item.match.score1}</span>
                                          <span className="text-slate-300">-</span>
                                          <span className={Number(item.match.score2) > Number(item.match.score1) ? 'text-blue-600' : 'text-slate-400'}>{item.match.score2}</span>
                                      </div>
                                      <span className={item.match.team2.includes(auditPlayerId) ? 'text-blue-700 underline decoration-2' : 'text-slate-600'}>
                                          {getNames(item.match.team2)}
                                      </span>
                                  </div>

                                  <div className="text-[10px] text-slate-500 italic">
                                      {item.detail} (ID: {item.match.id.slice(-4)})
                                  </div>
                              </div>
                          ))
                      ) : (
                          <div className="text-center text-slate-400 py-8">Không tìm thấy trận đấu nào trong thời gian này.</div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};