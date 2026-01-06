import React, { useState, useMemo } from 'react';
import { Player, Match } from '../types';
import { runAutoMatchmaker, AutoMatchResult, GeneratedMatch } from '../services/autoMatchmaker';
import { Card } from './Card';
import { Zap, Users, Check, X, Shield, RefreshCw, Trophy, ArrowRight } from 'lucide-react';

interface AutoMatchMakerModalProps {
  players: Player[];
  matches: Match[];
  onApplyMatches: (matches: GeneratedMatch[]) => void;
  onClose: () => void;
}

export const AutoMatchMakerModal: React.FC<AutoMatchMakerModalProps> = ({ players, matches, onApplyMatches, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<AutoMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter Active Players
  const activePlayers = useMemo(() => players.filter(p => p.isActive !== false), [players]);

  // Sort players by name
  const sortedPlayers = useMemo(() => [...activePlayers].sort((a, b) => a.name.localeCompare(b.name)), [activePlayers]);

  const togglePlayer = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleRun = () => {
    try {
        setError(null);
        if (selectedIds.length < 4) throw new Error("Cần ít nhất 4 người chơi.");
        if (selectedIds.length % 2 !== 0) throw new Error("Số lượng người chơi phải là chẵn.");

        // Use active players for selection, but all players for data context (if needed by underlying logic, though logic handles pool)
        // Here we pass 'players' (all) but selectedIds are only from active.
        const res = runAutoMatchmaker(selectedIds, players, matches);
        setResult(res);
    } catch (e: any) {
        setError(e.message);
    }
  };

  const handleApply = () => {
      if (result) {
          onApplyMatches(result.matches);
          onClose();
      }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/95 backdrop-blur-sm overflow-y-auto animate-fade-in">
        <div className="min-h-full p-4 flex items-center justify-center">
            <div className="w-full max-w-5xl bg-slate-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500 rounded-lg text-slate-900 shadow-lg shadow-yellow-500/50">
                            <Zap className="w-6 h-6" fill="currentColor" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight">Ghép Đội AI</h2>
                            <p className="text-xs text-slate-400">Thuật toán ELO + Synergy tối ưu hóa cân bằng</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row h-full overflow-hidden">
                    
                    {/* LEFT: Player Selection */}
                    <div className="w-full md:w-1/3 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Users className="w-4 h-4" /> Chọn Người Chơi ({selectedIds.length})
                            </h3>
                            {selectedIds.length > 0 && (
                                <button onClick={() => setSelectedIds([])} className="text-xs text-red-500 hover:underline">Xóa hết</button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {sortedPlayers.map(p => {
                                const isSelected = selectedIds.includes(p.id);
                                return (
                                    <div 
                                        key={p.id} 
                                        onClick={() => togglePlayer(p.id)}
                                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                                            isSelected 
                                            ? 'bg-pickle-50 border-pickle-500 shadow-sm' 
                                            : 'bg-white border-transparent hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-pickle-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                {p.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className={`text-sm font-bold ${isSelected ? 'text-pickle-700' : 'text-slate-700'}`}>{p.name}</div>
                                                <div className="text-[10px] text-slate-400">Rating: {(p.tournamentRating || p.initialPoints || 0).toFixed(1)}</div>
                                            </div>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-pickle-600" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50">
                            {error && <p className="text-xs text-red-500 mb-2 font-bold text-center">{error}</p>}
                            <button 
                                onClick={handleRun}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                            >
                                <Zap className="w-4 h-4" /> TẠO ĐỘI HÌNH
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: Results */}
                    <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden relative">
                        {result ? (
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                                
                                {/* Info Banner */}
                                <div className="flex gap-4 overflow-x-auto pb-2">
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm min-w-[140px]">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">Người chơi</div>
                                        <div className="text-2xl font-black text-slate-800">{result.players.length}</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm min-w-[140px]">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">Số đội</div>
                                        <div className="text-2xl font-black text-blue-600">{result.pairs.length}</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm min-w-[140px]">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">Số trận đấu</div>
                                        <div className="text-2xl font-black text-green-600">{result.matches.length}</div>
                                    </div>
                                </div>

                                {/* Matches List */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2 uppercase text-sm tracking-wider">
                                        <Trophy className="w-4 h-4" /> Các cặp đấu đề xuất
                                    </h3>
                                    
                                    {result.matches.map((m, idx) => (
                                        <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                            <div className="flex flex-col md:flex-row">
                                                {/* Team 1 */}
                                                <div className="flex-1 p-4 bg-blue-50/30 flex items-center justify-between md:justify-start gap-4">
                                                    <div className="flex -space-x-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm z-10">
                                                            {m.team1.player1.id.slice(0,1)}
                                                        </div>
                                                        <div className="w-10 h-10 rounded-full bg-blue-400 text-white flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm">
                                                            {m.team1.player2.id.slice(0,1)}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-sm">
                                                            {sortedPlayers.find(p => p.id === m.team1.player1.id)?.name} & {sortedPlayers.find(p => p.id === m.team1.player2.id)?.name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                            Rating: {m.team1.strength.toFixed(1)} (Diff: {m.team1.structure.toFixed(1)})
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* VS Badge */}
                                                <div className="flex items-center justify-center p-2 bg-slate-50 border-y md:border-y-0 md:border-x border-slate-100">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-black text-[10px] text-slate-500 shadow-inner">
                                                        VS
                                                    </div>
                                                </div>

                                                {/* Team 2 */}
                                                <div className="flex-1 p-4 bg-red-50/30 flex items-center justify-between md:justify-end md:flex-row-reverse gap-4">
                                                    <div className="flex -space-x-3 md:flex-row-reverse md:space-x-reverse">
                                                        <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm z-10">
                                                            {m.team2.player1.id.slice(0,1)}
                                                        </div>
                                                        <div className="w-10 h-10 rounded-full bg-red-400 text-white flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm">
                                                            {m.team2.player2.id.slice(0,1)}
                                                        </div>
                                                    </div>
                                                    <div className="text-left md:text-right">
                                                        <div className="font-bold text-slate-800 text-sm">
                                                            {sortedPlayers.find(p => p.id === m.team2.player1.id)?.name} & {sortedPlayers.find(p => p.id === m.team2.player2.id)?.name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                            Rating: {m.team2.strength.toFixed(1)} (Diff: {m.team2.structure.toFixed(1)})
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Handicap Info */}
                                            {m.handicap && (
                                                <div className="bg-yellow-50 px-4 py-2 border-t border-yellow-100 flex items-center gap-2">
                                                    <Shield className="w-4 h-4 text-yellow-600" />
                                                    <span className="text-xs font-bold text-yellow-800">
                                                        Kèo chấp: Đội {m.handicap.team === 1 ? '2' : '1'} chấp Đội {m.handicap.team} {m.handicap.points} quả.
                                                    </span>
                                                    <span className="text-[10px] text-yellow-600 italic">
                                                        ({m.handicap.reason})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="h-20"></div> {/* Spacer */}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                                <Zap className="w-16 h-16 mb-4 opacity-20" />
                                <h3 className="text-lg font-bold text-slate-500">Sẵn sàng phân tích</h3>
                                <p className="text-sm max-w-xs mt-2">Chọn ít nhất 4 người chơi từ danh sách bên trái và nhấn nút Tạo Đội Hình.</p>
                            </div>
                        )}

                        {/* Bottom Actions */}
                        {result && (
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 flex gap-3 z-10">
                                <button 
                                    onClick={handleRun}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" /> Thử lại
                                </button>
                                <button 
                                    onClick={handleApply}
                                    className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                                >
                                    Sử Dụng Kết Quả Này <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};