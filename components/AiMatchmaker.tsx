import React, { useState, useMemo } from 'react';
import { Player, Match } from '../types';
import { Card } from './Card';
import { findTopMatchupsForTeam, findBestPartners, GeneratedMatch } from '../services/autoMatchmaker';
import { Zap, Shield, Target, CheckCircle2, AlertCircle, Sparkles, Users, Swords, UserPlus, Filter, X, CheckSquare, Square, Settings2 } from 'lucide-react';

interface AiMatchmakerProps {
  players: Player[];
  matches: Match[];
}

export const AiMatchmaker: React.FC<AiMatchmakerProps> = ({ players, matches }) => {
  // --- MODE STATE ---
  const [mode, setMode] = useState<'find_opponent' | 'find_partner'>('find_opponent');

  // --- FIND OPPONENT STATE (EXISTING) ---
  const [p1Id, setP1Id] = useState<string>('');
  const [p2Id, setP2Id] = useState<string>('');
  
  // --- FIND PARTNER STATE (NEW) ---
  const [myId, setMyId] = useState<string>('');
  const [targetOpponentIds, setTargetOpponentIds] = useState<string[]>(['', '']); // Max 2 slots

  // --- POOL SELECTION STATE ---
  const [excludedPlayerIds, setExcludedPlayerIds] = useState<string[]>([]);
  const [showPoolModal, setShowPoolModal] = useState(false);

  // --- RESULTS STATE ---
  const [results, setResults] = useState<GeneratedMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Filter Active Players
  const activePlayers = useMemo(() => players.filter(p => p.isActive !== false), [players]);

  // Sorting for display
  const sortedPlayers = useMemo(() => [...activePlayers].sort((a, b) => a.name.localeCompare(b.name)), [activePlayers]);

  // Pool Logic
  const togglePoolPlayer = (id: string) => {
      setExcludedPlayerIds(prev => 
          prev.includes(id) 
          ? prev.filter(x => x !== id) 
          : [...prev, id]
      );
  };

  const toggleAllPool = (select: boolean) => {
      if (select) {
          setExcludedPlayerIds([]);
      } else {
          setExcludedPlayerIds(activePlayers.map(p => String(p.id)));
      }
  };

  const currentPoolSize = activePlayers.length - excludedPlayerIds.length;

  const handleRunFindOpponent = () => {
      setError(null);
      setResults([]);
      
      if (!p1Id || !p2Id) {
          setError("Vui lòng chọn đủ 2 người chơi cho Đội Chủ Nhà.");
          return;
      }
      if (p1Id === p2Id) {
          setError("Người chơi trong đội không được trùng nhau.");
          return;
      }

      setIsSearching(true);

      setTimeout(() => {
        try {
            const poolIds = activePlayers
                .filter(p => {
                    const pid = String(p.id);
                    return pid !== p1Id && pid !== p2Id && !excludedPlayerIds.includes(pid);
                })
                .map(p => String(p.id));

            if (poolIds.length < 2) {
                setError(`Không đủ người chơi trong pool để ghép đối thủ (Cần ít nhất 2 người). Hiện có: ${poolIds.length}`);
                setIsSearching(false);
                return;
            }

            const topMatches = findTopMatchupsForTeam([p1Id, p2Id], poolIds, players, matches);
            setResults(topMatches);
            
            if (topMatches.length === 0) {
                setError("Không tìm thấy cặp đấu phù hợp nào từ danh sách người chơi hiện có.");
            }
        } catch (e: any) {
            setError("Lỗi thuật toán: " + e.message);
        } finally {
            setIsSearching(false);
        }
      }, 600);
  };

  const handleRunFindPartner = () => {
      setError(null);
      setResults([]);

      if (!myId) {
          setError("Vui lòng chọn tên của bạn.");
          return;
      }

      const validOpponents = targetOpponentIds.filter(id => id !== '');
      if (validOpponents.length === 0) {
          setError("Vui lòng chọn ít nhất 1 đối thủ dự kiến.");
          return;
      }

      // Unique Check
      const allSelected = [myId, ...validOpponents];
      if (new Set(allSelected).size !== allSelected.length) {
          setError("Người chơi không được trùng lặp.");
          return;
      }

      setIsSearching(true);

      setTimeout(() => {
          try {
              const poolIds = activePlayers
                  .filter(p => {
                      const pid = String(p.id);
                      return pid !== myId && !validOpponents.includes(pid) && !excludedPlayerIds.includes(pid);
                  })
                  .map(p => String(p.id));
              
              // Need at least 1 person in pool if 1vs2 (to fill my partner)
              // Need at least 2 people in pool if 1vs1 (to fill my partner AND opponent partner)
              const requiredPoolSize = validOpponents.length === 1 ? 2 : 1;

              if (poolIds.length < requiredPoolSize) {
                  setError(`Không đủ người chơi trong pool để ghép (Cần thêm ít nhất ${requiredPoolSize} người). Hiện có: ${poolIds.length}`);
                  setIsSearching(false);
                  return;
              }

              const bestMatches = findBestPartners(myId, validOpponents, poolIds, players, matches);
              setResults(bestMatches);

              if (bestMatches.length === 0) {
                  setError("Không tìm thấy phương án ghép cặp phù hợp.");
              }

          } catch (e: any) {
              setError("Lỗi thuật toán: " + e.message);
          } finally {
              setIsSearching(false);
          }
      }, 600);
  };

  const getPlayerName = (id: string) => players.find(p => String(p.id) === id)?.name || 'Unknown';

  // --- NEW LOGIC: PAIR HISTORY ANALYSIS (Only for Find Opponent mode) ---
  const pairHistory = useMemo(() => {
      if (mode !== 'find_opponent' || !p1Id || !p2Id || p1Id === p2Id) return [];

      const historyMap = new Map<string, {
          opponents: string[],
          wins: number,
          losses: number,
          total: number,
          lastDate: string
      }>();

      matches.forEach(m => {
          const t1 = m.team1.map(String);
          const t2 = m.team2.map(String);

          const isHomeInT1 = t1.includes(p1Id) && t1.includes(p2Id);
          const isHomeInT2 = t2.includes(p1Id) && t2.includes(p2Id);

          if (!isHomeInT1 && !isHomeInT2) return;

          const opponentIds = isHomeInT1 ? t2 : t1;
          if (opponentIds.length !== 2) return; 

          const oppKey = opponentIds.slice().sort().join('-'); 

          if (!historyMap.has(oppKey)) {
              historyMap.set(oppKey, {
                  opponents: opponentIds,
                  wins: 0,
                  losses: 0,
                  total: 0,
                  lastDate: m.date
              });
          }

          const stats = historyMap.get(oppKey)!;
          stats.total++;
          if (new Date(m.date) > new Date(stats.lastDate)) stats.lastDate = m.date;

          let s1 = Number(m.score1);
          let s2 = Number(m.score2);
          if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
          if (s1 === s2) return; 

          let winner = s1 > s2 ? 1 : 2;
          if (s1 === 0 && s2 === 0 && m.winner) winner = Number(m.winner) === 1 ? 1 : 2;

          const homeWon = (isHomeInT1 && winner === 1) || (isHomeInT2 && winner === 2);
          if (homeWon) stats.wins++;
          else stats.losses++;
      });

      return Array.from(historyMap.values()).sort((a, b) => {
          const wrA = a.total > 0 ? a.wins / a.total : 0;
          const wrB = b.total > 0 ? b.wins / b.total : 0;
          if (wrB !== wrA) return wrB - wrA;
          return b.total - a.total;
      });
  }, [mode, p1Id, p2Id, matches]);

  const updateTargetOpponent = (index: number, val: string) => {
      const newIds = [...targetOpponentIds];
      newIds[index] = val;
      setTargetOpponentIds(newIds);
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm shadow-inner">
                    <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" fill="currentColor" />
                </div>
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">So Kèo AI</h2>
                    <p className="text-violet-100 text-sm">Hệ thống tính điểm <b>Thực Tế = Rating Gốc + Phong Độ</b> để tìm kèo cân.</p>
                </div>
            </div>
        </div>

        {/* TABS */}
        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
            <button
                onClick={() => { setMode('find_opponent'); setResults([]); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${
                    mode === 'find_opponent' 
                    ? 'bg-violet-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Swords className="w-4 h-4" /> Tìm Đối Thủ
            </button>
            <button
                onClick={() => { setMode('find_partner'); setResults([]); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all ${
                    mode === 'find_partner' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <UserPlus className="w-4 h-4" /> Tìm Cạ Cứng
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT: Configuration */}
            <div className="lg:col-span-4 space-y-6">
                
                {mode === 'find_opponent' ? (
                    <Card title="Thiết Lập Đội Chủ Nhà" classNameTitle="bg-violet-50 text-violet-800 font-bold uppercase text-xs tracking-wider">
                        <div className="flex flex-col gap-6">
                            {/* Avatar / Placeholder Visual */}
                            <div className="flex justify-center -space-x-4 py-2">
                                <div className={`w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center font-bold text-xl ${p1Id ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                    {p1Id ? getPlayerName(p1Id).charAt(0) : '?'}
                                </div>
                                <div className={`w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center font-bold text-xl ${p2Id ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                    {p2Id ? getPlayerName(p2Id).charAt(0) : '?'}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Thành viên 1</label>
                                    <select 
                                        value={p1Id}
                                        onChange={(e) => setP1Id(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all"
                                    >
                                        <option value="">-- Chọn người chơi --</option>
                                        {sortedPlayers.filter(p => String(p.id) !== p2Id).map(p => (
                                            <option key={p.id} value={String(p.id)}>{p.name} (Rate: {(p.tournamentRating || p.initialPoints || 0).toFixed(1)})</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t border-slate-200"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-white px-2 text-slate-300 text-xs font-bold">&</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Thành viên 2</label>
                                    <select 
                                        value={p2Id}
                                        onChange={(e) => setP2Id(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition-all"
                                    >
                                        <option value="">-- Chọn người chơi --</option>
                                        {sortedPlayers.filter(p => String(p.id) !== p1Id).map(p => (
                                            <option key={p.id} value={String(p.id)}>{p.name} (Rate: {(p.tournamentRating || p.initialPoints || 0).toFixed(1)})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-xs font-bold animate-pulse">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> 
                                    <span>{error}</span>
                                </div>
                            )}

                            <button 
                                onClick={handleRunFindOpponent}
                                disabled={isSearching}
                                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl shadow-lg shadow-slate-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                {isSearching ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <Target className="w-5 h-5 group-hover:text-yellow-400 transition-colors" /> TÌM ĐỐI THỦ NGAY
                                    </>
                                )}
                            </button>
                        </div>
                    </Card>
                ) : (
                    <Card title="Tìm Người Đánh Cặp" classNameTitle="bg-indigo-50 text-indigo-800 font-bold uppercase text-xs tracking-wider">
                        <div className="flex flex-col gap-6">
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bạn là ai?</label>
                                    <select 
                                        value={myId}
                                        onChange={(e) => setMyId(e.target.value)}
                                        className="w-full p-3 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                                    >
                                        <option value="">-- Chọn tên bạn --</option>
                                        {sortedPlayers.map(p => (
                                            <option key={p.id} value={String(p.id)}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="relative my-4">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t border-slate-200"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-white px-2 text-slate-400 text-xs font-bold uppercase">Muốn đấu với</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Đối thủ 1 (Bắt buộc)</label>
                                    <select 
                                        value={targetOpponentIds[0]}
                                        onChange={(e) => updateTargetOpponent(0, e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                    >
                                        <option value="">-- Chọn đối thủ --</option>
                                        {sortedPlayers.filter(p => String(p.id) !== myId && String(p.id) !== targetOpponentIds[1]).map(p => (
                                            <option key={p.id} value={String(p.id)}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Đối thủ 2 (Tuỳ chọn)</label>
                                    <select 
                                        value={targetOpponentIds[1]}
                                        onChange={(e) => updateTargetOpponent(1, e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                    >
                                        <option value="">-- Để trống nếu muốn tìm 2 người --</option>
                                        {sortedPlayers.filter(p => String(p.id) !== myId && String(p.id) !== targetOpponentIds[0]).map(p => (
                                            <option key={p.id} value={String(p.id)}>{p.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1 italic">
                                        * Nếu chọn 1 đối thủ, AI sẽ tìm người cặp với bạn VÀ người cặp với đối thủ. <br/>
                                        * Nếu chọn 2 đối thủ, AI sẽ chỉ tìm người cặp với bạn.
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-xs font-bold animate-pulse">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> 
                                    <span>{error}</span>
                                </div>
                            )}

                            <button 
                                onClick={handleRunFindPartner}
                                disabled={isSearching}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base disabled:opacity-70 disabled:cursor-not-allowed group"
                            >
                                {isSearching ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <Users className="w-5 h-5" /> TÌM CẠ CỨNG
                                    </>
                                )}
                            </button>
                        </div>
                    </Card>
                )}

                {/* PAIR HISTORY (Only show in Find Opponent Mode) */}
                {mode === 'find_opponent' && pairHistory.length > 0 && (
                    <Card title="Lịch Sử Cặp Này" classNameTitle="bg-slate-100 text-slate-700 font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                        <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200">
                                    <tr>
                                        <th className="py-2 pl-2">Đối Thủ</th>
                                        <th className="py-2 text-center">W-L</th>
                                        <th className="py-2 pr-2 text-right">% Thắng</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pairHistory.map((item, idx) => {
                                        const winRate = Math.round((item.wins / item.total) * 100);
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="py-2 pl-2">
                                                    <div className="font-bold text-slate-800 leading-tight">
                                                        {getPlayerName(item.opponents[0])}
                                                    </div>
                                                    <div className="font-bold text-slate-800 leading-tight">
                                                        {getPlayerName(item.opponents[1])}
                                                    </div>
                                                </td>
                                                <td className="py-2 text-center whitespace-nowrap">
                                                    <span className="text-green-600 font-bold">{item.wins}</span>
                                                    <span className="text-slate-300 mx-1">-</span>
                                                    <span className="text-red-500 font-bold">{item.losses}</span>
                                                </td>
                                                <td className="py-2 pr-2 text-right">
                                                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${winRate >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                                        {winRate}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {/* POOL CONFIGURATION CARD */}
                <Card title="Cấu Hình Pool Người Chơi" classNameTitle="bg-slate-800 text-white font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-full border border-slate-200 shadow-sm">
                                    <Users className="w-5 h-5 text-slate-600" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-500 uppercase">Pool Hiện Tại</div>
                                    <div className="text-lg font-black text-slate-800">
                                        {currentPoolSize} <span className="text-sm font-medium text-slate-400">/ {activePlayers.length}</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowPoolModal(true)}
                                className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                                title="Chỉnh sửa Pool"
                            >
                                <Settings2 className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="text-[10px] text-slate-400 italic text-center">
                            * Chỉ những người chơi trong Pool mới được AI sử dụng để ghép cặp.
                        </div>
                    </div>
                </Card>
            </div>

            {/* RIGHT: Results */}
            <div className="lg:col-span-8">
                <Card className="h-full min-h-[500px]" title="Kết Quả Phân Tích (Top 10)" classNameTitle={`${mode === 'find_opponent' ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'} font-bold uppercase text-xs tracking-wider`}>
                    {results.length > 0 ? (
                        <div className="space-y-4 animate-fade-in">
                            {/* HOME TEAM SUMMARY (Only for Find Opponent) */}
                            {mode === 'find_opponent' && results.length > 0 && results[0].team1 && (
                                <div className="bg-violet-50 p-3 rounded-lg border border-violet-100 flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center font-bold text-xs">Home</div>
                                        <div>
                                            <div className="text-xs font-bold text-violet-900">Đội Chủ Nhà (Bạn)</div>
                                            <div className="text-[10px] text-violet-600">
                                                Gốc: {(results[0].team1.player1.baseRating + results[0].team1.player2.baseRating).toFixed(1)} 
                                                <span className="mx-1 text-slate-300">|</span>
                                                Form: <span className={(results[0].team1.player1.form + results[0].team1.player2.form) >= 0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                                                    {(results[0].team1.player1.form + results[0].team1.player2.form) > 0 ? '+' : ''}
                                                    {(results[0].team1.player1.form + results[0].team1.player2.form).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black text-violet-700">{results[0].team1.strength.toFixed(2)}</div>
                                        <div className="text-[9px] uppercase font-bold text-violet-400">Sức mạnh thực</div>
                                    </div>
                                </div>
                            )}

                            {results.map((match, idx) => {
                                // For "Find Partner", Team1 is [Me, Partner]. Team2 is [Opp1, Opp2].
                                // We want to highlight Team1 Partner and potentially Team2 Partner if we generated it.
                                
                                const team1Base = match.team1.player1.baseRating + match.team1.player2.baseRating;
                                const team2Base = match.team2.player1.baseRating + match.team2.player2.baseRating;
                                const baseDiff = Math.abs(team1Base - team2Base).toFixed(1);
                                const aiDiff = Math.abs(match.team1.strength - match.team2.strength).toFixed(2);

                                return (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-green-300 transition-all overflow-hidden relative group">
                                        {/* Rank Badge */}
                                        <div className={`absolute top-0 left-0 text-white text-[10px] font-bold px-3 py-1 rounded-br-lg z-10 shadow-sm ${idx < 3 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-slate-700'}`}>
                                            #{idx + 1} {idx === 0 && '👑'}
                                        </div>

                                        {mode === 'find_partner' && (
                                            <div className="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg z-10">
                                                Cặp Đôi Đề Xuất
                                            </div>
                                        )}

                                        <div className="flex flex-col md:flex-row">
                                            {/* Info Section */}
                                            <div className="flex-1 p-4 pl-6 flex flex-col justify-center">
                                                
                                                <div className="flex items-center gap-4">
                                                    {/* TEAM 1 (Me + Partner) */}
                                                    <div className="flex-1 text-right">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                            {mode === 'find_partner' ? 'Bạn & Đồng Đội' : 'Đội Chủ Nhà'}
                                                        </div>
                                                        <div className="font-bold text-slate-900 text-sm leading-tight">
                                                            {getPlayerName(match.team1.player1.id)} 
                                                            <br/>
                                                            <span className="text-indigo-600 font-black">+ {getPlayerName(match.team1.player2.id)}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                                                            Rating: {match.team1.strength.toFixed(2)}
                                                        </div>
                                                    </div>

                                                    {/* VS */}
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-400 text-xs">VS</div>
                                                    </div>

                                                    {/* TEAM 2 (Opponents) */}
                                                    <div className="flex-1 text-left">
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                                                            Đối Thủ
                                                        </div>
                                                        <div className="font-bold text-slate-900 text-sm leading-tight">
                                                            {getPlayerName(match.team2.player1.id)} 
                                                            <br/>
                                                            {mode === 'find_partner' && targetOpponentIds.filter(x=>x).length === 1 ? (
                                                                <span className="text-red-600 font-black">+ {getPlayerName(match.team2.player2.id)}</span>
                                                            ) : (
                                                                <span>& {getPlayerName(match.team2.player2.id)}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                                                            Rating: {match.team2.strength.toFixed(2)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Analysis / Handicap Badge */}
                                            <div className="md:w-1/3 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 p-4 flex flex-col justify-center items-center text-center relative overflow-hidden">
                                                {/* Match Difference Indicator */}
                                                <div className="absolute top-2 right-2 text-[9px] font-mono text-slate-400 flex flex-col items-end opacity-70">
                                                    <span title="Chênh lệch thực tế (Gốc + Form)">AI Diff: {aiDiff}</span>
                                                    <span title="Chênh lệch rating gốc">Base Diff: {baseDiff}</span>
                                                </div>

                                                {/* Decorative background for handicap */}
                                                {match.handicap && (
                                                    <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-100 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
                                                )}

                                                {match.handicap ? (
                                                    <div className="relative w-full mt-2">
                                                        <div className="text-yellow-700 font-bold text-xs flex items-center justify-center gap-1 mb-1 uppercase tracking-tight">
                                                            <Shield className="w-3 h-3" /> Kèo Chấp
                                                        </div>
                                                        <div className="bg-white border-2 border-yellow-200 rounded-lg p-2 shadow-sm">
                                                            <div className="text-xs text-slate-600 font-bold">
                                                                {match.handicap.team === 1 ? 'Khách chấp Chủ' : 'Chủ chấp Khách'}
                                                            </div>
                                                            <div className="text-2xl font-black text-yellow-600 leading-none my-1">
                                                                {match.handicap.points} quả
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 italic mb-1">
                                                                {match.handicap.reason}
                                                            </div>
                                                            {match.handicap.details && match.handicap.details.length > 0 && (
                                                                <div className="border-t border-yellow-100 pt-1 mt-1 text-[9px] text-left text-slate-500 font-mono">
                                                                    <ul className="list-none space-y-0.5">
                                                                        {match.handicap.details.map((d, i) => (
                                                                            <li key={i} title={d}>{d}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-green-600 flex flex-col items-center gap-2 mt-2">
                                                        <div className="p-2 bg-green-100 rounded-full">
                                                            <CheckCircle2 className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-sm block">Kèo Đồng Banh</span>
                                                            <span className="text-[10px] text-green-600/70">Lệch thực tế {aiDiff} (An toàn)</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 min-h-[400px]">
                            {isSearching ? (
                                <div className="flex flex-col items-center animate-pulse">
                                    <Zap className="w-16 h-16 mb-4 text-violet-300" />
                                    <p className="font-bold text-violet-400">Đang quét dữ liệu...</p>
                                </div>
                            ) : (
                                <>
                                    <Target className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="font-medium text-slate-400">Chưa có kết quả</p>
                                    <p className="text-sm mt-1 max-w-xs text-center">
                                        {mode === 'find_opponent' 
                                            ? "Chọn cặp đôi chủ nhà ở cột bên trái và nhấn nút để tìm đối thủ." 
                                            : "Chọn tên bạn và đối thủ dự kiến để tìm người đánh cặp."
                                        }
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>

        {/* POOL SELECTION MODAL */}
        {showPoolModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-slate-500" />
                            <h3 className="font-bold text-slate-800">Chọn Pool Người Chơi</h3>
                        </div>
                        <button onClick={() => setShowPoolModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center justify-between p-3 border-b border-slate-100 gap-2 bg-white">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => toggleAllPool(true)}
                                className="px-3 py-1.5 bg-violet-50 text-violet-700 text-xs font-bold rounded-lg hover:bg-violet-100 transition-colors border border-violet-100"
                            >
                                Chọn Tất Cả
                            </button>
                            <button 
                                onClick={() => toggleAllPool(false)}
                                className="px-3 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors border border-slate-100"
                            >
                                Bỏ Chọn Tất Cả
                            </button>
                        </div>
                        <div className="text-xs font-bold text-slate-400">
                            Đã chọn: {currentPoolSize}
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 custom-scrollbar bg-slate-50/50">
                        {sortedPlayers.map(p => {
                            const pid = String(p.id);
                            const isExcluded = excludedPlayerIds.includes(pid);
                            const isSelected = !isExcluded;
                            return (
                                <div 
                                    key={p.id} 
                                    onClick={() => togglePoolPlayer(pid)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none group ${
                                        isSelected 
                                        ? 'bg-white border-violet-200 shadow-sm ring-1 ring-violet-100' 
                                        : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-400 group-hover:bg-slate-300'}`}>
                                        {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold text-sm truncate ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>{p.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">Rate: {(p.tournamentRating || p.initialPoints || 0).toFixed(1)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                        <button 
                            onClick={() => setShowPoolModal(false)}
                            className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 active:scale-95"
                        >
                            Xong
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};