import React, { useState, useMemo } from 'react';
import { Player, Match } from '../types';
import { Card } from './Card';
import { predictMatchOutcome, GeneratedMatch } from '../services/autoMatchmaker';
import { User, Users, Swords, History, Calendar, ArrowRightLeft, BrainCircuit, Shield, CheckCircle2, Info, Plus, Trash2, Trophy, Zap } from 'lucide-react';

interface AnalysisProps {
  players: Player[];
  matches: Match[];
}

interface ComparisonStats {
  totalMatches: number;
  wins1: number;
  wins2: number;
  history: Match[];
}

interface PredictionTeam {
    id: string; // Unique row ID
    p1: string;
    p2: string;
}

interface PredictionStats {
    teamId: string; // Matches row ID
    playerIds: string[];
    playerNames: string[];
    currentWins: number; // In this simulation context, it's 0 start
    expectedWins: number;
    totalProjected: number;
    strength: number;
}

// Extracted Component to prevent re-creation on render
const PlayerSelect = ({ 
    value, 
    onChange, 
    players, 
    exclude, 
    label, 
    compact = false 
}: { 
    value: string, 
    onChange: (val: string) => void, 
    players: Player[], 
    exclude: string[], 
    label: string, 
    compact?: boolean 
}) => (
    <select 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900 font-medium focus:ring-2 focus:ring-pickle-500 outline-none ${compact ? 'py-1 px-2 text-xs' : 'p-2 text-sm'}`}
    >
      <option value="">{label}</option>
      {players.filter(p => !exclude.includes(String(p.id))).map(p => (
          <option key={p.id} value={String(p.id)}>{p.name}</option>
      ))}
    </select>
);

export const Analysis: React.FC<AnalysisProps> = ({ players, matches }) => {
  const [mode, setMode] = useState<'individual' | 'pair' | 'prediction'>('individual');
  
  // Individual Mode State
  const [selectedId1, setSelectedId1] = useState<string>('');
  const [selectedId2, setSelectedId2] = useState<string>('');

  // Pair Mode State (Pair A: p1 & p2 | Pair B: p3 & p4)
  const [pair1P1, setPair1P1] = useState<string>('');
  const [pair1P2, setPair1P2] = useState<string>('');
  const [pair2P1, setPair2P1] = useState<string>('');
  const [pair2P2, setPair2P2] = useState<string>('');

  // Tournament Prediction Mode State
  const [predictionTeams, setPredictionTeams] = useState<PredictionTeam[]>([
      { id: '1', p1: '', p2: '' },
      { id: '2', p1: '', p2: '' },
      { id: '3', p1: '', p2: '' }
  ]);
  const [predictionResults, setPredictionResults] = useState<PredictionStats[]>([]);

  // --- HELPER: PLAYER MAP & SORTED ---
  const playerMap = useMemo(() => {
    return new Map<string, Player>(players.map(p => [String(p.id), p]));
  }, [players]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  // --- AI PREDICTION LOGIC (Individual/Pair) ---
  const aiPrediction: GeneratedMatch | null = useMemo(() => {
    if (mode === 'prediction') return null; // Don't run this for prediction mode

    try {
        if (mode === 'individual') {
            if (selectedId1 && selectedId2 && selectedId1 !== selectedId2) {
                return predictMatchOutcome([selectedId1], [selectedId2], players, matches);
            }
        } else {
             if (pair1P1 && pair1P2 && pair2P1 && pair2P2 && pair1P1 !== pair1P2 && pair2P1 !== pair2P2) {
                return predictMatchOutcome([pair1P1, pair1P2], [pair2P1, pair2P2], players, matches);
             }
        }
    } catch (e) {
        console.error("AI Prediction Error:", e);
    }
    return null;
  }, [mode, selectedId1, selectedId2, pair1P1, pair1P2, pair2P1, pair2P2, players, matches]);


  // --- LOGIC: COMPARE (Individual/Pair) ---
  const stats = useMemo<ComparisonStats>(() => {
    if (mode === 'prediction') return { totalMatches: 0, wins1: 0, wins2: 0, history: [] };

    // Validation
    if (mode === 'individual') {
        if (!selectedId1 || !selectedId2 || selectedId1 === selectedId2) {
            return { totalMatches: 0, wins1: 0, wins2: 0, history: [] };
        }
    } else {
        // Pair Mode Validation
        if (!pair1P1 || !pair1P2 || !pair2P1 || !pair2P2) return { totalMatches: 0, wins1: 0, wins2: 0, history: [] };
        // Unique players check (basic)
        if (pair1P1 === pair1P2 || pair2P1 === pair2P2) return { totalMatches: 0, wins1: 0, wins2: 0, history: [] };
    }

    const relevantMatches = matches.filter(m => {
        if (!m.team1 || !m.team2) return false;

        const team1Ids = m.team1.map(String);
        const team2Ids = m.team2.map(String);

        if (mode === 'individual') {
            const p1InTeam1 = team1Ids.includes(selectedId1);
            const p1InTeam2 = team2Ids.includes(selectedId1);
            const p2InTeam1 = team1Ids.includes(selectedId2);
            const p2InTeam2 = team2Ids.includes(selectedId2);

            return (p1InTeam1 && p2InTeam2) || (p1InTeam2 && p2InTeam1);
        } else {
            // Pair Mode Logic
            // Check if Team1 has Pair 1 members AND Team2 has Pair 2 members
            const t1HasPair1 = team1Ids.includes(pair1P1) && team1Ids.includes(pair1P2);
            const t2HasPair2 = team2Ids.includes(pair2P1) && team2Ids.includes(pair2P2);

            // Check reverse
            const t1HasPair2 = team1Ids.includes(pair2P1) && team1Ids.includes(pair2P2);
            const t2HasPair1 = team2Ids.includes(pair1P1) && team2Ids.includes(pair1P2);

            return (t1HasPair1 && t2HasPair2) || (t1HasPair2 && t2HasPair1);
        }
    });

    let wins1 = 0;
    let wins2 = 0;

    relevantMatches.forEach(m => {
        const team1Ids = m.team1.map(String);
        let isEntity1InTeam1 = false;
        
        if (mode === 'individual') {
            isEntity1InTeam1 = team1Ids.includes(selectedId1);
        } else {
            // In Pair mode, Entity 1 is Pair 1
            isEntity1InTeam1 = team1Ids.includes(pair1P1) && team1Ids.includes(pair1P2);
        }

        const winner = m.winner; 

        if (isEntity1InTeam1) {
            if (winner === 1) wins1++; else wins2++;
        } else {
            if (winner === 2) wins1++; else wins2++;
        }
    });

    const sortedHistory = relevantMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
        totalMatches: relevantMatches.length,
        wins1,
        wins2,
        history: sortedHistory
    };

  }, [matches, mode, selectedId1, selectedId2, pair1P1, pair1P2, pair2P1, pair2P2]);

  // --- LOGIC: TOURNAMENT PREDICTION ---
  const addPredictionTeam = () => {
      setPredictionTeams(prev => [...prev, { id: Date.now().toString(), p1: '', p2: '' }]);
  };

  const removePredictionTeam = (id: string) => {
      if (predictionTeams.length <= 2) return;
      setPredictionTeams(prev => prev.filter(t => t.id !== id));
  };

  const updatePredictionTeam = (id: string, field: 'p1' | 'p2', value: string) => {
      setPredictionTeams(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSimulateTournament = () => {
      try {
        // 1. Validation
        const validTeams = predictionTeams.filter(t => t.p1 && t.p2);
        if (validTeams.length < 2) {
            alert("Vui lòng chọn ít nhất 2 đội đầy đủ thành viên để dự đoán.");
            return;
        }
        
        const allPlayerIds = validTeams.flatMap(t => [t.p1, t.p2]);
        if (new Set(allPlayerIds).size !== allPlayerIds.length) {
            alert("Có thành viên bị trùng lặp trong các đội. Một người chỉ được chơi cho 1 đội.");
            return;
        }

        // 2. Setup Stats Map
        const statsMap = new Map<string, PredictionStats>();
        
        // Calculate initial strength for display
        validTeams.forEach(t => {
            const p1 = playerMap.get(t.p1);
            const p2 = playerMap.get(t.p2);
            
            let strength = 0;
            // Use existing logic to calculate current strength
            const dummyMatch = predictMatchOutcome([t.p1, t.p2], [t.p1, t.p2], players, matches);
            if (dummyMatch) strength = dummyMatch.team1.strength;

            statsMap.set(t.id, {
                teamId: t.id,
                playerIds: [t.p1, t.p2],
                playerNames: [p1?.name || '?', p2?.name || '?'],
                currentWins: 0,
                expectedWins: 0,
                totalProjected: 0,
                strength
            });
        });

        // 3. Simulate Round Robin
        for (let i = 0; i < validTeams.length; i++) {
            for (let j = i + 1; j < validTeams.length; j++) {
                const tA = validTeams[i];
                const tB = validTeams[j];

                const prediction = predictMatchOutcome(
                    [tA.p1, tA.p2],
                    [tB.p1, tB.p2],
                    players,
                    matches
                );

                if (prediction) {
                    const strA = prediction.team1.strength;
                    const strB = prediction.team2.strength;
                    
                    // Expected Win Formula (Logistic)
                    // P(A) = 1 / (1 + 10^((Rb-Ra)/D))
                    const probA = 1 / (1 + Math.pow(10, (strB - strA) / 1.2));
                    const probB = 1 - probA;

                    const statsA = statsMap.get(tA.id)!;
                    const statsB = statsMap.get(tB.id)!;

                    statsA.expectedWins += probA;
                    statsB.expectedWins += probB;
                }
            }
        }

        // 4. Sort and Set
        const results = Array.from(statsMap.values()).map(s => ({
            ...s,
            totalProjected: s.expectedWins
        })).sort((a, b) => b.totalProjected - a.totalProjected);

        setPredictionResults(results);
      } catch (e) {
          console.error(e);
          alert("Có lỗi xảy ra khi tính toán. Vui lòng kiểm tra lại dữ liệu.");
      }
  };

  // --- RENDER HELPERS ---
  const getName = (side: 1 | 2) => {
      if (mode === 'individual') {
          const id = side === 1 ? selectedId1 : selectedId2;
          return playerMap.get(id)?.name || 'Unknown';
      } else {
          const p1 = side === 1 ? pair1P1 : pair2P1;
          const p2 = side === 1 ? pair1P2 : pair2P2;
          const n1 = playerMap.get(p1)?.name || '...';
          const n2 = playerMap.get(p2)?.name || '...';
          return `${n1} & ${n2}`;
      }
  };

  const getWinRate = (wins: number) => {
      if (stats.totalMatches === 0) return 0;
      return Math.round((wins / stats.totalMatches) * 100);
  };

  // Helper to check if a player ID is part of the "Focused" comparison
  const isComparedPlayer = (id: string) => {
      if (mode === 'individual') return id === selectedId1 || id === selectedId2;
      return [pair1P1, pair1P2, pair2P1, pair2P2].includes(id);
  };

  const renderNames = (ids: string[]) => {
      const safeIds = ids.map(String);
      return (
          <div className="flex flex-col text-xs sm:text-sm">
              {safeIds.map((id, idx) => {
                  const pName = playerMap.get(id)?.name || 'Unknown';
                  const isHighlighted = isComparedPlayer(id);
                  return (
                      <span key={idx} className={`${isHighlighted ? 'font-bold text-slate-900 bg-yellow-100 px-1 rounded w-fit' : 'text-slate-500'} truncate`}>
                          {pName}
                      </span>
                  );
              })}
          </div>
      );
  };

  return (
    <div className="space-y-6 animate-fade-in">
        
        {/* MODE TOGGLE */}
        <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 flex gap-2 overflow-x-auto">
             <button
                onClick={() => setMode('individual')}
                className={`flex-1 py-2.5 px-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-xs sm:text-sm whitespace-nowrap ${mode === 'individual' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                 <User className="w-4 h-4" /> Cá Nhân
             </button>
             <button
                onClick={() => setMode('pair')}
                className={`flex-1 py-2.5 px-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-xs sm:text-sm whitespace-nowrap ${mode === 'pair' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                 <Users className="w-4 h-4" /> Cặp Đôi
             </button>
             <button
                onClick={() => setMode('prediction')}
                className={`flex-1 py-2.5 px-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-xs sm:text-sm whitespace-nowrap ${mode === 'prediction' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
             >
                 <BrainCircuit className="w-4 h-4" /> Dự Đoán Giải
             </button>
        </div>

        {/* SELECTORS AREA */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            {mode === 'individual' && (
                <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
                    <div className="w-full md:w-1/3">
                        <PlayerSelect 
                            value={selectedId1} 
                            onChange={setSelectedId1} 
                            players={sortedPlayers}
                            exclude={[selectedId2]} 
                            label="-- Chọn Người A --" 
                        />
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-500 font-black text-[10px] shrink-0">VS</div>
                    <div className="w-full md:w-1/3">
                        <PlayerSelect 
                            value={selectedId2} 
                            onChange={setSelectedId2} 
                            players={sortedPlayers}
                            exclude={[selectedId1]} 
                            label="-- Chọn Người B --" 
                        />
                    </div>
                </div>
            )}

            {mode === 'pair' && (
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Pair 1 Selector */}
                    <div className="flex-1 w-full bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative">
                        <div className="absolute -top-2.5 left-3 px-2 bg-white text-[10px] font-bold text-pickle-600 uppercase tracking-wider border border-slate-100 rounded">
                            Cặp Đôi 1
                        </div>
                        <div className="flex flex-col gap-2 mt-1">
                            <PlayerSelect value={pair1P1} onChange={setPair1P1} players={sortedPlayers} exclude={[pair1P2, pair2P1, pair2P2]} label="Thành viên 1" />
                            <PlayerSelect value={pair1P2} onChange={setPair1P2} players={sortedPlayers} exclude={[pair1P1, pair2P1, pair2P2]} label="Thành viên 2" />
                        </div>
                    </div>

                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-white font-black text-[10px] shrink-0 shadow-lg z-10">
                        VS
                    </div>

                    {/* Pair 2 Selector */}
                    <div className="flex-1 w-full bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative">
                        <div className="absolute -top-2.5 right-3 px-2 bg-white text-[10px] font-bold text-blue-600 uppercase tracking-wider border border-slate-100 rounded">
                            Cặp Đôi 2
                        </div>
                        <div className="flex flex-col gap-2 mt-1">
                            <PlayerSelect value={pair2P1} onChange={setPair2P1} players={sortedPlayers} exclude={[pair1P1, pair1P2, pair2P2]} label="Thành viên 1" />
                            <PlayerSelect value={pair2P2} onChange={setPair2P2} players={sortedPlayers} exclude={[pair1P1, pair1P2, pair2P1]} label="Thành viên 2" />
                        </div>
                    </div>
                </div>
            )}

            {mode === 'prediction' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-700 uppercase">Danh sách các đội tham gia</h3>
                        <button 
                            onClick={handleSimulateTournament}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md transition-colors flex items-center gap-2"
                        >
                            <Zap className="w-3 h-3" /> CHẠY DỰ ĐOÁN
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {predictionTeams.map((team, idx) => {
                            const otherPlayers = predictionTeams.filter(t => t.id !== team.id).flatMap(t => [t.p1, t.p2]);
                            return (
                                <div key={team.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Đội {idx + 1}</span>
                                        <button 
                                            onClick={() => removePredictionTeam(team.id)}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                            disabled={predictionTeams.length <= 2}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        <PlayerSelect 
                                            value={team.p1} 
                                            onChange={(v) => updatePredictionTeam(team.id, 'p1', v)} 
                                            players={sortedPlayers}
                                            exclude={[team.p2, ...otherPlayers]} 
                                            label="Thành viên 1" 
                                            compact
                                        />
                                        <PlayerSelect 
                                            value={team.p2} 
                                            onChange={(v) => updatePredictionTeam(team.id, 'p2', v)} 
                                            players={sortedPlayers}
                                            exclude={[team.p1, ...otherPlayers]} 
                                            label="Thành viên 2" 
                                            compact
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        
                        <button 
                            onClick={addPredictionTeam}
                            className="border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-4 text-slate-400 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all min-h-[140px]"
                        >
                            <Plus className="w-8 h-8 mb-1" />
                            <span className="text-xs font-bold uppercase">Thêm Đội</span>
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* AI PREDICTION CARD (Individual/Pair Results) */}
        {aiPrediction && mode !== 'prediction' && (
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl p-5 text-white shadow-lg animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <BrainCircuit className="w-32 h-32" />
                </div>
                
                <div className="flex flex-col md:flex-row items-start gap-6 relative z-10">
                    <div className="hidden md:block p-3 bg-white/20 rounded-lg backdrop-blur-sm shadow-inner shrink-0">
                        <BrainCircuit className="w-8 h-8 text-yellow-300 animate-pulse" />
                    </div>
                    
                    <div className="flex-1 text-center md:text-left w-full">
                        <h3 className="font-bold text-lg uppercase tracking-wider mb-2 flex items-center justify-center md:justify-start gap-2">
                            AI Nhận Định
                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">
                                Match Quality: {aiPrediction.analysis.qualityScore.toFixed(0)}/100
                            </span>
                        </h3>
                        
                        <div className="mt-2 p-4 bg-white/10 rounded-lg border border-white/20 shadow-inner">
                            {aiPrediction.handicap ? (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        <Shield className="w-8 h-8 text-yellow-400 shrink-0" />
                                        <div className="text-left">
                                            <div className="font-bold text-yellow-300 text-lg leading-tight">
                                                Kèo Chấp: {aiPrediction.handicap.team === 1 ? (mode === 'pair' ? 'Cặp 2' : 'Người 2') : (mode === 'pair' ? 'Cặp 1' : 'Người 1')} chấp {mode === 'pair' ? (aiPrediction.handicap.team === 1 ? 'Cặp 1' : 'Cặp 2') : (aiPrediction.handicap.team === 1 ? 'Người 1' : 'Người 2')} {aiPrediction.handicap.points} quả
                                            </div>
                                        </div>
                                    </div>
                                    {/* Detailed Breakdown */}
                                    {aiPrediction.handicap.details && aiPrediction.handicap.details.length > 0 && (
                                        <div className="mt-1 bg-black/30 rounded p-3 text-xs text-white/90 font-mono shadow-inner border border-white/5">
                                            <div className="flex items-center gap-1 font-bold mb-2 opacity-80 uppercase tracking-wider text-[10px] border-b border-white/10 pb-1">
                                                <Info className="w-3 h-3" /> Diễn giải công thức:
                                            </div>
                                            <ul className="space-y-1.5 list-none">
                                                {aiPrediction.handicap.details.map((d, i) => (
                                                    <li key={i} className="pl-1">{d}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="w-8 h-8 text-green-400 shrink-0" />
                                    <div className="text-left">
                                        <div className="font-bold text-green-300 text-lg leading-tight">
                                            Kèo Đồng Banh (Cân Bằng)
                                        </div>
                                        {/* Show details for "Why" it is balanced if available */}
                                        {aiPrediction.handicap && aiPrediction.handicap.details && (
                                            <div className="mt-2 bg-black/30 rounded p-2 text-xs text-white/90 font-mono">
                                                <ul className="space-y-1 list-none">
                                                    {aiPrediction.handicap.details.map((d, i) => (
                                                        <li key={i}>{d}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <div className="text-xs text-white/80 italic mt-2">
                                            Chênh lệch trình độ nằm trong ngưỡng an toàn.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* TOURNAMENT PREDICTION RESULTS */}
        {mode === 'prediction' && (
            predictionResults.length > 0 ? (
                <Card title="Kết Quả Dự Đoán Xếp Hạng (Vòng Tròn Tính Điểm)" classNameTitle="bg-purple-50 text-purple-800 font-bold uppercase text-xs tracking-wider">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-center w-12">#</th>
                                    <th className="px-4 py-3">Đội Thi Đấu</th>
                                    <th className="px-4 py-3 text-center">Trận Thắng Kỳ Vọng</th>
                                    <th className="px-4 py-3 text-right">Rating Team</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {predictionResults.map((team, idx) => (
                                    <tr key={team.teamId} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-center font-bold text-slate-400">
                                            {idx === 0 ? <Trophy className="w-5 h-5 text-yellow-500 mx-auto" fill="currentColor" /> : idx + 1}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-800">{team.playerNames.join(' & ')}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`font-black text-lg ${idx === 0 ? 'text-purple-600' : 'text-slate-700'}`}>
                                                {team.totalProjected.toFixed(2)}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-1">trận</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-mono font-bold border border-slate-200">
                                                {team.strength.toFixed(1)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 bg-purple-50 text-purple-800 text-xs italic mt-2 border-t border-purple-100">
                        * Hệ thống giả lập các cặp đấu vòng tròn và tính xác suất thắng dựa trên chênh lệch Rating (bao gồm phong độ).
                    </div>
                </Card>
            ) : (
                <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-dashed border-purple-200 text-slate-400 bg-purple-50/30">
                     <BrainCircuit className="w-16 h-16 mb-4 text-purple-200" />
                     <p className="font-bold text-slate-500">Chưa có kết quả dự đoán</p>
                     <p className="text-xs mt-1">Vui lòng nhập danh sách đội ở trên và bấm "Chạy Dự Đoán".</p>
                </div>
            )
        )}

        {/* COMPARISON DISPLAY (Individual/Pair) */}
        { mode !== 'prediction' && ( (mode === 'individual' && selectedId1 && selectedId2) || (mode === 'pair' && pair1P1 && pair1P2 && pair2P1 && pair2P2) ) ? (
            <>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Card */}
                <Card className="md:col-span-3 bg-white border-none shadow-lg overflow-hidden relative">
                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-1/2 h-1 bg-pickle-500 z-10"></div>
                    <div className="absolute top-0 right-0 w-1/2 h-1 bg-blue-500 z-10"></div>
                    
                    <div className="flex flex-col gap-6 pt-4">
                        {/* HEAD TO HEAD HEADER */}
                        <div className="flex justify-between items-center text-center">
                             <div className="flex-1">
                                <h3 className="text-sm md:text-xl font-bold text-slate-900 truncate px-1 leading-tight">{getName(1)}</h3>
                                <div className="text-3xl md:text-4xl font-black text-pickle-600 mt-2">{stats.wins1}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Thắng</div>
                             </div>

                             <div className="flex flex-col items-center px-2">
                                 <div className="text-2xl md:text-3xl font-black text-slate-300">
                                     <Swords className="w-8 h-8 md:w-10 md:h-10" />
                                 </div>
                                 <div className="text-xs font-bold text-slate-500 mt-2 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-full">{stats.totalMatches} Trận</div>
                             </div>

                             <div className="flex-1">
                                <h3 className="text-sm md:text-xl font-bold text-slate-900 truncate px-1 leading-tight">{getName(2)}</h3>
                                <div className="text-3xl md:text-4xl font-black text-blue-600 mt-2">{stats.wins2}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Thắng</div>
                             </div>
                        </div>

                        {/* WINRATE BAR */}
                        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                            {stats.totalMatches > 0 ? (
                                <>
                                    <div 
                                        style={{ width: `${getWinRate(stats.wins1)}%` }}
                                        className="h-full bg-pickle-500 transition-all duration-500"
                                    ></div>
                                    <div 
                                        style={{ width: `${getWinRate(stats.wins2)}%` }}
                                        className="h-full bg-blue-500 transition-all duration-500"
                                    ></div>
                                </>
                            ) : (
                                <div className="w-full h-full bg-slate-200"></div>
                            )}
                        </div>
                        <div className="flex justify-between text-xs font-bold text-slate-500 px-1">
                            <span>{getWinRate(stats.wins1)}% Win Rate</span>
                            <span>{getWinRate(stats.wins2)}% Win Rate</span>
                        </div>
                    </div>
                </Card>
             </div>

             {/* HISTORY LIST */}
             <div className="space-y-3">
                 <h4 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
                     <History className="w-5 h-5" /> Lịch sử đối đầu
                 </h4>
                 {stats.history.length > 0 ? (
                    <div className="space-y-2">
                        {stats.history.map(match => {
                             const team1Ids = match.team1.map(String);
                             const team2Ids = match.team2.map(String);

                             // Determine if Entity 1 is Team 1
                             let isE1Team1 = false;
                             if (mode === 'individual') {
                                 isE1Team1 = team1Ids.includes(selectedId1);
                             } else {
                                 isE1Team1 = team1Ids.includes(pair1P1) && team1Ids.includes(pair1P2);
                             }
                             
                             const teamLeftIds = isE1Team1 ? team1Ids : team2Ids;
                             const teamRightIds = isE1Team1 ? team2Ids : team1Ids;

                             const scoreLeft = isE1Team1 ? match.score1 : match.score2;
                             const scoreRight = isE1Team1 ? match.score2 : match.score1;
                             
                             const winner = match.winner;
                             const isLeftWin = (isE1Team1 && winner === 1) || (!isE1Team1 && winner === 2);

                             return (
                                <div key={match.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                                    <div className="flex items-center justify-between border-b border-slate-50 pb-2 mb-1">
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(match.date).toLocaleDateString('vi-VN')}
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${match.type === 'tournament' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'}`}>
                                            {match.type === 'tournament' ? 'GIẢI ĐẤU' : 'KÈO'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className={`flex-1 ${isLeftWin ? 'opacity-100' : 'opacity-70'}`}>
                                            {renderNames(teamLeftIds)}
                                        </div>

                                        <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4">
                                            <div className={`text-lg sm:text-xl font-mono font-black ${isLeftWin ? 'text-green-600' : 'text-slate-400'}`}>
                                                {scoreLeft}
                                            </div>
                                            <div className="text-slate-300 font-bold">-</div>
                                            <div className={`text-lg sm:text-xl font-mono font-black ${!isLeftWin ? 'text-green-600' : 'text-slate-400'}`}>
                                                {scoreRight}
                                            </div>
                                        </div>

                                        <div className={`flex-1 text-right ${!isLeftWin ? 'opacity-100' : 'opacity-70'}`}>
                                            {renderNames(teamRightIds)}
                                        </div>
                                    </div>
                                </div>
                             )
                        })}
                    </div>
                 ) : (
                    <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Chưa có trận đấu nào giữa hai bên.
                    </div>
                 )}
             </div>
            </>
        ) : mode !== 'prediction' ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
                 <ArrowRightLeft className="w-16 h-16 mb-4 opacity-20" />
                 <p>Vui lòng chọn đầy đủ người chơi để so sánh.</p>
            </div>
        ) : null}
    </div>
  );
};