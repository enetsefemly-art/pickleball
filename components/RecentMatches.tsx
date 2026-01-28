import React, { useState, useMemo } from 'react';
import { Match, Player } from '../types';
import { Card } from './Card';
import { Trash2, Calendar, Filter, X, Banknote, Trophy, User, Info, AlertCircle, ArrowRight, Layers, Scale } from 'lucide-react';
import { getMatchRatingDetails, RatingCalculationLog } from '../services/storageService';
import { analyzeHistoryHandicaps } from '../services/autoMatchmaker';

interface RecentMatchesProps {
  matches: Match[];
  players: Player[];
  onDeleteMatch?: (id: string) => void;
}

export const RecentMatches: React.FC<RecentMatchesProps> = ({ matches, players, onDeleteMatch }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<'all' | 'betting' | 'tournament'>('all');
  const [handicapFilter, setHandicapFilter] = useState<'all' | 'balanced' | 'imbalanced'>('all');
  
  const [viewingLog, setViewingLog] = useState<RatingCalculationLog | null>(null);

  const playerMap = useMemo(() => {
    return new Map<string, Player>(players.map(p => [String(p.id), p]));
  }, [players]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const getNames = (ids: string[]) => {
    if (!ids || ids.length === 0) return '---';
    return ids.map(id => playerMap.get(String(id))?.name || 'Unknown').join(' & ');
  };

  // --- HISTORICAL HANDICAP CALCULATION (USING AI LOGIC) ---
  // Replaces previous simplified logic with the robust one from autoMatchmaker
  const matchHandicapHistory = useMemo(() => {
      // Use shared function to ensure 100% sync with AI Matchmaker & Stats
      return analyzeHistoryHandicaps(matches, players);
  }, [matches, players]);

  const getMatchHandicapStatus = (m: Match) => {
      return matchHandicapHistory.get(m.id) || 'balanced';
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatGroupDate = (isoString: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(isoString).toLocaleDateString('vi-VN', options);
  };

  const filteredAndSortedMatches = useMemo(() => {
    let result = matches.filter(m => {
        if (activeTab === 'all') return true;
        const type = m.type || 'betting'; 
        return type === activeTab;
    });

    if (selectedDate) {
      result = result.filter(m => {
        return m.date.startsWith(selectedDate);
      });
    }

    if (selectedPlayerId) {
      result = result.filter(m => {
         const t1 = m.team1.map(String);
         const t2 = m.team2.map(String);
         return t1.includes(selectedPlayerId) || t2.includes(selectedPlayerId);
      });
    }

    if (handicapFilter !== 'all') {
        result = result.filter(m => {
            const status = getMatchHandicapStatus(m);
            if (handicapFilter === 'balanced') return status === 'balanced';
            if (handicapFilter === 'imbalanced') return status !== 'balanced';
            return true;
        });
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, selectedDate, selectedPlayerId, activeTab, handicapFilter, playerMap, matchHandicapHistory]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation(); 
    setTimeout(() => {
        if (onDeleteMatch && window.confirm('Bạn có chắc muốn xóa trận đấu này? Lịch sử điểm số sẽ được cập nhật lại.')) {
            onDeleteMatch(id);
        }
    }, 10);
  };

  const handleViewDetails = (e: React.MouseEvent, matchId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const details = getMatchRatingDetails(matchId, matches, players);
      if (details) {
          if (!details.isRule2) {
              alert("Trận đấu này áp dụng luật cũ (V1) hoặc không tìm thấy dữ liệu.");
          } else {
              setViewingLog(details);
          }
      }
  };

  const groupedMatches: { date: string, matches: Match[] }[] = [];
  filteredAndSortedMatches.forEach(match => {
    const dateKey = match.date.split('T')[0];
    const lastGroup = groupedMatches[groupedMatches.length - 1];
    
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.matches.push(match);
    } else {
      groupedMatches.push({ date: dateKey, matches: [match] });
    }
  });

  return (
    <div className="space-y-4">
        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1 sticky top-16 z-30 overflow-x-auto no-scrollbar">
            <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all whitespace-nowrap px-2 ${
                    activeTab === 'all' 
                    ? 'bg-slate-800 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Layers className="w-4 h-4" /> Tất Cả
            </button>
            <button
                onClick={() => setActiveTab('betting')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all whitespace-nowrap px-2 ${
                    activeTab === 'betting' 
                    ? 'bg-pickle-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Banknote className="w-4 h-4" /> Kèo
            </button>
            <button
                onClick={() => setActiveTab('tournament')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all whitespace-nowrap px-2 ${
                    activeTab === 'tournament' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
                <Trophy className="w-4 h-4" /> Giải
            </button>
        </div>

        <Card className="h-full flex flex-col p-0 sm:p-6" classNameTitle="px-4">
          <div className="flex flex-col gap-2 mb-2 mx-2 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 sticky top-0 z-20">
              
              {/* Row 1: Date & Handicap Filter */}
              <div className="flex gap-2 w-full">
                  <div className="flex items-center gap-2 flex-1">
                      <Filter className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-700 font-bold whitespace-nowrap hidden sm:inline">Ngày:</span>
                      <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-pickle-500 w-full h-8"
                      />
                      {selectedDate && (
                        <button onClick={() => setSelectedDate('')} className="p-1 hover:bg-slate-200 rounded-full flex-shrink-0"><X className="w-3 h-3 text-slate-500" /></button>
                      )}
                  </div>

                  <div className="flex items-center gap-2 flex-1">
                      <Scale className="w-3 h-3 text-slate-400" />
                      <select 
                          value={handicapFilter}
                          onChange={(e) => setHandicapFilter(e.target.value as any)}
                          className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-pickle-500 w-full h-8"
                      >
                          <option value="all">Mọi Kèo</option>
                          <option value="balanced">Kèo Cân</option>
                          <option value="imbalanced">Kèo Lệch</option>
                      </select>
                  </div>
              </div>

              {/* Row 2: Player Filter */}
              <div className="flex items-center gap-2 w-full">
                  <User className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-700 font-bold whitespace-nowrap hidden sm:inline">Người chơi:</span>
                  <select 
                      value={selectedPlayerId}
                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                      className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-pickle-500 w-full h-8"
                  >
                      <option value="">Tất cả</option>
                      {sortedPlayers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                   {selectedPlayerId && (
                    <button onClick={() => setSelectedPlayerId('')} className="p-1 hover:bg-slate-200 rounded-full flex-shrink-0"><X className="w-3 h-3 text-slate-500" /></button>
                  )}
              </div>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-250px)] px-2 pb-4">
              {groupedMatches.map(group => (
              <div key={group.date} className="space-y-2">
                  <div className="flex items-center gap-3 py-1 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                    <div className="h-px flex-1 bg-slate-100"></div>
                    <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                        <Calendar className="w-3 h-3" />
                        {formatGroupDate(group.date)}
                    </div>
                    <div className="h-px flex-1 bg-slate-100"></div>
                  </div>

                  {group.matches.map(match => {
                      const isRule2 = new Date(match.date).getTime() >= new Date('2026-01-01T00:00:00').getTime();
                      const status = getMatchHandicapStatus(match);
                      
                      // --- STRICT WINNER LOGIC (Must match storageService) ---
                      let s1 = Number(match.score1);
                      let s2 = Number(match.score2);
                      if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
                      
                      let displayWinner: 1 | 2;
                      if (s1 > s2) displayWinner = 1;
                      else if (s2 > s1) displayWinner = 2;
                      else displayWinner = Number(match.winner) === 1 ? 1 : 2;
                      
                      return (
                      <div key={match.id} className="relative flex flex-col justify-center p-2 rounded border border-slate-100 bg-white hover:border-slate-300 transition-colors shadow-sm gap-1 group">
                          
                          <div className="flex items-center justify-between text-[10px] leading-none mb-1">
                              <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-500">{formatDate(match.date).split(' ')[1]}</span>
                                  
                                  {/* TYPE BADGE */}
                                  <span className={`px-1.5 py-0.5 rounded border font-bold ${(match.type || 'betting') === 'tournament' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'}`}>
                                     {(match.type || 'betting') === 'tournament' ? 'GIẢI' : 'KÈO'}
                                  </span>

                                  {/* HANDICAP BADGE */}
                                  {status === 'balanced' ? (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-100 font-bold" title="Kèo Cân (Chênh lệch rating <= 0.25)">
                                          <Scale className="w-3 h-3" /> Cân
                                      </span>
                                  ) : (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-100 font-bold" title="Kèo Lệch (Có cửa trên/dưới)">
                                          <AlertCircle className="w-3 h-3" /> Lệch
                                      </span>
                                  )}
    
                                  {match.rankingPoints && (match.type || 'betting') === 'betting' && (
                                      <span className="text-green-600 font-bold ml-1 hidden sm:inline">
                                      +{match.rankingPoints}đ
                                      </span>
                                  )}
                              </div>
                              
                              <div className="flex items-center gap-1">
                                  {isRule2 && (
                                      <button type="button" onClick={(e) => handleViewDetails(e, match.id)} className="text-blue-400 hover:text-blue-600 p-1" title="Chi tiết">
                                          <Info className="w-3.5 h-3.5" />
                                      </button>
                                  )}
                                  {onDeleteMatch && (
                                      <button type="button" onClick={(e) => handleDelete(e, match.id)} className="text-slate-300 hover:text-red-500 p-1" title="Xóa">
                                          <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                  )}
                              </div>
                          </div>
                          
                          <div className="flex items-center justify-between gap-2">
                              {/* Team 1 */}
                              <div className={`flex-1 text-right text-xs leading-tight line-clamp-2 ${displayWinner === 1 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                                {getNames(match.team1)}
                                {status === 't1_favorite' && <span className="ml-1 text-[8px] bg-red-100 text-red-600 px-1 rounded font-bold uppercase tracking-tighter align-top">Trên</span>}
                              </div>
    
                              {/* Score */}
                              <div className="flex-shrink-0 flex items-center justify-center gap-0.5 w-12 h-6 bg-slate-50 rounded border border-slate-200 font-mono font-bold text-sm">
                                <span className={displayWinner === 1 ? 'text-pickle-600' : 'text-slate-400'}>{match.score1}</span>
                                <span className="text-slate-300 text-[10px] mx-0.5">-</span>
                                <span className={displayWinner === 2 ? 'text-blue-600' : 'text-slate-400'}>{match.score2}</span>
                              </div>
    
                              {/* Team 2 */}
                              <div className={`flex-1 text-left text-xs leading-tight line-clamp-2 ${displayWinner === 2 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                                {status === 't2_favorite' && <span className="mr-1 text-[8px] bg-red-100 text-red-600 px-1 rounded font-bold uppercase tracking-tighter align-top">Trên</span>}
                                {getNames(match.team2)}
                              </div>
                          </div>
                      </div>
                      )
                  })}
              </div>
              ))}

              {filteredAndSortedMatches.length === 0 && (
                  <div className="text-center text-slate-400 py-8 text-sm">Không tìm thấy trận đấu nào.</div>
              )}
          </div>
        </Card>

        {viewingLog && (
            <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm overflow-y-auto animate-fade-in p-4 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-blue-400" />
                            <h3 className="font-bold text-lg">Chi Tiết Tính Điểm (Rule 2.0)</h3>
                        </div>
                        <button onClick={() => setViewingLog(null)} className="p-1 hover:bg-slate-800 rounded-full">
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>

                    <div className="p-4 md:p-6 overflow-y-auto space-y-6">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">Tỉ số trận đấu</span>
                                <span className="text-xs font-bold text-slate-500 uppercase">Hiệu số: {Math.abs(viewingLog.scoreA - viewingLog.scoreB)}</span>
                            </div>
                            <div className="flex items-center justify-center gap-6">
                                <div className={`text-2xl font-black ${viewingLog.scoreA > viewingLog.scoreB ? 'text-green-600' : 'text-slate-400'}`}>
                                    {viewingLog.scoreA}
                                </div>
                                <div className="text-slate-300 font-bold">-</div>
                                <div className={`text-2xl font-black ${viewingLog.scoreB > viewingLog.scoreA ? 'text-blue-600' : 'text-slate-400'}`}>
                                    {viewingLog.scoreB}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-sm font-bold text-slate-800 border-l-4 border-blue-500 pl-2">Step 1-5: Tính Điểm Đội</h4>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                                    <div className="text-slate-500 mb-1">Rating Trung Bình Đội A</div>
                                    <div className="font-mono font-bold text-lg">{viewingLog.teamA_Rating.toFixed(3)}</div>
                                </div>
                                <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                                    <div className="text-slate-500 mb-1">Rating Trung Bình Đội B</div>
                                    <div className="font-mono font-bold text-lg">{viewingLog.teamB_Rating.toFixed(3)}</div>
                                </div>
                            </div>
                            
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Chênh lệch (Diff):</span>
                                    <span className="font-bold font-mono">{viewingLog.diff.toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Kỳ vọng thắng (Expected A):</span>
                                    <span className="font-bold font-mono">{(viewingLog.expectedA * 100).toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">Hệ số đậm (Margin Factor):</span>
                                    <span className="font-bold font-mono text-purple-600">x{viewingLog.marginFactor.toFixed(2)}</span>
                                </div>
                                <div className="border-t border-blue-200 my-1 pt-1 flex justify-between text-blue-800 font-bold">
                                    <span>Team Change (Base):</span>
                                    <span>{viewingLog.teamChangeA > 0 ? '+' : ''}{viewingLog.teamChangeA.toFixed(4)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-sm font-bold text-slate-800 border-l-4 border-green-500 pl-2">Step 6-8: Chia Điểm Cá Nhân</h4>
                            <div className="overflow-hidden border border-slate-200 rounded-lg">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-slate-500 font-bold">
                                        <tr>
                                            <th className="p-2">Người chơi</th>
                                            <th className="p-2 text-center">Rating Cũ</th>
                                            <th className="p-2 text-center">Tỉ trọng (W)</th>
                                            <th className="p-2 text-right">Thay Đổi</th>
                                            <th className="p-2 text-right">Rating Mới</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {viewingLog.players.sort((a,b) => a.team - b.team).map(p => (
                                            <tr key={p.id} className="bg-white">
                                                <td className="p-2 font-bold text-slate-700">
                                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${p.team === 1 ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                                    {p.name}
                                                </td>
                                                <td className="p-2 text-center text-slate-500 font-mono">{p.oldRating.toFixed(2)}</td>
                                                <td className="p-2 text-center text-slate-500 font-mono">{(p.weight * 100).toFixed(0)}%</td>
                                                <td className={`p-2 text-right font-bold ${p.change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {p.change > 0 ? '+' : ''}{p.change.toFixed(3)}
                                                </td>
                                                <td className="p-2 text-right font-bold text-slate-800 font-mono">{p.newRating.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="text-[10px] text-slate-400 italic mt-1">
                                * Tỉ trọng (W) được tính dựa trên chênh lệch rating cá nhân so với trung bình team (Step 6).
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        )}
    </div>
  );
};