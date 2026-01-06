import React, { useState, useMemo } from 'react';
import { Player, Match } from '../types';
import { Card } from './Card';
import { findTopMatchupsForTeam, GeneratedMatch } from '../services/autoMatchmaker';
import { Zap, Shield, Target, CheckCircle2, AlertCircle, Sparkles, TrendingUp, Users, Scale, Info, BrainCircuit } from 'lucide-react';

interface AiMatchmakerProps {
  players: Player[];
  matches: Match[];
}

export const AiMatchmaker: React.FC<AiMatchmakerProps> = ({ players, matches }) => {
  // Team Home Selection
  const [p1Id, setP1Id] = useState<string>('');
  const [p2Id, setP2Id] = useState<string>('');
  
  const [results, setResults] = useState<GeneratedMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Filter Active Players
  const activePlayers = useMemo(() => players.filter(p => p.isActive !== false), [players]);

  // Sorting for display
  const sortedPlayers = useMemo(() => [...activePlayers].sort((a, b) => a.name.localeCompare(b.name)), [activePlayers]);

  const handleRun = () => {
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

      // Simulate a small delay for better UX feeling of "AI Processing"
      setTimeout(() => {
        try {
            // Updated Logic: Remove month filtering. Use ALL players who are active.
            // Pool is all active players excluding home team.
            const poolIds = activePlayers
                .filter(p => {
                    const pid = String(p.id);
                    return pid !== p1Id && pid !== p2Id;
                })
                .map(p => String(p.id));

            if (poolIds.length < 2) {
                setError("Không đủ người chơi active để ghép đối thủ (Cần ít nhất 2 người).");
                setIsSearching(false);
                return;
            }

            // Use allMatches for learning history
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

  const getPlayerName = (id: string) => players.find(p => String(p.id) === id)?.name || 'Unknown';

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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT: Configuration */}
            <div className="lg:col-span-4 space-y-6">
                
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
                            onClick={handleRun}
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
                        
                        <p className="text-[10px] text-center text-slate-400 italic">
                             Sử dụng toàn bộ dữ liệu lịch sử để phân tích phong độ và tìm đối thủ cân sức nhất.
                        </p>
                    </div>
                </Card>
            </div>

            {/* RIGHT: Results */}
            <div className="lg:col-span-8">
                <Card className="h-full min-h-[500px]" title="Kết Quả Phân Tích (Top 10)" classNameTitle="bg-green-50 text-green-800 font-bold uppercase text-xs tracking-wider">
                    {results.length > 0 ? (
                        <div className="space-y-4 animate-fade-in">
                            {/* HOME TEAM SUMMARY (If searching) */}
                            {results.length > 0 && results[0].team1 && (
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
                                const opponentPair = match.team2;
                                // AI Match Difference
                                const aiDiff = Math.abs(match.team1.strength - match.team2.strength).toFixed(2);
                                
                                // Base Rating Stats
                                const team1Base = match.team1.player1.baseRating + match.team1.player2.baseRating;
                                const team2Base = match.team2.player1.baseRating + match.team2.player2.baseRating;
                                const baseDiff = Math.abs(team1Base - team2Base).toFixed(1);

                                // Form Stats
                                const team2Form = match.team2.player1.form + match.team2.player2.form;
                                
                                return (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-green-300 transition-all overflow-hidden relative group">
                                        {/* Rank Badge */}
                                        <div className={`absolute top-0 left-0 text-white text-[10px] font-bold px-3 py-1 rounded-br-lg z-10 shadow-sm ${idx < 3 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-slate-700'}`}>
                                            #{idx + 1} {idx === 0 && '👑'}
                                        </div>

                                        <div className="flex flex-col md:flex-row">
                                            {/* Opponent Info */}
                                            <div className="flex-1 p-4 pl-6 flex flex-col justify-center">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-6 md:ml-0">Đối Thủ Đề Xuất</span>
                                                    <div className="flex items-center gap-2">
                                                        {match.analysis.team2Form > 0.1 ? (
                                                            <div className="flex items-center gap-1 bg-red-100 px-2 py-0.5 rounded border border-red-200" title="Phong độ cao">
                                                                <TrendingUp className="w-3 h-3 text-red-600" />
                                                                <span className="text-red-700 text-[10px] font-bold">Hot Form</span>
                                                            </div>
                                                        ) : match.analysis.team2Form < -0.1 ? (
                                                            <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="Phong độ thấp">
                                                                <TrendingUp className="w-3 h-3 text-slate-500 rotate-180" />
                                                                <span className="text-slate-600 text-[10px] font-bold">Cold Form</span>
                                                            </div>
                                                        ) : null}
                                                        
                                                        {match.analysis.team2Synergy > 0.05 && (
                                                            <div className="flex items-center gap-1 bg-purple-100 px-2 py-0.5 rounded border border-purple-200" title="Cặp đôi ăn ý">
                                                                <Users className="w-3 h-3 text-purple-600" />
                                                                <span className="text-purple-700 text-[10px] font-bold">Hợp Cạ</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-4">
                                                    <div className="flex -space-x-3 shrink-0">
                                                        <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center font-bold text-slate-600 text-lg shadow-sm">
                                                            {opponentPair.player1.id.slice(0,1)}
                                                        </div>
                                                        <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center font-bold text-slate-600 text-lg shadow-sm">
                                                            {opponentPair.player2.id.slice(0,1)}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-900 text-lg leading-tight">
                                                            {getPlayerName(opponentPair.player1.id)} <span className="text-slate-300 font-normal">&</span> {getPlayerName(opponentPair.player2.id)}
                                                        </div>
                                                        
                                                        {/* DETAILED STATS ROW */}
                                                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                                            <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100" title="Tổng Rating Cứng (Trên giấy tờ)">
                                                                <span className="font-bold">Gốc:</span> {team2Base.toFixed(1)}
                                                            </div>
                                                            <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${team2Form >= 0 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`} title="Điểm cộng/trừ phong độ gần đây">
                                                                <span className="font-bold">Form:</span> {team2Form > 0 ? '+' : ''}{team2Form.toFixed(2)}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100" title="Sức mạnh thực tế (Gốc + Form) dùng để tính kèo">
                                                                <BrainCircuit className="w-3 h-3" />
                                                                <span className="font-bold">Thực:</span> {opponentPair.strength.toFixed(2)}
                                                            </div>
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
                                                                {match.handicap.team === 1 ? 'Khách chấp Chủ Nhà' : 'Chủ Nhà chấp Khách'}
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
                                    <p className="text-sm mt-1 max-w-xs text-center">Chọn cặp đôi chủ nhà ở cột bên trái và nhấn nút để tìm đối thủ.</p>
                                </>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    </div>
  );
};