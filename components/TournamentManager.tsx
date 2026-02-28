import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Player, Match, Team, TournamentMatch, TournamentState, TeamGroup, TeamMatchScheduleItem } from '../types';
import { Trophy, Users, Play, Save, Trash2, Calendar, Shield, Swords, Flag, Sparkles, ArrowLeft, ArrowRightLeft, Clock, Timer, Hourglass, CheckCircle2, Edit3, UploadCloud, AlertCircle, CheckSquare, Square, ChevronUp, ChevronDown, Shuffle, UserPlus, UserMinus } from 'lucide-react';
import { Card } from './Card';
import { getTournamentStandings } from '../services/storageService';

interface TournamentManagerProps {
  players: Player[];
  matches?: Match[];
  tournamentData: TournamentState | null; // Receive from parent
  onUpdateTournament: (newState: TournamentState | null) => void; // Notify parent to sync
  onSaveMatches: (matches: (Omit<Match, 'id'> & { id?: string })[]) => void;
  onDeleteMatch?: (id: string) => void;
}

// --- COUNTDOWN COMPONENT ---
const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
    const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null);
    const [status, setStatus] = useState<'upcoming' | 'ongoing' | 'finished'>('upcoming');

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            const diff = target - now;

            if (diff > 0) {
                setStatus('upcoming');
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                    seconds: Math.floor((diff % (1000 * 60)) / 1000)
                });
            } else {
                // If it's within 24 hours of start, consider it ongoing
                const isOngoing = diff > -(24 * 60 * 60 * 1000); 
                setStatus(isOngoing ? 'ongoing' : 'finished');
                setTimeLeft(null);
            }
        };

        calculateTime();
        const timer = setInterval(calculateTime, 1000);
        return () => clearInterval(timer);
    }, [targetDate]);

    if (status === 'ongoing') {
        return (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full border border-green-200 animate-pulse">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                <span className="text-xs font-black uppercase">Đang diễn ra</span>
            </div>
        );
    }

    if (status === 'finished' || !timeLeft) {
        return (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-bold uppercase">Đã kết thúc</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-sm">
                <Timer className="w-4 h-4 text-yellow-400" />
                <div className="flex items-baseline gap-1 font-mono text-sm font-bold leading-none">
                    <span>{timeLeft.days}d</span>:
                    <span>{timeLeft.hours.toString().padStart(2,'0')}h</span>:
                    <span>{timeLeft.minutes.toString().padStart(2,'0')}m</span>:
                    <span className="text-yellow-400">{timeLeft.seconds.toString().padStart(2,'0')}s</span>
                </div>
            </div>
        </div>
    );
};

