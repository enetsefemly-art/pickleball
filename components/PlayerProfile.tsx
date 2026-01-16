import React, { useMemo, useState } from 'react';
import { Player, Match } from '../types';
import { Card } from './Card';
import { Trophy, TrendingUp, DollarSign, X, AlertTriangle, Target, Gamepad2, Award, Handshake, HeartCrack, Users, List, Calendar, ChevronRight, Activity, Gift } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell } from 'recharts';
import { getDailyRatingHistory, getTournamentStandings } from '../services/storageService';

interface PlayerProfileProps {
  player: Player;
  players: Player[]; // Full list to lookup names
  matches: Match[];
  onClose: () => void;
}

interface RivalStats {
    id: string;
    name: string;
    matchesWith: number; // Matches played against
    winsAgainst: number;
    winRate: number;
}

interface PartnerStats {
    id: string;
    name: string;
    matchesTogether: number;
    winsTogether: number;
    winRate: number;
}

export const PlayerProfile: React.FC<PlayerProfileProps> = ({ player, players, matches, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  // Create a lookup for player names
  const playerLookup = useMemo(() => new Map(players.map(p => [String(p.id), p])), [players]);

  // --- CHAMPIONSHIP CALCULATION (GLOBAL HISTORY) ---
  const calculatedChampionships = useMemo(() => {
      const uniqueMonths = new Set<string>();
      // Scan ALL matches to find all tournament months involved
      matches.forEach(m => {
          if (m.type === 'tournament') {
              uniqueMonths.add(m.date.slice(0, 7));
          }
      });

      let count = 0;
      const pId = String(player.id);

      uniqueMonths.forEach(monthKey => {
          // Get standings for that month using ALL matches (no time limit filter applied to 'matches' prop here)
          const standings = getTournamentStandings(monthKey, players, matches);
          // Check if this player is in the #1 team
          if (standings.length > 0) {
              const championTeam = standings[0];
              if (championTeam.playerIds.includes(pId)) {
                  count++;
              }
          }
      });
      return count;
  }, [matches, player.id, players]);

  // --- ANALYSIS LOGIC ---
  const analysis = useMemo(() => {
    // 1. Filter matches involving this player
    const currentPid = String(player.id);
    
    const playerMatches = matches
        .filter(m => {
            const t1 = m.team1?.map(String) || [];
            const t2 = m.team2?.map(String) || [];
            return t1.includes(currentPid) || t2.includes(currentPid);
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first

    // Data containers
    const opponentsMap = new Map<string, { wins: number; total: number }>();
    const partnersMap = new Map<string, { wins: number; total: number }>();

    playerMatches.forEach(m => {
        const t1 = m.team1.map(String);
        const t2 = m.team2.map(String);
        
        const isTeam1 = t1.includes(currentPid);
        
        // --- STRICT WINNER LOGIC ---
        let s1 = Number(m.score1);
        let s2 = Number(m.score2);
        if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
        
        // Skip strictly drawn matches from stats (same as leaderboard)
        if (s1 === s2) return;

        let winner: 1 | 2;
        if (s1 > s2) winner = 1;
        else if (s2 > s1) winner = 2;
        else winner = Number(m.winner) === 1 ? 1 : 2;

        const isWin = isTeam1 ? winner === 1 : winner === 2;

        // --- RIVAL LOGIC (Opponents) ---
        const opponentIds = isTeam1 ? t2 : t1;
        opponentIds.forEach(oppId => {
            // Skip if playing against self (bug safety)
            if (oppId === currentPid) return;

            if (!opponentsMap.has(oppId)) opponentsMap.set(oppId, { wins: 0, total: 0 });
            const stat = opponentsMap.get(oppId)!;
            stat.total += 1;
            if (isWin) stat.wins += 1;
        });

        // --- PARTNER LOGIC (Teammates) ---
        // Find the OTHER player in my team
        const myTeam = isTeam1 ? t1 : t2;
        const partnerId = myTeam.find(id => id !== currentPid);

        if (partnerId) {
            if (!partnersMap.has(partnerId)) partnersMap.set(partnerId, { wins: 0, total: 0 });
            const stat = partnersMap.get(partnerId)!;
            stat.total += 1;
            if (isWin) stat.wins += 1;
        }
    });

    // --- PROCESS RIVALS ---
    const rivals: RivalStats[] = Array.from(opponentsMap.entries()).map(([id, stat]) => {
        const p = playerLookup.get(String(id));
        return {
            id,
            name: p ? p.name : `Người cũ (${id.slice(-3)})`,
            matchesWith: stat.total,
            winsAgainst: stat.wins,
            winRate: stat.total > 0 ? stat.wins / stat.total : 0
        };
    });

    // Filter Rivals: At least 3 matches against
    const eligibleRivals = rivals.filter(r => r.matchesWith >= 3);

    // Find "Con mồi" (Highest Win Rate)
    let prey = eligibleRivals.length > 0 ? [...eligibleRivals]
        .sort((a, b) => {
            if (b.winRate !== a.winRate) return b.winRate - a.winRate; 
            return b.matchesWith - a.matchesWith;
        })[0] : undefined;

    // Find "Kị giơ" (Lowest Win Rate)
    let nemesis = eligibleRivals.length > 0 ? [...eligibleRivals]
        .sort((a, b) => {
            if (a.winRate !== b.winRate) return a.winRate - b.winRate; 
            return b.matchesWith - a.matchesWith;
        })[0] : undefined;
    
    // Conflict Resolution
    if (prey && nemesis && prey.id === nemesis.id) {
         if (prey.winRate >= 0.5) nemesis = undefined;
         else prey = undefined;
    }

    // --- PROCESS PARTNERS ---
    const partners: PartnerStats[] = Array.from(partnersMap.entries()).map(([id, stat]) => {
        const p = playerLookup.get(String(id));
        return {
            id,
            name: p ? p.name : `Người cũ (${id.slice(-3)})`,
            matchesTogether: stat.total,
            winsTogether: stat.wins,
            winRate: stat.total > 0 ? stat.wins / stat.total : 0
        };
    });

    const sortedPartners = [...partners].sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.matchesTogether - a.matchesTogether;
    });

    const eligiblePartners = partners.filter(p => p.matchesTogether >= 3);

    let bestPartner = eligiblePartners.length > 0 ? [...eligiblePartners].sort((a, b) => {
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            return b.matchesTogether - a.matchesTogether;
        })[0] : undefined;

    let worstPartner = eligiblePartners.length > 0 ? [...eligiblePartners].sort((a, b) => {
            if (a.winRate !== b.winRate) return a.winRate - b.winRate;
            return b.matchesTogether - a.matchesTogether;
        })[0] : undefined;

    if (bestPartner && worstPartner && bestPartner.id === worstPartner.id) {
         if (bestPartner.winRate >= 0.5) worstPartner = undefined;
         else bestPartner = undefined;
    }

    // 3. Chart Data: Weekly Win Rate
    const weeklyMap = new Map<string, { wins: number; total: number; sortKey: number }>();
    const chronoMatches = [...playerMatches].reverse();

    chronoMatches.forEach(m => {
        let s1 = Number(m.score1);
        let s2 = Number(m.score2);
        if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
        if (s1 === s2) return; // Skip draws in charts too

        const d = new Date(m.date);
        const day = d.getDay(); 
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d);
        monday.setDate(diff);
        monday.setHours(0,0,0,0);
        
        const label = `${monday.getDate().toString().padStart(2, '0')}/${(monday.getMonth() + 1).toString().padStart(2, '0')}`;
        const sortKey = monday.getTime();

        if (!weeklyMap.has(label)) weeklyMap.set(label, { wins: 0, total: 0, sortKey });
        const stat = weeklyMap.get(label)!;
        stat.total += 1;
        
        const t1 = m.team1.map(String);
        const isTeam1 = t1.includes(currentPid);
        
        let winner: 1 | 2 = s1 > s2 ? 1 : 2;
        // Fallback only if scores are weirdly equal but not skipped
        if (s1 === s2) winner = Number(m.winner) === 1 ? 1 : 2;

        const isWin = isTeam1 ? winner === 1 : winner === 2;
        
        if (isWin) stat.wins += 1;
    });

    const winRateChartData = Array.from(weeklyMap.entries())
        .sort((a, b) => a[1].sortKey - b[1].sortKey)
        .map(([name, stat]) => ({
            name,
            winRate: Math.round((stat.wins / stat.total) * 100)
        }));

    // 4. Chart Data: Financials
    const financeMap = new Map<string, number>();
    
    chronoMatches.filter(m => (m.type || 'betting') === 'betting').forEach(m => {
        let s1 = Number(m.score1);
        let s2 = Number(m.score2);
        if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
        if (s1 === s2) return;

        const d = new Date(m.date);
        const dateKey = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }); 
        
        const points = m.rankingPoints || 50;
        const t1 = m.team1.map(String);
        const isTeam1 = t1.includes(currentPid);
        
        let winner: 1 | 2 = s1 > s2 ? 1 : 2;
        const isWin = isTeam1 ? winner === 1 : winner === 2;
        const impact = isWin ? points : -points;
        
        financeMap.set(dateKey, (financeMap.get(dateKey) || 0) + impact);
    });

    const financeChartData = Array.from(financeMap.entries()).map(([date, amount]) => ({
        date,
        amount
    }));

    return { 
        playerMatches, // Exposed for History Tab
        prey, nemesis, bestPartner, worstPartner, sortedPartners, winRateChartData, financeChartData 
    };

  }, [player, matches, playerLookup]);

  // --- DAILY SUMMARY LOGIC (WITH RATING SIMULATION) ---
  const dailySummary = useMemo(() => {
        const currentPid = String(player.id);
        
        // 1. Get Base Rating History from storageService (Includes everything)
        const fullHistory = getDailyRatingHistory(players, matches);
        
        // Create delta map: date -> rating change for THIS player
        const ratingDeltaMap = new Map<string, number>();
        let prevRating = typeof player.initialPoints === 'number' ? player.initialPoints : 1000;
        
        // If history has initial entry before any matches? No, matches drive history.
        // We iterate chronologically to find diffs.
        fullHistory.forEach(day => {
            const newRating = day.ratings[currentPid];
            if (newRating !== undefined) {
                const diff = newRating - prevRating;
                if (Math.abs(diff) > 0.001) {
                    ratingDeltaMap.set(day.date, diff);
                }
                prevRating = newRating;
            }
        });

        // 2. Identify Tournament Bonuses Explicitly for Display
        // We need to know EXACTLY when tournaments ended to pin the note.
        const bonusNotes = new Map<string, string>(); // Date -> "Bonus Hạng 1"
        const tournamentEndDates = new Map<string, string>(); // Month -> LastMatchDate

        // Scan all matches to find the end date of each tournament month
        // We sort matches chronologically first
        const sortedAllMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        sortedAllMatches.forEach(m => {
            if (m.type === 'tournament') {
                const month = m.date.slice(0, 7);
                const day = m.date.split('T')[0];
                tournamentEndDates.set(month, day); // Will overwrite until the last one remains
            }
        });

        tournamentEndDates.forEach((endDate, monthKey) => {
            const standings = getTournamentStandings(monthKey, players, matches);
            if (standings.length >= 3) {
                // Check if player is in top 3
                const rankIdx = standings.findIndex(t => t.playerIds.includes(currentPid));
                if (rankIdx >= 0 && rankIdx <= 2) {
                    const place = rankIdx + 1;
                    
                    // Calculate exact bonus to show user
                    const N = standings.length;
                    const S = 1 + 0.10 * (N - 5);
                    const baseBonuses: Record<number, number> = { 1: 0.10, 2: 0.07, 3: 0.05 };
                    const rawBonus = baseBonuses[place] * S;
                    const bonusVal = Math.min(0.15, Math.round(rawBonus * 100) / 100);

                    // Set note on the TOURNAMENT END DATE, not just when player played
                    bonusNotes.set(endDate, `Thưởng Top ${place} (+${bonusVal.toFixed(2)})`);
                }
            }
        });

        // 3. Standard Aggregation
        const summary = new Map<string, { date: string, wins: number, losses: number, netPoints: number, matchCount: number, ratingChange: number, note?: string }>();

        // 3a. Process Actual Matches Played
        analysis.playerMatches.forEach(m => {
            const dateKey = m.date.split('T')[0];
            
            if (!summary.has(dateKey)) {
                summary.set(dateKey, { 
                    date: dateKey, 
                    wins: 0, 
                    losses: 0, 
                    netPoints: 0, 
                    matchCount: 0,
                    ratingChange: ratingDeltaMap.get(dateKey) || 0,
                    note: bonusNotes.get(dateKey)
                });
            }
            const day = summary.get(dateKey)!;

            let s1 = Number(m.score1);
            let s2 = Number(m.score2);
            if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
            if (s1 === s2) return;

            day.matchCount++;

            const isTeam1 = m.team1.map(String).includes(currentPid);
            const winner = s1 > s2 ? 1 : 2;
            const isWin = isTeam1 ? winner === 1 : winner === 2;

            const isBetting = (m.type || 'betting') === 'betting';
            const points = (isBetting && m.rankingPoints) ? Number(m.rankingPoints) : 0;

            if (isWin) {
                day.wins++;
                if (isBetting) day.netPoints += points;
            } else {
                day.losses++;
                if (isBetting) day.netPoints -= points;
            }
        });

        // 3b. Process Dates with ONLY Bonuses (Ghost Entries)
        // If a player got a bonus on a day they didn't play (e.g. final day), ensure it shows up
        bonusNotes.forEach((note, dateKey) => {
            if (!summary.has(dateKey)) {
                summary.set(dateKey, {
                    date: dateKey,
                    wins: 0,
                    losses: 0,
                    netPoints: 0,
                    matchCount: 0,
                    ratingChange: ratingDeltaMap.get(dateKey) || 0, // Should find the bonus delta here
                    note: note
                });
            } else {
                // Ensure note is attached if key existed from playing
                const existing = summary.get(dateKey)!;
                if (!existing.note) existing.note = note;
            }
        });

        return Array.from(summary.values()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [analysis.playerMatches, player.id, players, matches]);


  const getNames = (ids: string[]) => ids.map(id => playerLookup.get(String(id))?.name || 'Unknown').join(' & ');

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur-sm overflow-y-auto animate-fade-in">
        <div className="min-h-full p-4 flex items-center justify-center">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden relative">
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                >
                    <X className="w-5 h-5 text-slate-600" />
                </button>

                {/* HEADER PROFILE */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 md:p-8">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="relative">
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-slate-700 border-4 border-slate-600 flex items-center justify-center text-4xl font-bold text-slate-300 shadow-xl">
                                {player.name.charAt(0).toUpperCase()}
                            </div>
                            {calculatedChampionships > 0 && (
                                <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border-2 border-slate-800 flex items-center gap-1">
                                    <Trophy className="w-3 h-3 fill-current" />
                                    {calculatedChampionships}
                                </div>
                            )}
                        </div>
                        
                        <div className="text-center md:text-left space-y-2">
                            <h2 className="text-3xl font-black tracking-tight">{player.name}</h2>
                            <div className="flex flex-wrap justify-center md:justify-start gap-2">
                                <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-bold border border-white/20">
                                    ID: {player.id}
                                </span>
                                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-bold border border-blue-500/30">
                                    Rating: {(player.tournamentRating || player.initialPoints || 0).toFixed(1)}
                                </span>
                            </div>
                            
                            {/* Trophy Case */}
                            {calculatedChampionships > 0 && (
                                <div className="flex items-center justify-center md:justify-start gap-1 pt-2">
                                    {Array.from({ length: Math.min(calculatedChampionships, 5) }).map((_, i) => (
                                        <Trophy key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400 drop-shadow-sm" />
                                    ))}
                                    {calculatedChampionships > 5 && (
                                        <span className="text-xs text-yellow-400 font-bold">+{ calculatedChampionships - 5 }</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'overview' ? 'border-pickle-500 text-pickle-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        <TrendingUp className="w-4 h-4" /> Tổng Quan
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'history' ? 'border-pickle-500 text-pickle-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        <List className="w-4 h-4" /> Nhật Ký ({player.wins}W / {player.losses}L)
                    </button>
                </div>

                <div className="p-6 md:p-8 space-y-8 bg-slate-50 min-h-[400px]">
                    
                    {activeTab === 'overview' && (
                        <>
                            {/* STATS GRID */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                                <Card className="p-4 flex flex-col items-center justify-center text-center border-none shadow-md">
                                    <Gamepad2 className="w-6 h-6 text-slate-400 mb-2" />
                                    <div className="text-2xl font-black text-slate-800">{player.matchesPlayed}</div>
                                    <div className="text-xs text-slate-500 font-bold uppercase">Trận Đấu</div>
                                </Card>
                                
                                <Card className="p-4 flex flex-col items-center justify-center text-center border-none shadow-md">
                                    <Award className="w-6 h-6 text-green-500 mb-2" />
                                    <div className="text-2xl font-black text-slate-800">
                                        {player.matchesPlayed > 0 ? Math.round((player.wins / player.matchesPlayed) * 100) : 0}%
                                    </div>
                                    <div className="text-xs text-slate-500 font-bold uppercase">Tỉ Lệ Thắng</div>
                                </Card>

                                <Card className="p-4 flex flex-col items-center justify-center text-center border-none shadow-md">
                                    <DollarSign className={`w-6 h-6 mb-2 ${player.totalRankingPoints >= 0 ? 'text-green-600' : 'text-red-500'}`} />
                                    <div className={`text-2xl font-black ${player.totalRankingPoints >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {player.totalRankingPoints > 0 ? '+' : ''}{player.totalRankingPoints}
                                    </div>
                                    <div className="text-xs text-slate-500 font-bold uppercase">Luỹ Kế Kèo</div>
                                </Card>

                                <Card className="p-4 flex flex-col items-center justify-center text-center border-none shadow-md bg-yellow-50 border-yellow-200">
                                    <Trophy className="w-6 h-6 text-yellow-600 mb-2" />
                                    <div className="text-2xl font-black text-yellow-700">{calculatedChampionships}</div>
                                    <div className="text-xs text-yellow-600 font-bold uppercase">Vô Địch</div>
                                </Card>
                            </div>

                            {/* SECTION: RIVALS & PARTNERS HIGHLIGHTS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                
                                {/* RIVALS (Con mồi & Kị giơ) */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Đối Thủ (Tiêu biểu)</h3>
                                    
                                    {/* CON MỒI */}
                                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Target className="w-16 h-16" />
                                        </div>
                                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            <Target className="w-4 h-4 text-green-500" /> Con mồi quen thuộc
                                        </h4>
                                        {analysis.prey ? (
                                            <div>
                                                <div className="text-lg font-bold text-slate-800">{analysis.prey.name}</div>
                                                <div className="flex items-center gap-2 mt-1 text-xs">
                                                    <span className="font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                                        {Math.round(analysis.prey.winRate * 100)}% Thắng
                                                    </span>
                                                    <span className="text-slate-400">
                                                        / {analysis.prey.matchesWith} trận
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-slate-400 text-xs italic py-1">Chưa đủ dữ liệu (tối thiểu 3 trận).</div>
                                        )}
                                    </div>

                                    {/* KỊ GIƠ */}
                                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <AlertTriangle className="w-16 h-16" />
                                        </div>
                                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            <AlertTriangle className="w-4 h-4 text-red-500" /> Kị giơ cứng
                                        </h4>
                                        {analysis.nemesis ? (
                                            <div>
                                                <div className="text-lg font-bold text-slate-800">{analysis.nemesis.name}</div>
                                                <div className="flex items-center gap-2 mt-1 text-xs">
                                                    <span className="font-mono font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">
                                                        {Math.round((1 - analysis.nemesis.winRate) * 100)}% Thua
                                                    </span>
                                                    <span className="text-slate-400">
                                                        / {analysis.nemesis.matchesWith} trận
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-slate-400 text-xs italic py-1">Chưa đủ dữ liệu (tối thiểu 3 trận).</div>
                                        )}
                                    </div>
                                </div>

                                {/* PARTNERS (Hảo huynh đệ & Buông tay nhau ra) */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Đồng Đội (Tiêu biểu)</h3>

                                    {/* HẢO HUYNH ĐỆ (Best Partner) */}
                                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Handshake className="w-16 h-16" />
                                        </div>
                                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            <Handshake className="w-4 h-4 text-blue-500" /> Hảo huynh đệ
                                        </h4>
                                        {analysis.bestPartner ? (
                                            <div>
                                                <div className="text-lg font-bold text-slate-800">{analysis.bestPartner.name}</div>
                                                <div className="flex items-center gap-2 mt-1 text-xs">
                                                    <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                        {Math.round(analysis.bestPartner.winRate * 100)}% Thắng
                                                    </span>
                                                    <span className="text-slate-400">
                                                        / {analysis.bestPartner.matchesTogether} trận cùng phe
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-slate-400 text-xs italic py-1">Chưa đủ dữ liệu (tối thiểu 3 trận).</div>
                                        )}
                                    </div>

                                    {/* BUÔNG TAY NHAU RA (Worst Partner) */}
                                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <HeartCrack className="w-16 h-16" />
                                        </div>
                                        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            <HeartCrack className="w-4 h-4 text-purple-500" /> Buông tay nhau ra
                                        </h4>
                                        {analysis.worstPartner ? (
                                            <div>
                                                <div className="text-lg font-bold text-slate-800">{analysis.worstPartner.name}</div>
                                                <div className="flex items-center gap-2 mt-1 text-xs">
                                                    <span className="font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                                        {Math.round((1 - analysis.worstPartner.winRate) * 100)}% Thua
                                                    </span>
                                                    <span className="text-slate-400">
                                                        / {analysis.worstPartner.matchesTogether} trận cùng phe
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-slate-400 text-xs italic py-1">Chưa đủ dữ liệu (tối thiểu 3 trận).</div>
                                        )}
                                    </div>
                                </div>

                            </div>

                            {/* NEW SECTION: FULL PARTNER HISTORY LIST */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-slate-500" />
                                    <h3 className="font-bold text-slate-800 text-sm md:text-base">Lịch Sử Đánh Cặp Chi Tiết</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] md:text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-3">Người Đánh Cùng</th>
                                                <th className="px-4 py-3 text-center">Số Trận</th>
                                                <th className="px-4 py-3 text-center">Thắng - Thua</th>
                                                <th className="px-4 py-3 text-right">Tỉ Lệ Thắng</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {analysis.sortedPartners.length > 0 ? (
                                                analysis.sortedPartners.map((p, idx) => (
                                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                                                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold border border-slate-200">
                                                                {idx + 1}
                                                            </span>
                                                            {p.name}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-slate-600 font-medium">
                                                            {p.matchesTogether}
                                                        </td>
                                                        <td className="px-4 py-3 text-center text-xs font-medium">
                                                            <span className="text-green-600">{p.winsTogether}</span>
                                                            <span className="mx-1 text-slate-300">-</span>
                                                            <span className="text-red-500">{p.matchesTogether - p.winsTogether}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className={`font-bold ${p.winRate >= 0.5 ? 'text-green-600' : 'text-orange-500'}`}>
                                                                {Math.round(p.winRate * 100)}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">
                                                        Chưa có dữ liệu đánh cặp.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* CHARTS SECTION */}
                            <div className="space-y-6 animate-fade-in">
                                {/* Weekly Win Rate */}
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-4">
                                        <TrendingUp className="w-4 h-4" /> Phong Độ Tuần (% Thắng)
                                    </h4>
                                    <div className="h-64 w-full">
                                        {analysis.winRateChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={analysis.winRateChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis 
                                                        dataKey="name" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{fontSize: 10, fill: '#64748b'}} 
                                                        dy={10} 
                                                        interval="preserveStartEnd"
                                                    />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} domain={[0, 100]} />
                                                    <Tooltip 
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                        formatter={(value: number) => [`${value}%`, 'Tỉ lệ thắng']}
                                                    />
                                                    <Line type="monotone" dataKey="winRate" stroke="#16a34a" strokeWidth={3} dot={{r: 4, fill: '#16a34a'}} activeDot={{r: 6}} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Chưa đủ dữ liệu biểu đồ</div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 text-center mt-2 italic">Dữ liệu được gom nhóm theo tuần (Thứ 2)</p>
                                </div>

                                {/* Financial History */}
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-4">
                                        <DollarSign className="w-4 h-4" /> Biến Động Tài Chính (Theo Buổi)
                                    </h4>
                                    <div className="h-64 w-full">
                                        {analysis.financeChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={analysis.financeChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                                                    <Tooltip 
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                        formatter={(value: number) => [`${value > 0 ? '+' : ''}${value}`, 'Điểm']}
                                                    />
                                                    <ReferenceLine y={0} stroke="#94a3b8" />
                                                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                                        {analysis.financeChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.amount >= 0 ? '#22c55e' : '#ef4444'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Chưa đủ dữ liệu biểu đồ</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'history' && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-3">Ngày</th>
                                            <th className="px-4 py-3 text-center">Số Trận</th>
                                            <th className="px-4 py-3 text-center">Thắng - Thua</th>
                                            <th className="px-4 py-3 text-right">Tổng Điểm Kèo</th>
                                            <th className="px-4 py-3 text-right w-28">Rating</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {dailySummary.length > 0 ? (
                                            dailySummary.map((day, idx) => (
                                                <tr key={day.date} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-slate-900 text-xs">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                                {new Date(day.date).toLocaleDateString('vi-VN', {
                                                                    weekday: 'short',
                                                                    day: '2-digit',
                                                                    month: '2-digit',
                                                                    year: 'numeric'
                                                                })}
                                                            </div>
                                                            {day.note && (
                                                                <div className="flex items-center gap-1 text-[10px] text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 w-fit">
                                                                    <Gift className="w-3 h-3" />
                                                                    {day.note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-slate-600 font-bold">
                                                        {day.matchCount}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs font-medium">
                                                        <span className="text-green-600 text-sm font-bold">{day.wins}</span>
                                                        <span className="mx-1 text-slate-300">-</span>
                                                        <span className="text-red-500 text-sm font-bold">{day.losses}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                                            day.netPoints > 0 ? 'bg-green-100 text-green-700 border-green-200' : 
                                                            day.netPoints < 0 ? 'bg-red-50 text-red-600 border-red-100' : 
                                                            'bg-slate-100 text-slate-500 border-slate-200'
                                                        }`}>
                                                            {day.netPoints > 0 ? '+' : ''}{day.netPoints}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className={`flex items-center justify-end gap-1 font-mono text-xs font-bold ${day.ratingChange >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                                                            <Activity className="w-3 h-3 opacity-50" />
                                                            {day.ratingChange > 0 ? '+' : ''}{day.ratingChange.toFixed(2)}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                                                    Chưa có lịch sử đấu.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    </div>
  );
};