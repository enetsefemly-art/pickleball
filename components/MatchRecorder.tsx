import React, { useState, useEffect, useMemo } from 'react';
import { Player, Match } from '../types';
import { Card } from './Card';
import { UserPlus, Users, Calendar, Award, Trophy, Banknote, Check } from 'lucide-react';

interface MatchRecorderProps {
  players: Player[];
  onSave: (match: Omit<Match, 'id'>) => void;
  onCancel: () => void;
}

export const MatchRecorder: React.FC<MatchRecorderProps> = ({ players, onSave, onCancel }) => {
  // New State: Match Type
  const [matchType, setMatchType] = useState<'betting' | 'tournament'>('betting');
  
  // Mode: Doubles (4 players) or Singles (2 players)
  const [mode, setMode] = useState<'singles' | 'doubles'>('doubles');
  
  // Initialize with empty strings for the slots
  const [team1Slots, setTeam1Slots] = useState<string[]>(['', '']);
  const [team2Slots, setTeam2Slots] = useState<string[]>(['', '']);

  // Score Inputs
  const [score1, setScore1] = useState<string>('');
  const [score2, setScore2] = useState<string>('');
  
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Ranking points default to 50
  const [rankingPoints, setRankingPoints] = useState<number>(50);

  const [error, setError] = useState<string | null>(null);

  // Sort players alphabetically for dropdowns
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  // Reset slots when mode changes
  useEffect(() => {
    if (mode === 'singles') {
      setTeam1Slots(prev => [prev[0]]);
      setTeam2Slots(prev => [prev[0]]);
    } else {
      setTeam1Slots(prev => [prev[0] || '', prev[1] || '']);
      setTeam2Slots(prev => [prev[0] || '', prev[1] || '']);
    }
  }, [mode]);

  const handlePlayerChange = (team: 1 | 2, slotIndex: number, playerId: string) => {
    setError(null);
    if (team === 1) {
      const newSlots = [...team1Slots];
      newSlots[slotIndex] = playerId;
      setTeam1Slots(newSlots);
    } else {
      const newSlots = [...team2Slots];
      newSlots[slotIndex] = playerId;
      setTeam2Slots(newSlots);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalScore1 = parseInt(score1);
    let finalScore2 = parseInt(score2);

    if (isNaN(finalScore1) || isNaN(finalScore2)) {
        setError("Vui lòng nhập tỉ số trận đấu.");
        return;
    }

    if (finalScore1 === finalScore2) {
        setError("Tỉ số không thể hòa. Vui lòng xác định đội thắng.");
        return;
    }

    const finalWinner: 1 | 2 = finalScore1 > finalScore2 ? 1 : 2;
    
    // Filter out empty slots
    const finalTeam1 = team1Slots.filter(id => id !== '');
    const finalTeam2 = team2Slots.filter(id => id !== '');

    const requiredCount = mode === 'singles' ? 1 : 2;
    if (finalTeam1.length !== requiredCount || finalTeam2.length !== requiredCount) {
      setError(`Vui lòng chọn đủ ${requiredCount} người mỗi đội.`);
      return;
    }

    // Check for duplicate players across teams
    const allPlayers = [...finalTeam1, ...finalTeam2];
    const uniquePlayers = new Set(allPlayers);
    if (allPlayers.length !== uniquePlayers.size) {
        setError("Một người chơi không thể thi đấu cho cả 2 đội hoặc xuất hiện 2 lần.");
        return;
    }

    const finalDate = new Date(matchDate);
    finalDate.setHours(new Date().getHours(), new Date().getMinutes());

    onSave({
      type: matchType,
      date: finalDate.toISOString(),
      team1: finalTeam1,
      team2: finalTeam2,
      score1: finalScore1,
      score2: finalScore2,
      winner: finalWinner,
      rankingPoints: rankingPoints
    });
  };

  // Helper to filter available players for dropdown to prevent selecting same player twice
  const getAvailablePlayers = (currentId: string) => {
    // Get all selected IDs except the current one being edited
    const allSelectedIds = [...team1Slots, ...team2Slots].filter(id => id !== currentId && id !== '');
    return sortedPlayers.filter(p => !allSelectedIds.includes(p.id));
  };

  return (
    <Card title="Ghi Kết Quả Trận Đấu Mới" className="max-w-2xl mx-auto">
      
      {/* Match Type & Mode Selectors */}
      <div className="mb-6 flex flex-col gap-4">
        {/* Type Selector */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
             <button
                type="button"
                onClick={() => setMatchType('betting')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm transition-all ${
                    matchType === 'betting' 
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
            >
                <Banknote className="w-4 h-4" /> KÈO
            </button>
            <button
                type="button"
                onClick={() => setMatchType('tournament')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm transition-all ${
                    matchType === 'tournament' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
            >
                <Trophy className="w-4 h-4" /> GIẢI
            </button>
        </div>

        {/* Mode Selector */}
        <div className="flex justify-center space-x-4">
            <button 
            onClick={() => setMode('singles')}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg border-2 font-bold transition-all shadow-sm ${
                mode === 'singles' 
                ? 'bg-pickle-600 border-pickle-600 text-white shadow-md' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
            >
            <UserPlus className="w-5 h-5 mr-2" /> Đánh Đơn
            </button>
            <button 
            onClick={() => setMode('doubles')}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg border-2 font-bold transition-all shadow-sm ${
                mode === 'doubles' 
                ? 'bg-pickle-600 border-pickle-600 text-white shadow-md' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
            >
            <Users className="w-5 h-5 mr-2" /> Đánh Đôi
            </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Settings Row */}
        <div className="flex flex-col md:flex-row gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> NGÀY THI ĐẤU
                </label>
                <div className="relative">
                    <input 
                        type="date" 
                        value={matchDate}
                        onChange={(e) => setMatchDate(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker()}
                        className="w-full p-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pickle-500 text-sm bg-white text-slate-900 font-bold cursor-pointer"
                    />
                </div>
            </div>
            
            {matchType === 'betting' && (
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                        <Award className="w-4 h-4" /> MỨC CƯỢC (ĐIỂM)
                    </label>
                    <div className="flex gap-3">
                    {[50, 100].map((points) => (
                        <button
                        key={points}
                        type="button"
                        onClick={() => setRankingPoints(points)}
                        className={`flex-1 py-2 rounded-md font-bold text-sm border-2 transition-all ${
                            rankingPoints === points
                            ? 'bg-yellow-500 border-yellow-500 text-white shadow-md'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                        >
                        {points}
                        </button>
                    ))}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-medium text-center">
                    Thắng +{rankingPoints} / Thua -{rankingPoints}
                    </div>
                </div>
            )}
        </div>

        {/* Teams Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative">
            
            {/* SCORE INPUTS (FLOATING CENTER) */}
            <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1 bg-white p-2 rounded-2xl shadow-xl border-2 border-slate-200">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tỉ Số</div>
                <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        value={score1}
                        onChange={(e) => setScore1(e.target.value)}
                        placeholder="0"
                        className="w-14 h-14 text-center text-3xl font-black text-green-700 bg-green-50 rounded-xl border-2 border-green-200 focus:outline-none focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all"
                    />
                    <span className="text-slate-300 font-black text-xl">:</span>
                    <input 
                        type="number" 
                        value={score2}
                        onChange={(e) => setScore2(e.target.value)}
                        placeholder="0"
                        className="w-14 h-14 text-center text-3xl font-black text-blue-700 bg-blue-50 rounded-xl border-2 border-blue-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                    />
                </div>
            </div>

          
          {/* Team 1 */}
          <div className="space-y-4">
            <div className="text-center pb-2 border-b-2 border-green-700">
                <h4 className="font-bold text-green-800 text-lg uppercase tracking-wide">Đội 1</h4>
            </div>
            
            <div className="space-y-3 pt-6 md:pt-0">
                {team1Slots.map((slot, index) => (
                    <div key={`t1-${index}`}>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                            Người chơi {index + 1}
                        </label>
                        <select
                            value={slot}
                            onChange={(e) => handlePlayerChange(1, index, e.target.value)}
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-pickle-500 focus:border-pickle-500"
                        >
                            <option value="" className="text-slate-400 font-normal">-- Chọn người chơi --</option>
                            {getAvailablePlayers(slot).map(p => (
                                <option key={p.id} value={p.id} className="text-slate-900 font-medium">
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
          </div>

          {/* Team 2 */}
          <div className="space-y-4">
             <div className="text-center pb-2 border-b-2 border-blue-700">
                <h4 className="font-bold text-blue-800 text-lg uppercase tracking-wide">Đội 2</h4>
            </div>

             <div className="space-y-3 pt-6 md:pt-0">
                {team2Slots.map((slot, index) => (
                    <div key={`t2-${index}`}>
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                            Người chơi {index + 1}
                        </label>
                        <select
                            value={slot}
                            onChange={(e) => handlePlayerChange(2, index, e.target.value)}
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="" className="text-slate-400 font-normal">-- Chọn người chơi --</option>
                            {getAvailablePlayers(slot).map(p => (
                                <option key={p.id} value={p.id} className="text-slate-900 font-medium">
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 font-medium rounded-lg text-sm text-center border border-red-200">
            {error}
          </div>
        )}

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Hủy Bỏ
          </button>
          <button
            type="submit"
            className="flex-[2] py-4 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-300 transition-all hover:scale-[1.01]"
          >
            Lưu Kết Quả
          </button>
        </div>
      </form>
    </Card>
  );
};