export const RoundRobinManager: React.FC<TournamentManagerProps> = ({ 
    players, 
    matches = [], 
    tournamentData, 
    onUpdateTournament, 
    onSaveMatches, 
    onDeleteMatch 
}) => {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'setup' | 'play'>('setup');
  
  // Setup State
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [manualTeams, setManualTeams] = useState<Team[]>([]);
  
  // Initialize date with current local datetime formatted for input
  const [setupDate, setSetupDate] = useState<string>(() => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      return now.toISOString().slice(0, 16);
  });
  
  // Swap State (Teams Setup)
  const [swapSource, setSwapSource] = useState<{ teamId: string, role: 'player1' | 'player2' } | null>(null);

  // Edit Schedule Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [swapMatchId, setSwapMatchId] = useState<string | null>(null);

  // Scroll Ref for Teams List
  const teamListRef = useRef<HTMLDivElement>(null);

  // Sync prop state to local active tab
  useEffect(() => {
      if (tournamentData && tournamentData.isActive) {
          setActiveTab('play');
          setManualTeams(tournamentData.teams || []);
      } else {
          setActiveTab('setup');
          // Clear local state when tournament ends or is inactive
          setManualTeams([]);
          setSelectedPlayerIds([]);
      }
  }, [tournamentData]);

  // --- HELPERS ---
  const activePlayers = useMemo(() => players.filter(p => p.isActive !== false), [players]);
  const sortedPlayers = useMemo(() => [...activePlayers].sort((a, b) => a.name.localeCompare(b.name)), [activePlayers]);

  const getPlayer = (id: string) => players.find(p => String(p.id) === String(id)) || null;

  // --- SETUP ACTIONS ---
  const togglePlayerSelection = (id: string) => {
      setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  // --- SMART PAIRING ALGORITHM ---
  const createSmartTeams = () => {
      if (selectedPlayerIds.length < 2 || selectedPlayerIds.length % 2 !== 0) {
          alert("Cần số lượng người chơi chẵn để chia đội.");
          return;
      }

      const pool = selectedPlayerIds.map(id => {
          const p = getPlayer(id)!;
          return {
              ...p,
              rating: p.tournamentRating || p.initialPoints || 3.0
          };
      }).sort((a, b) => b.rating - a.rating);

      const historyPairs = new Set<string>();
      if (matches) {
          matches.filter(m => m.type === 'tournament').forEach(m => {
              if (m.team1.length === 2) historyPairs.add([...m.team1].map(String).sort().join('-'));
              if (m.team2.length === 2) historyPairs.add([...m.team2].map(String).sort().join('-'));
          });
      }
      
      const midPoint = pool.length / 2;
      const highGroup = pool.slice(0, midPoint);
      const lowGroup = pool.slice(midPoint);

      let bestTeams: Team[] = [];
      let minCost = Infinity;

      for (let i = 0; i < 1000; i++) {
          const shuffledLows = [...lowGroup].sort(() => Math.random() - 0.5);
          let currentCost = 0;
          const currentTeams: Team[] = [];

          for (let j = 0; j < midPoint; j++) {
              const p1 = highGroup[j];
              const p2 = shuffledLows[j];
              
              const pairKey = [String(p1.id), String(p2.id)].sort().join('-');
              if (historyPairs.has(pairKey)) {
                  currentCost += 1000;
              }

              const allRatings = pool.reduce((sum, p) => sum + p.rating, 0);
              const targetPairRating = allRatings / (pool.length / 2);
              const pairSum = p1.rating + p2.rating;
              currentCost += Math.pow(pairSum - targetPairRating, 2) * 10;

              currentTeams.push({
                  id: `team_${Date.now()}_${j}`,
                  name: `${p1.name} & ${p2.name}`,
                  player1: p1,
                  player2: p2
              });
          }

          if (currentCost < minCost) {
              minCost = currentCost;
              bestTeams = currentTeams;
          }
          if (minCost === 0) break;
      }

      setManualTeams(bestTeams);
      setSelectedPlayerIds([]);
  };

  const handleSwapClick = (teamId: string, role: 'player1' | 'player2') => {
      if (swapSource && swapSource.teamId === teamId && swapSource.role === role) {
          setSwapSource(null);
          return;
      }

      if (swapSource) {
          const newTeams = [...manualTeams];
          const sourceTeamIdx = newTeams.findIndex(t => t.id === swapSource.teamId);
          const targetTeamIdx = newTeams.findIndex(t => t.id === teamId);

          if (sourceTeamIdx === -1 || targetTeamIdx === -1) return;

          const sourceTeam = { ...newTeams[sourceTeamIdx] };
          const targetTeam = { ...newTeams[targetTeamIdx] };

          const sourcePlayer = sourceTeam[swapSource.role];
          const targetPlayer = targetTeam[role];

          sourceTeam[swapSource.role] = targetPlayer;
          targetTeam[role] = sourcePlayer;

          sourceTeam.name = `${sourceTeam.player1?.name} & ${sourceTeam.player2?.name}`;
          targetTeam.name = `${targetTeam.player1?.name} & ${targetTeam.player2?.name}`;

          newTeams[sourceTeamIdx] = sourceTeam;
          newTeams[targetTeamIdx] = targetTeam;

          setManualTeams(newTeams);
          setSwapSource(null);
      } else {
          setSwapSource({ teamId, role });
      }
  };

  const removeTeam = (teamId: string) => {
      setManualTeams(manualTeams.filter(t => t.id !== teamId));
  };

  const generateSchedule = () => {
      if (manualTeams.length < 2) {
          alert("Cần ít nhất 2 đội để bắt đầu giải đấu.");
          return;
      }

      const teams = [...manualTeams];
      if (teams.length % 2 !== 0) {
          teams.push({ id: 'bye', name: 'Bye', player1: null, player2: null });
      }

      const n = teams.length;
      const rounds = n - 1;
      const matchesPerRound = n / 2;
      const schedule: TournamentMatch[] = [];

      let roundTeams = [...teams];

      // 1. Generate Full Round Robin Schedule
      for (let r = 0; r < rounds; r++) {
          for (let m = 0; m < matchesPerRound; m++) {
              const t1 = roundTeams[m];
              const t2 = roundTeams[n - 1 - m];

              if (t1.id !== 'bye' && t2.id !== 'bye') {
                  schedule.push({
                      id: `match_${Date.now()}_r${r}_m${m}`,
                      team1Id: t1.id,
                      team2Id: t2.id,
                      court: 1, // Will be updated
                      roundNumber: r + 1,
                      score1: '',
                      score2: '',
                      isCompleted: false
                  });
              }
          }
          roundTeams = [roundTeams[0], ...roundTeams.slice(2), roundTeams[1]];
      }

      // 2. Batched Schedule Optimization (Max 2 matches per visual Turn)
      const matchesPerTurn = 2;
      schedule.forEach((match, index) => {
          match.displayTurn = Math.floor(index / matchesPerTurn) + 1;
          match.court = ((index % matchesPerTurn) + 1) as 1 | 2;
      });

      const dateObj = new Date(setupDate);
      const finalDate = dateObj.toISOString();

      const newState: TournamentState = {
          isActive: true,
          teams: manualTeams,
          schedule: schedule,
          tournamentDate: finalDate
      };

      // Notify parent to sync
      onUpdateTournament(newState);
  };

  const backToSetup = () => {
      // Just visually switch, don't clear data yet unless they hit Cancel
      setActiveTab('setup');
  };

  const endTournament = () => {
      if (confirm("Xác nhận KẾT THÚC giải đấu này?\n\n- Các kết quả đã ghi sẽ được lưu lại trong Lịch Sử.\n- Trạng thái giải đấu hiện tại sẽ được xóa để bạn có thể tạo giải mới.")) {
          setManualTeams([]);
          onUpdateTournament(null); // Clear state in parent/cloud
      }
  };

  // --- PLAY ACTIONS ---
  const updateScore = (matchId: string, team: 1 | 2, value: string) => {
      if (!tournamentData) return;
      const val = value === '' ? '' : parseInt(value);
      
      const newSchedule = (tournamentData.schedule || []).map(m => {
          if (m.id === matchId) {
              return { ...m, [team === 1 ? 'score1' : 'score2']: val };
          }
          return m;
      });
      // Notify parent to sync partial score updates
      onUpdateTournament({ ...tournamentData, schedule: newSchedule });
  };

  // --- EDIT MODE ACTIONS ---
  const handleMatchSwap = (targetMatchId: string) => {
      if (!tournamentData) return;

      if (!swapMatchId) {
          // Select source
          setSwapMatchId(targetMatchId);
      } else {
          if (swapMatchId === targetMatchId) {
              // Deselect
              setSwapMatchId(null);
              return;
          }

          // Perform Swap
          const currentSchedule = tournamentData.schedule || [];
          const sourceIdx = currentSchedule.findIndex(m => m.id === swapMatchId);
          const targetIdx = currentSchedule.findIndex(m => m.id === targetMatchId);

          if (sourceIdx !== -1 && targetIdx !== -1) {
              const newSchedule = [...currentSchedule];
              
              // Swap properties: displayTurn and court. 
              // This effectively swaps their "Slot" in the UI.
              const sourceTurn = newSchedule[sourceIdx].displayTurn;
              const sourceCourt = newSchedule[sourceIdx].court;
              
              const targetTurn = newSchedule[targetIdx].displayTurn;
              const targetCourt = newSchedule[targetIdx].court;

              newSchedule[sourceIdx] = {
                  ...newSchedule[sourceIdx],
                  displayTurn: targetTurn,
                  court: targetCourt
              };

              newSchedule[targetIdx] = {
                  ...newSchedule[targetIdx],
                  displayTurn: sourceTurn,
                  court: sourceCourt
              };

              // Optimistic update locally first
              onUpdateTournament({ ...tournamentData, schedule: newSchedule });
          }
          setSwapMatchId(null);
      }
  };

  const handleSyncSchedule = () => {
      // Trigger a sync by re-sending current state
      if (tournamentData) {
          onUpdateTournament({ ...tournamentData });
          alert("Đã gửi lệnh đồng bộ lịch thi đấu lên hệ thống!");
          setIsEditMode(false);
      }
  };

  const saveMatchResult = (match: TournamentMatch) => {
      if (match.score1 === '' || match.score2 === '') return;
      
      const t1 = (tournamentData?.teams || []).find(t => t.id === match.team1Id);
      const t2 = (tournamentData?.teams || []).find(t => t.id === match.team2Id);
      if (!t1 || !t2 || !t1.player1 || !t1.player2 || !t2.player1 || !t2.player2) return;

      const s1 = Number(match.score1);
      const s2 = Number(match.score2);
      if (s1 === s2) { alert("Không được hòa."); return; }

      const matchPayload = {
          id: match.matchId,
          type: 'tournament' as const,
          date: tournamentData?.tournamentDate || new Date().toISOString(),
          team1: [t1.player1.id, t1.player2.id],
          team2: [t2.player1.id, t2.player2.id],
          score1: s1,
          score2: s2,
          winner: s1 > s2 ? 1 : 2 as 1 | 2,
          rankingPoints: 0 
      };

      // Save to history
      onSaveMatches([matchPayload]);

      // Mark as completed in tournament state and sync
      const newSchedule = (tournamentData!.schedule || []).map(m => 
          m.id === match.id ? { ...m, isCompleted: true } : m
      );
      onUpdateTournament({ ...tournamentData!, schedule: newSchedule });
  };

  // --- STANDINGS CALCULATION ---
  const liveStandings = useMemo(() => {
      if (!tournamentData) return [];
      
      const tempMatches: Match[] = (tournamentData.schedule || [])
        .filter(m => m.isCompleted && m.score1 !== '' && m.score2 !== '')
        .map(m => {
            const t1 = (tournamentData.teams || []).find(t => t.id === m.team1Id);
            const t2 = (tournamentData.teams || []).find(t => t.id === m.team2Id);
            return {
                id: m.id,
                type: 'tournament',
                date: tournamentData.tournamentDate,
                team1: [t1?.player1?.id || '', t1?.player2?.id || ''],
                team2: [t2?.player1?.id || '', t2?.player2?.id || ''],
                score1: Number(m.score1),
                score2: Number(m.score2),
                winner: Number(m.score1) > Number(m.score2) ? 1 : 2
            } as Match;
        });
        
      return getTournamentStandings(tournamentData.tournamentDate.slice(0, 7), players, tempMatches);
  }, [tournamentData, players]);

  // --- SCROLL HELPERS ---
  const scrollTeams = (direction: 'up' | 'down') => {
      if (teamListRef.current) {
          const scrollAmount = 200;
          teamListRef.current.scrollBy({
              top: direction === 'down' ? scrollAmount : -scrollAmount,
              behavior: 'smooth'
          });
      }
  };


  // --- RENDER ---
  
  if (activeTab === 'setup') {
      const playersInTeams = new Set(manualTeams.flatMap(t => [t.player1?.id, t.player2?.id]));
      const availablePlayers = sortedPlayers.filter(p => !playersInTeams.has(String(p.id)));

      // Select All Logic
      const isAllSelected = availablePlayers.length > 0 && availablePlayers.every(p => selectedPlayerIds.includes(String(p.id)));
      const handleSelectAll = () => {
          if (isAllSelected) {
              setSelectedPlayerIds([]);
          } else {
              setSelectedPlayerIds(availablePlayers.map(p => String(p.id)));
          }
      };

      return (
          <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200 gap-4">
                  <div className="space-y-1">
                      <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center gap-2">
                          <Swords className="w-6 h-6 text-pickle-600" /> Thiết Lập Giải Đấu
                      </h2>
                      <div className="flex items-center gap-2">
                          <label className="text-sm font-bold text-slate-500 flex items-center gap-1">
                              <Clock className="w-4 h-4" /> Thời gian:
                          </label>
                          <input 
                              type="datetime-local" 
                              value={setupDate}
                              onChange={(e) => setSetupDate(e.target.value)}
                              className="text-sm font-bold text-slate-800 border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-pickle-500 outline-none bg-slate-50 cursor-pointer"
                          />
                      </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <button 
                            onClick={createSmartTeams}
                            disabled={selectedPlayerIds.length < 2}
                            className="px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-md flex items-center justify-center gap-2 transition-all"
                            title="Tự động ghép Top Rating với Low Rating và tránh cặp trùng lặp"
                        >
                            <Sparkles className="w-4 h-4 text-yellow-300" />
                            Ghép Cân Bằng ({selectedPlayerIds.length})
                        </button>
                        <button 
                            onClick={generateSchedule}
                            className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2 transition-all hover:scale-105"
                        >
                            <Play className="w-4 h-4" /> Bắt Đầu
                        </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* LEFT: Player Pool */}
                  <Card 
                    className="h-[500px] flex flex-col"
                    classNameTitle="flex items-center justify-between"
                    title={
                        <div className="flex items-center justify-between w-full">
                            <span>Kho Vận Động Viên ({availablePlayers.length})</span>
                            <button 
                                onClick={handleSelectAll}
                                className="text-xs font-bold text-pickle-600 bg-pickle-50 px-2 py-1 rounded flex items-center gap-1 hover:bg-pickle-100 transition-colors"
                            >
                                {isAllSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                {isAllSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
                            </button>
                        </div>
                    }
                  >
                      {/* Title is handled in Card prop above */}
                      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
                          {availablePlayers.map(p => (
                              <div 
                                  key={p.id}
                                  onClick={() => togglePlayerSelection(String(p.id))}
                                  className={`p-2 border rounded-lg cursor-pointer transition-all flex items-center gap-2 relative ${selectedPlayerIds.includes(String(p.id)) ? 'bg-pickle-50 border-pickle-500 shadow-sm' : 'bg-white border-slate-200 hover:border-pickle-300'}`}
                              >
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${selectedPlayerIds.includes(String(p.id)) ? 'bg-pickle-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                      {p.name.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="truncate text-sm font-medium text-slate-900">{p.name}</div>
                                      <div className="text-[10px] text-slate-400">Rate: {(p.tournamentRating || p.initialPoints || 0).toFixed(1)}</div>
                                  </div>
                                  {selectedPlayerIds.includes(String(p.id)) && <div className="absolute top-1 right-1 w-2 h-2 bg-pickle-500 rounded-full"></div>}
                              </div>
                          ))}
                      </div>
                  </Card>

                  {/* RIGHT: Teams List */}
                  <Card 
                    title={
                        <div className="flex justify-between items-center w-full">
                            <span>Danh Sách Đội ({manualTeams.length})</span>
                            <div className="flex gap-1">
                                <button onClick={() => scrollTeams('up')} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="Cuộn lên"><ChevronUp className="w-4 h-4" /></button>
                                <button onClick={() => scrollTeams('down')} className="p-1 hover:bg-slate-100 rounded text-slate-500" title="Cuộn xuống"><ChevronDown className="w-4 h-4" /></button>
                            </div>
                        </div>
                    } 
                    classNameTitle="flex items-center justify-between"
                    className="h-[500px] flex flex-col"
                  >
                      {swapSource && (
                          <div className="bg-orange-50 text-orange-800 px-3 py-2 text-xs font-bold border-b border-orange-100 flex items-center gap-2 animate-pulse">
                              <ArrowRightLeft className="w-3 h-3" />
                              Đang chọn: {getPlayer(manualTeams.find(t => t.id === swapSource.teamId)?.[swapSource.role]?.id || '')?.name}. Chọn người thứ 2 để đổi.
                          </div>
                      )}
                      
                      <div ref={teamListRef} className="flex-1 overflow-y-auto p-2 grid grid-cols-1 xl:grid-cols-2 gap-2 content-start scroll-smooth">
                          {manualTeams.length === 0 && (
                              <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-400 text-center p-8">
                                  <Users className="w-12 h-12 mb-2 opacity-20" />
                                  <p>Chưa có đội nào.</p>
                                  <p className="text-xs">Chọn người chơi bên trái và bấm "Ghép Cân Bằng".</p>
                              </div>
                          )}
                          {manualTeams.map((team, idx) => (
                              <div key={team.id} className="relative flex items-center p-2 bg-white rounded-lg border border-slate-200 shadow-sm group hover:border-pickle-400 transition-all">
                                  {/* Rank/Index */}
                                  <div className="absolute top-0 left-0 w-6 h-6 flex items-center justify-center bg-slate-100 text-[10px] font-bold text-slate-500 rounded-br-lg rounded-tl-lg z-10 border-b border-r border-slate-200">
                                      {idx + 1}
                                  </div>

                                  {/* Delete Button (Absolute Right Top) */}
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); removeTeam(team.id); }}
                                      className="absolute top-1 right-1 text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                      title="Xóa đội"
                                  >
                                      <Trash2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Content Container - Flex Row for Players */}
                                  <div className="flex items-center w-full pl-6 pr-4 py-1 gap-2">
                                      
                                      {/* Player 1 */}
                                      <div 
                                          onClick={() => handleSwapClick(team.id, 'player1')}
                                          className={`flex-1 flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors border border-transparent ${
                                              swapSource?.teamId === team.id && swapSource?.role === 'player1' 
                                              ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200' 
                                              : 'hover:bg-slate-50 hover:border-slate-100'
                                          }`}
                                      >
                                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black border border-blue-200 shrink-0">
                                              {team.player1?.name.charAt(0)}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                              <div className="text-xs font-bold text-slate-700 truncate leading-tight">{team.player1?.name}</div>
                                              <div className="text-[9px] text-slate-400 font-mono">{(team.player1?.tournamentRating||0).toFixed(1)}</div>
                                          </div>
                                      </div>

                                      {/* Divider / VS / Link */}
                                      <div className="text-slate-300 text-[10px] font-light">
                                          <ArrowRightLeft className="w-3 h-3" />
                                      </div>

                                      {/* Player 2 */}
                                      <div 
                                          onClick={() => handleSwapClick(team.id, 'player2')}
                                          className={`flex-1 flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors border border-transparent ${
                                              swapSource?.teamId === team.id && swapSource?.role === 'player2' 
                                              ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-200' 
                                              : 'hover:bg-slate-50 hover:border-slate-100'
                                          }`}
                                      >
                                          <div className="min-w-0 flex-1 text-right">
                                              <div className="text-xs font-bold text-slate-700 truncate leading-tight">{team.player2?.name}</div>
                                              <div className="text-[9px] text-slate-400 font-mono">{(team.player2?.tournamentRating||0).toFixed(1)}</div>
                                          </div>
                                          <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-black border border-green-200 shrink-0">
                                              {team.player2?.name.charAt(0)}
                                          </div>
                                      </div>

                                  </div>

                                  {/* Team Rating Badge (Absolute Bottom Center) */}
                                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-sm text-[9px] font-bold text-slate-500 font-mono flex items-center gap-1 z-10">
                                     <span className="text-slate-300">∑</span> {((team.player1?.tournamentRating||0) + (team.player2?.tournamentRating||0)).toFixed(1)}
                                  </div>
                              </div>
                          ))}
                      </div>
                      <div className="p-2 text-[10px] text-slate-400 text-center italic border-t border-slate-100 mt-auto">
                          * Click vào avatar để đổi người chơi giữa các đội
                      </div>
                  </Card>
              </div>
          </div>
      );
  }

  // --- ACTIVE PLAY MODE ---
  if (!tournamentData) return null;

  const getTeamName = (teamId: string) => {
      const t = (tournamentData.teams || []).find(x => x.id === teamId);
      return t ? t.name : '???';
  };

  const formattedDate = new Date(tournamentData.tournamentDate).toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });

  // Group matches by Display Turn
  const turns = new Map<number, TournamentMatch[]>();
  (tournamentData.schedule || []).forEach(m => {
      const turn = m.displayTurn || 1;
      if (!turns.has(turn)) turns.set(turn, []);
      turns.get(turn)!.push(m);
  });
  const sortedTurns = Array.from(turns.keys()).sort((a,b) => a - b);

  return (
      <div className="space-y-6 animate-fade-in">
          {/* Header Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg text-yellow-700">
                      <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                      <h2 className="text-lg font-black uppercase text-slate-800 leading-tight">Giải Đấu Tháng {tournamentData.tournamentDate.slice(5,7)}</h2>
                      <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-slate-500 font-bold flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {formattedDate}
                          </p>
                          {/* Countdown Timer Component */}
                          <div className="ml-2 pl-2 border-l border-slate-200">
                              <CountdownTimer targetDate={tournamentData.tournamentDate} />
                          </div>
                      </div>
                  </div>
              </div>
              
              <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
                  {/* PUBLISH BUTTON (Moved here from Edit Banner) */}
                  <button 
                      onClick={handleSyncSchedule}
                      className="flex-1 md:flex-none px-4 py-2 text-sm font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-md active:scale-95 whitespace-nowrap"
                  >
                      <UploadCloud className="w-4 h-4" /> Công Bố Lịch
                  </button>

                  <button 
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-colors border whitespace-nowrap ${
                          isEditMode 
                          ? 'bg-yellow-100 text-yellow-800 border-yellow-300 shadow-sm' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                      {isEditMode ? <CheckCircle2 className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                      {isEditMode ? 'Xong' : 'Sắp xếp lịch'}
                  </button>
                  
                  {!isEditMode && (
                      <button 
                          onClick={backToSetup}
                          className="flex-1 md:flex-none px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-200 whitespace-nowrap"
                      >
                          <ArrowLeft className="w-4 h-4" /> Thiết Lập
                      </button>
                  )}
                  
                  {!isEditMode && (
                      <button 
                          onClick={endTournament}
                          className="flex-1 md:flex-none px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center gap-2 transition-colors border border-red-100 shadow-sm whitespace-nowrap"
                      >
                          <Flag className="w-4 h-4" /> Kết Thúc
                      </button>
                  )}
              </div>
          </div>

          {/* EDIT MODE BANNER */}
          {isEditMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-100 rounded-full text-yellow-600 animate-pulse">
                          <ArrowRightLeft className="w-6 h-6" />
                      </div>
                      <div>
                          <h3 className="font-bold text-yellow-900">Chế độ Sắp Xếp Lịch Thi Đấu</h3>
                          <p className="text-xs text-yellow-700">Chọn 2 trận đấu để đổi chỗ cho nhau (Thay đổi lượt đấu/sân).</p>
                      </div>
                  </div>
              </div>
          )}

          {/* LEADERBOARD (Live) - Hidden in Edit Mode to focus on schedule */}
          {!isEditMode && (
              <Card className="overflow-hidden" title="Bảng Xếp Hạng Trực Tuyến">
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                              <tr>
                                  <th className="px-4 py-3 text-center">#</th>
                                  <th className="px-4 py-3">Đội</th>
                                  <th className="px-4 py-3 text-center">Trận</th>
                                  <th className="px-4 py-3 text-center">Thắng/Thua</th>
                                  <th className="px-4 py-3 text-right">Hiệu Số</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {liveStandings.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-3 text-center font-bold text-slate-400">
                                          {idx < 3 ? <Trophy className={`w-4 h-4 mx-auto ${idx===0?'text-yellow-500':idx===1?'text-slate-400':'text-orange-600'}`} /> : idx + 1}
                                      </td>
                                      <td className="px-4 py-3 font-bold text-slate-800">
                                          {row.playerIds.map(id => getPlayer(id)?.name).join(' & ')}
                                      </td>
                                      <td className="px-4 py-3 text-center">{row.wins + row.losses}</td>
                                      <td className="px-4 py-3 text-center">
                                          <span className="text-green-600 font-bold">{row.wins}</span> - <span className="text-red-500 font-bold">{row.losses}</span>
                                      </td>
                                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-600">
                                          {row.pointsScored - row.pointsConceded > 0 ? '+' : ''}{row.pointsScored - row.pointsConceded}
                                      </td>
                                  </tr>
                              ))}
                              {liveStandings.length === 0 && (
                                  <tr>
                                      <td colSpan={5} className="text-center py-4 text-slate-400 italic">Chưa có trận đấu nào hoàn thành.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </Card>
          )}

          {/* SCHEDULE BY TURNS */}
          <div className="space-y-6">
              {sortedTurns.map(turn => (
                  <div key={turn}>
                      <div className="flex items-center gap-4 mb-3">
                          <div className="h-px bg-slate-200 flex-1"></div>
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full flex items-center gap-2">
                              <Hourglass className="w-3 h-3" /> Lượt Thi Đấu {turn}
                          </span>
                          <div className="h-px bg-slate-200 flex-1"></div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {turns.get(turn)!.map((match) => (
                              <div 
                                key={match.id} 
                                onClick={() => isEditMode ? handleMatchSwap(match.id) : undefined}
                                className={`bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden transition-all 
                                    ${match.isCompleted ? 'border-green-200 bg-green-50/20' : 'border-slate-300'}
                                    ${isEditMode ? 'cursor-pointer hover:shadow-md' : ''}
                                    ${swapMatchId === match.id ? 'ring-2 ring-yellow-400 bg-yellow-50 scale-[1.02]' : ''}
                                `}
                              >
                                  {/* Court Badge */}
                                  <div className="absolute top-0 left-0 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-br-lg z-10">
                                      Sân {match.court}
                                  </div>

                                  {isEditMode && swapMatchId && swapMatchId !== match.id && (
                                      <div className="absolute inset-0 bg-yellow-100/20 z-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                          <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
                                              <ArrowRightLeft className="w-4 h-4" /> Đổi vào đây
                                          </div>
                                      </div>
                                  )}

                                  <div className="mt-4 flex justify-between items-center gap-2">
                                      {/* Team 1 */}
                                      <div className="flex-1 text-center relative">
                                          <div className="font-bold text-sm text-slate-800 leading-tight mb-2 h-8 flex items-center justify-center">{getTeamName(match.team1Id)}</div>
                                          {!isEditMode && (
                                              <input 
                                                  type="number" 
                                                  placeholder="-"
                                                  value={match.score1}
                                                  disabled={match.isCompleted}
                                                  onChange={(e) => updateScore(match.id, 1, e.target.value)}
                                                  className={`w-16 h-12 text-center font-black text-2xl border-2 rounded-lg focus:ring-4 focus:ring-pickle-200 outline-none shadow-inner transition-colors ${
                                                      match.isCompleted 
                                                      ? 'bg-transparent border-transparent text-slate-800' 
                                                      : 'bg-white border-slate-300 text-slate-900 focus:border-pickle-500'
                                                  }`}
                                              />
                                          )}
                                      </div>

                                      <div className="text-slate-300 font-black text-2xl pt-6">:</div>

                                      {/* Team 2 */}
                                      <div className="flex-1 text-center relative">
                                          <div className="font-bold text-sm text-slate-800 leading-tight mb-2 h-8 flex items-center justify-center">{getTeamName(match.team2Id)}</div>
                                          {!isEditMode && (
                                              <input 
                                                  type="number" 
                                                  placeholder="-"
                                                  value={match.score2}
                                                  disabled={match.isCompleted}
                                                  onChange={(e) => updateScore(match.id, 2, e.target.value)}
                                                  className={`w-16 h-12 text-center font-black text-2xl border-2 rounded-lg focus:ring-4 focus:ring-pickle-200 outline-none shadow-inner transition-colors ${
                                                      match.isCompleted 
                                                      ? 'bg-transparent border-transparent text-slate-800' 
                                                      : 'bg-white border-slate-300 text-slate-900 focus:border-pickle-500'
                                                  }`}
                                              />
                                          )}
                                      </div>
                                  </div>

                                  {/* Action Button (Hidden in Edit Mode) */}
                                  {!isEditMode && !match.isCompleted && (
                                      <button 
                                          onClick={() => saveMatchResult(match)}
                                          disabled={match.score1 === '' || match.score2 === ''}
                                          className="w-full mt-4 py-3 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]"
                                      >
                                          <Save className="w-3 h-3" /> Xác Nhận Kết Quả
                                      </button>
                                  )}
                                  
                                  {isEditMode && (
                                      <div className="mt-4 py-2 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded border border-slate-100 flex items-center justify-center gap-1">
                                          <ArrowRightLeft className="w-3 h-3" /> Bấm để chọn đổi
                                      </div>
                                  )}

                                  {!isEditMode && match.isCompleted && (
                                      <div className="mt-3 text-center text-xs font-bold text-green-600 flex items-center justify-center gap-1 py-2 bg-green-100/50 rounded-lg">
                                          <Shield className="w-3 h-3" /> Đã hoàn thành
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );
};

// --- TEAM MATCH MANAGER (New Feature) ---
const TeamMatchManager: React.FC<TournamentManagerProps> = ({
    players,
    tournamentData,
    onUpdateTournament,
    onSaveMatches
}) => {
    const [step, setStep] = useState<'setup' | 'teams' | 'schedule' | 'play'>('setup');
    
    // Setup State
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [numTeams, setNumTeams] = useState(2);
    const [showAllPlayers, setShowAllPlayers] = useState(false);
    
    // Teams State
    const [groups, setGroups] = useState<TeamGroup[]>([]);
    const [swapSource, setSwapSource] = useState<{ groupId: string, playerId: string } | null>(null);
    
    // Schedule State
    const [numMatches, setNumMatches] = useState(10);
    const [schedule, setSchedule] = useState<TeamMatchScheduleItem[]>([]);
    
    // Play State
    // const [activeTab, setActiveTab] = useState<'matches' | 'standings'>('matches'); // Unused for now

    // Sync from props
    useEffect(() => {
        if (tournamentData?.isActive && tournamentData.mode === 'team-match') {
            if (step === 'setup') {
                setStep('play');
            }
            setGroups(tournamentData.groups || []);
            setSchedule(tournamentData.groupSchedule || []);
        } else if (!tournamentData?.isActive) {
            setStep('setup');
            // Clear local state when tournament ends or is inactive
            setGroups([]);
            setSchedule([]);
            setSelectedPlayerIds([]);
        }
    }, [tournamentData]);

    const activePlayers = useMemo(() => {
        let list = players;
        if (!showAllPlayers) {
            list = list.filter(p => p.isActive !== false);
        }
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [players, showAllPlayers]);

    // --- ACTIONS ---

    const handleSwapPlayer = (targetGroupId: string, targetPlayerId: string) => {
        if (!swapSource) {
            setSwapSource({ groupId: targetGroupId, playerId: targetPlayerId });
            return;
        }

        // Perform Swap
        const newGroups = [...groups];
        const sourceGroup = newGroups.find(g => g.id === swapSource.groupId);
        const targetGroup = newGroups.find(g => g.id === targetGroupId);

        if (sourceGroup && targetGroup) {
            const sourcePlayerIdx = sourceGroup.players.findIndex(p => String(p.id) === swapSource.playerId);
            const targetPlayerIdx = targetGroup.players.findIndex(p => String(p.id) === targetPlayerId);

            if (sourcePlayerIdx !== -1 && targetPlayerIdx !== -1) {
                const temp = sourceGroup.players[sourcePlayerIdx];
                sourceGroup.players[sourcePlayerIdx] = targetGroup.players[targetPlayerIdx];
                targetGroup.players[targetPlayerIdx] = temp;
                setGroups(newGroups);
            }
        }
        setSwapSource(null);
    };

    const handleSplitTeams = () => {
        if (selectedPlayerIds.length < numTeams) {
            alert("Số lượng người chơi phải lớn hơn số đội!");
            return;
        }

        const pool = selectedPlayerIds.map(id => players.find(p => String(p.id) === id)!).sort((a, b) => (b.tournamentRating || 3.0) - (a.tournamentRating || 3.0));
        
        const newGroups: TeamGroup[] = Array.from({ length: numTeams }, (_, i) => ({
            id: `group_${Date.now()}_${i}`,
            name: `Team ${i + 1}`,
            players: []
        }));

        // Snake Draft Distribution for Balance
        pool.forEach((p, idx) => {
            const round = Math.floor(idx / numTeams);
            const isEvenRound = round % 2 === 0;
            const teamIdx = isEvenRound ? (idx % numTeams) : (numTeams - 1 - (idx % numTeams));
            newGroups[teamIdx].players.push(p);
        });

        setGroups(newGroups);
        setStep('teams');
    };

    const handleGenerateSchedule = () => {
        if (groups.length < 2) return;
        
        // Clear previous schedule to ensure fresh generation
        setSchedule([]);

        // Simplified for 2 teams for now, as per request "chia 2 team"
        // If more teams, we can rotate pairs.
        
        const g1 = groups[0];
        const g2 = groups[1];
        
        // Generate all possible pairs for each group
        const getPairs = (groupPlayers: Player[]) => {
            const pairs: [Player, Player][] = [];
            for (let i = 0; i < groupPlayers.length; i++) {
                for (let j = i + 1; j < groupPlayers.length; j++) {
                    pairs.push([groupPlayers[i], groupPlayers[j]]);
                }
            }
            return pairs;
        };

        const pairs1 = getPairs(g1.players);
        const pairs2 = getPairs(g2.players);

        const possibleMatchups: { p1: [Player, Player], p2: [Player, Player], diff: number, score: number }[] = [];

        pairs1.forEach(p1 => {
            pairs2.forEach(p2 => {
                const r1 = (p1[0].tournamentRating || 3.0) + (p1[1].tournamentRating || 3.0);
                const r2 = (p2[0].tournamentRating || 3.0) + (p2[1].tournamentRating || 3.0);
                const diff = Math.abs(r1 - r2);
                possibleMatchups.push({ p1, p2, diff, score: diff });
            });
        });

        // Sort by balance (diff)
        possibleMatchups.sort((a, b) => a.diff - b.diff);

        // Select best N matches with diversity penalty
        const selectedMatches: TeamMatchScheduleItem[] = [];
        const playerUsage = new Map<string, number>();
        
        const getUsage = (p: Player) => playerUsage.get(String(p.id)) || 0;
        const incUsage = (p: Player) => playerUsage.set(String(p.id), getUsage(p) + 1);

        for (let i = 0; i < numMatches; i++) {
            // Re-score based on usage to ensure equal play time
            possibleMatchups.forEach(m => {
                const u1 = getUsage(m.p1[0]);
                const u2 = getUsage(m.p1[1]);
                const u3 = getUsage(m.p2[0]);
                const u4 = getUsage(m.p2[1]);

                // Priority 1: Minimize the maximum usage of any player in the match.
                // This ensures we don't pick a match involving a player who has already played a lot,
                // allowing others to catch up.
                const maxUsage = Math.max(u1, u2, u3, u4);

                // Priority 2: Minimize total usage (prefer matches where players have played less overall)
                const totalUsage = u1 + u2 + u3 + u4;

                // Priority 3: Rating balance (diff)
                
                // Weighting:
                // Max Usage: Huge penalty (10000)
                // Total Usage: Medium penalty (100)
                // Rating Diff: Small penalty (1)
                m.score = (maxUsage * 10000) + (totalUsage * 100) + m.diff;
            });
            
            possibleMatchups.sort((a, b) => a.score - b.score);
            
            if (possibleMatchups.length === 0) break;

            const best = possibleMatchups.shift()!; // Remove selected
            
            // Add to schedule
            selectedMatches.push({
                id: `tm_${Date.now()}_${i}`,
                group1Id: g1.id,
                group2Id: g2.id,
                pair1: best.p1,
                pair2: best.p2,
                score1: '',
                score2: '',
                isCompleted: false
            });

            // Update usage
            incUsage(best.p1[0]); incUsage(best.p1[1]);
            incUsage(best.p2[0]); incUsage(best.p2[1]);
        }

        setSchedule(selectedMatches);
        setStep('schedule');
    };

    const handleStartTournament = () => {
        const newState: TournamentState = {
            isActive: true,
            mode: 'team-match',
            tournamentDate: new Date().toISOString(),
            groups: groups,
            groupSchedule: schedule
        };
        onUpdateTournament(newState);
        setStep('play');
    };

    const handleUpdateScore = (matchId: string, team: 1 | 2, val: string) => {
        const newSchedule = schedule.map(m => {
            if (m.id === matchId) {
                return { ...m, [team === 1 ? 'score1' : 'score2']: val === '' ? '' : Number(val) };
            }
            return m;
        });
        setSchedule(newSchedule);
        
        // If active, sync
        if (step === 'play' && tournamentData) {
            onUpdateTournament({ ...tournamentData, groupSchedule: newSchedule });
        }
    };

    const handleSaveMatch = (match: TeamMatchScheduleItem) => {
        if (match.score1 === '' || match.score2 === '') return;
        
        const s1 = Number(match.score1);
        const s2 = Number(match.score2);
        
        const payload = {
            id: match.matchId, // Might be undefined, will be generated
            type: 'tournament' as const,
            date: tournamentData?.tournamentDate || new Date().toISOString(),
            team1: [String(match.pair1[0].id), String(match.pair1[1].id)],
            team2: [String(match.pair2[0].id), String(match.pair2[1].id)],
            score1: s1,
            score2: s2,
            winner: s1 > s2 ? 1 : 2 as 1 | 2,
            rankingPoints: 0
        };

        onSaveMatches([payload]);

        const newSchedule = schedule.map(m => 
            m.id === match.id ? { ...m, isCompleted: true } : m
        );
        setSchedule(newSchedule);
        if (step === 'play' && tournamentData) {
            onUpdateTournament({ ...tournamentData, groupSchedule: newSchedule });
        }
    };

    const handleEndTournament = () => {
        if (confirm("Kết thúc giải đấu?")) {
            onUpdateTournament(null);
        }
    };

    // --- RENDER HELPERS ---
    const getGroupRating = (g: TeamGroup) => {
        if (g.players.length === 0) return 0;
        const sum = g.players.reduce((s, p) => s + (p.tournamentRating || 3.0), 0);
        return sum / g.players.length;
    };

    if (step === 'setup') {
        const isAllSelected = activePlayers.every(p => selectedPlayerIds.includes(String(p.id)));
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-600" /> CHỌN NGƯỜI CHƠI & CHIA ĐỘI
                    </h2>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-bold text-slate-600">Số đội:</label>
                            <input 
                                type="number" min={2} max={4} 
                                value={numTeams} onChange={e => setNumTeams(Number(e.target.value))}
                                className="w-16 p-2 border rounded font-bold text-center"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="showAllPlayers"
                                checked={showAllPlayers}
                                onChange={e => setShowAllPlayers(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="showAllPlayers" className="text-xs font-bold text-slate-500 cursor-pointer select-none">
                                Hiện cả người ẩn
                            </label>
                        </div>
                        <button 
                            onClick={handleSplitTeams}
                            disabled={selectedPlayerIds.length < numTeams}
                            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 ml-auto"
                        >
                            Chia Đội Ngay
                        </button>
                    </div>
                </div>

                <Card title={
                    <div className="flex justify-between items-center">
                        <span>Danh Sách ({activePlayers.length})</span>
                        <button onClick={() => setSelectedPlayerIds(isAllSelected ? [] : activePlayers.map(p => String(p.id)))} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                            {isAllSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
                        </button>
                    </div>
                }>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 max-h-[400px] overflow-y-auto">
                        {activePlayers.map(p => (
                            <div 
                                key={p.id}
                                onClick={() => setSelectedPlayerIds(prev => prev.includes(String(p.id)) ? prev.filter(id => id !== String(p.id)) : [...prev, String(p.id)])}
                                className={`p-2 border rounded cursor-pointer flex items-center gap-2 ${selectedPlayerIds.includes(String(p.id)) ? 'bg-indigo-50 border-indigo-500' : 'hover:bg-slate-50'}`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedPlayerIds.includes(String(p.id)) ? 'bg-indigo-500 text-white' : 'bg-slate-200'}`}>
                                    {p.name.charAt(0)}
                                </div>
                                <div className="truncate text-xs font-bold">{p.name}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        );
    }

    if (step === 'teams') {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Back Button */}
                <button 
                    onClick={() => setStep('setup')} 
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors group"
                >
                    <div className="p-2 bg-white rounded-full shadow-sm border border-slate-200 group-hover:border-slate-300 group-hover:shadow-md transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm uppercase tracking-wide">Quay lại chọn người</span>
                </button>

                <div className="flex justify-end items-center bg-white p-4 rounded-xl shadow-sm">
                    <button onClick={handleGenerateSchedule} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                        Tiếp Tục: Xếp Lịch <Play className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groups.map((g) => (
                        <Card key={g.id} title={
                            <div className="flex justify-between">
                                <span>{g.name}</span>
                                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">Ø Rating: {getGroupRating(g).toFixed(2)}</span>
                            </div>
                        }>
                            <div className="p-2 space-y-1">
                                {g.players.map(p => (
                                    <div 
                                        key={p.id} 
                                        onClick={() => handleSwapPlayer(g.id, String(p.id))}
                                        className={`flex justify-between text-sm p-2 border-b last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${
                                            swapSource?.playerId === String(p.id) ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-300' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {swapSource?.playerId === String(p.id) && <ArrowRightLeft className="w-3 h-3 text-orange-500 animate-pulse" />}
                                            <span>{p.name}</span>
                                        </div>
                                        <span className="font-mono text-slate-400">{(p.tournamentRating||3.0).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            {swapSource && swapSource.groupId !== g.id && (
                                <div className="p-2 bg-yellow-50 text-center text-xs text-yellow-700 font-bold border-t border-yellow-100 animate-pulse">
                                    Bấm vào người chơi để đổi
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
                <div className="text-center text-xs text-slate-400 italic mt-4">
                    * Bấm vào tên người chơi để đổi chỗ giữa các đội
                </div>
            </div>
        );
    }

    if (step === 'schedule') {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Back Button */}
                <button 
                    onClick={() => setStep('teams')} 
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors group"
                >
                    <div className="p-2 bg-white rounded-full shadow-sm border border-slate-200 group-hover:border-slate-300 group-hover:shadow-md transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-sm uppercase tracking-wide">Quay lại chia đội</span>
                </button>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-black text-slate-800">XẾP LỊCH THI ĐẤU</h2>
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-bold text-slate-600">Số trận muốn tạo:</label>
                            <input 
                                type="number" min={1} max={50} 
                                value={numMatches} onChange={e => setNumMatches(Number(e.target.value))}
                                className="w-20 p-2 border rounded font-bold text-center"
                            />
                        </div>
                        <button 
                            onClick={handleGenerateSchedule}
                            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                        >
                            Tạo Lịch Đấu
                        </button>
                    </div>
                </div>

                {schedule.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Dự kiến: {schedule.length} trận</h3>
                            <button onClick={handleStartTournament} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md animate-bounce">
                                BẮT ĐẦU GIẢI ĐẤU
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {schedule.map((m, idx) => (
                                <div key={m.id} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                                    <div className="text-xs font-bold text-slate-400 w-6">#{idx+1}</div>
                                    <div className="flex-1 text-right pr-2">
                                        <div className="text-sm font-bold text-indigo-700">{m.pair1[0].name} & {m.pair1[1].name}</div>
                                        <div className="text-[10px] text-slate-400">{(m.pair1[0].tournamentRating||3)+(m.pair1[1].tournamentRating||3)}</div>
                                    </div>
                                    <div className="px-2 text-slate-300 font-bold">VS</div>
                                    <div className="flex-1 pl-2">
                                        <div className="text-sm font-bold text-orange-700">{m.pair2[0].name} & {m.pair2[1].name}</div>
                                        <div className="text-[10px] text-slate-400">{(m.pair2[0].tournamentRating||3)+(m.pair2[1].tournamentRating||3)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // PLAY MODE
    const g1 = groups[0];
    const g2 = groups[1];
    
    // Calculate Score
    let score1 = 0, score2 = 0;
    schedule.forEach(m => {
        if (m.isCompleted) {
            if (Number(m.score1) > Number(m.score2)) score1++;
            else if (Number(m.score2) > Number(m.score1)) score2++;
        }
    });

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Back Button */}
            <button 
                onClick={() => setStep('schedule')} 
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors group"
            >
                <div className="p-2 bg-white rounded-full shadow-sm border border-slate-200 group-hover:border-slate-300 group-hover:shadow-md transition-all">
                    <ArrowLeft className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm uppercase tracking-wide">Quay lại lịch đấu</span>
            </button>

            {/* Header / Scoreboard */}
            <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg flex justify-between items-center">
                <div className="text-center flex-1">
                    <h2 className="text-2xl font-black text-indigo-400">{g1?.name}</h2>
                    <div className="text-5xl font-black mt-2">{score1}</div>
                </div>
                <div className="text-slate-500 font-black text-2xl">VS</div>
                <div className="text-center flex-1">
                    <h2 className="text-2xl font-black text-orange-400">{g2?.name}</h2>
                    <div className="text-5xl font-black mt-2">{score2}</div>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                     {/* Save Button for Manual Sync */}
                    <button 
                        onClick={() => onUpdateTournament({ ...tournamentData, groupSchedule: schedule })}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all active:scale-95"
                        title="Lưu trạng thái hiện tại lên Cloud"
                    >
                        <Save className="w-4 h-4" /> Lưu Bảng Điểm
                    </button>
                </div>
                <button onClick={handleEndTournament} className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 font-bold text-sm rounded-lg flex items-center gap-2 transition-colors">
                    <Flag className="w-4 h-4"/> Kết thúc giải
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {schedule.map((m) => (
                    <div key={m.id} className={`bg-white border rounded-xl p-4 shadow-sm ${m.isCompleted ? 'border-green-200 bg-green-50/10' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 text-right">
                                <div className="font-bold text-slate-800">{m.pair1[0].name} & {m.pair1[1].name}</div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" value={m.score1} onChange={e => handleUpdateScore(m.id, 1, e.target.value)}
                                    disabled={m.isCompleted}
                                    className={`w-12 h-10 text-center font-bold border rounded ${m.isCompleted ? 'bg-transparent border-transparent' : 'bg-slate-50'}`}
                                />
                                <span className="text-slate-300 font-bold">:</span>
                                <input 
                                    type="number" value={m.score2} onChange={e => handleUpdateScore(m.id, 2, e.target.value)}
                                    disabled={m.isCompleted}
                                    className={`w-12 h-10 text-center font-bold border rounded ${m.isCompleted ? 'bg-transparent border-transparent' : 'bg-slate-50'}`}
                                />
                            </div>

                            <div className="flex-1">
                                <div className="font-bold text-slate-800">{m.pair2[0].name} & {m.pair2[1].name}</div>
                            </div>
                        </div>
                        
                        {!m.isCompleted && m.score1 !== '' && m.score2 !== '' && (
                            <div className="mt-3 text-center">
                                <button onClick={() => handleSaveMatch(m)} className="px-4 py-1 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800">
                                    Xác nhận
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const TournamentManager: React.FC<TournamentManagerProps> = (props) => {
    const { tournamentData, onUpdateTournament } = props;
    const [activeTab, setActiveTab] = useState<'round-robin' | 'team-match'>('round-robin');
    const [resetKey, setResetKey] = useState(0);

    // Sync active tab with active tournament mode
    useEffect(() => {
        if (tournamentData?.isActive) {
            setActiveTab(tournamentData.mode || 'round-robin');
        }
    }, [tournamentData]);

    const handleTabChange = (tab: 'round-robin' | 'team-match') => {
        if (tournamentData?.isActive && tournamentData.mode !== tab) {
            // Prevent switching if a tournament is active in another mode
            // Or allow switching but show a "View Only" or "Blocked" state?
            // The user request implies they want to see both tabs.
            // Let's allow switching, but the content of the inactive tab will need to handle the "Active elsewhere" state.
        }
        setActiveTab(tab);
    };

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 mb-6">
                <button
                    onClick={() => handleTabChange('round-robin')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                        activeTab === 'round-robin'
                            ? 'border-pickle-500 text-pickle-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                    }`}
                >
                    Vòng Tròn Xếp Hạng
                </button>
                <button
                    onClick={() => handleTabChange('team-match')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                        activeTab === 'team-match'
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                    }`}
                >
                    Tournament (Team vs Team)
                </button>
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {activeTab === 'round-robin' && (
                    <>
                        {tournamentData?.isActive && tournamentData.mode === 'team-match' ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                                <div className="p-4 bg-indigo-100 rounded-full mb-4">
                                    <Swords className="w-8 h-8 text-indigo-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-2">Đang diễn ra giải đấu Team vs Team</h3>
                                <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                                    Bạn cần kết thúc giải đấu hiện tại bên tab "Tournament" trước khi bắt đầu một giải đấu Vòng Tròn mới.
                                </p>
                                <button 
                                    onClick={() => setActiveTab('team-match')}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700"
                                >
                                    Đi tới giải đấu đang chạy
                                </button>
                            </div>
                        ) : (
                            <RoundRobinManager key={`rr-${resetKey}`} {...props} />
                        )}
                    </>
                )}

                {activeTab === 'team-match' && (
                    <>
                        {tournamentData?.isActive && tournamentData.mode === 'round-robin' ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                                <div className="p-4 bg-pickle-100 rounded-full mb-4">
                                    <Trophy className="w-8 h-8 text-pickle-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 mb-2">Đang diễn ra giải đấu Vòng Tròn</h3>
                                <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                                    Bạn cần kết thúc giải đấu hiện tại bên tab "Vòng Tròn Xếp Hạng" trước khi bắt đầu một giải đấu Team vs Team mới.
                                </p>
                                <button 
                                    onClick={() => setActiveTab('round-robin')}
                                    className="px-4 py-2 bg-pickle-600 text-white text-sm font-bold rounded-lg hover:bg-pickle-700"
                                >
                                    Đi tới giải đấu đang chạy
                                </button>
                            </div>
                        ) : (
                            <TeamMatchManager key={`tm-${resetKey}`} {...props} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};