import React, { useState, useEffect, useRef } from 'react';
import { Player, Match } from '../types';
import { Users, GripVertical, Shuffle, Calendar, Lock, Unlock, Clock, Trophy, UploadCloud, Check, Trash2, Layers, Zap } from 'lucide-react';
import { AutoMatchMakerModal } from './AutoMatchMakerModal';
import { getMatches } from '../services/storageService'; // Helper to get all matches for Algo

interface TournamentManagerProps {
  players: Player[];
  onSaveMatches: (matches: Omit<Match, 'id'>[]) => void;
}

interface Team {
  id: string;
  name: string;
  player1: Player | null;
  player2: Player | null;
}

interface TournamentMatch {
  id: string;
  team1Id: string;
  team2Id: string;
  court: 1 | 2;
  roundNumber: number; // Added round number
  score1: number | '';
  score2: number | '';
  isCompleted: boolean;
}

interface DragData {
    type: 'player' | 'match';
    playerId?: string;
    source?: 'pool' | 'team';
    teamId?: string;
    slot?: number;
    matchIndex?: number;
}

// Key lưu trữ trạng thái giải đấu hiện tại
const TOURNAMENT_STATE_KEY = 'picklepro_tournament_active_state_v2';

export const TournamentManager: React.FC<TournamentManagerProps> = ({ players, onSaveMatches }) => {
  // Filter active players only
  const activePlayers = players.filter(p => p.isActive !== false);

  // --- STATE WITH LAZY INITIALIZATION (PERSISTENCE) ---
  
  // Hàm helper để lấy dữ liệu ban đầu từ LocalStorage
  const getSavedState = () => {
      try {
          const saved = localStorage.getItem(TOURNAMENT_STATE_KEY);
          return saved ? JSON.parse(saved) : null;
      } catch (e) {
          console.error("Error parsing tournament state", e);
          return null;
      }
  };
  const savedState = getSavedState();

  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  
  const [teams, setTeams] = useState<Team[]>(() => {
      return (savedState && savedState.teams) ? savedState.teams : [];
  });

  const [schedule, setSchedule] = useState<TournamentMatch[]>(() => {
      return (savedState && savedState.schedule) ? savedState.schedule : [];
  });
  
  // Settings
  const [tournamentDate, setTournamentDate] = useState<string>(() => {
    if (savedState && savedState.tournamentDate) return savedState.tournamentDate;
    
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    d.setSeconds(0, 0);
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
  });
  
  const [isLocked, setIsLocked] = useState(() => {
      return (savedState && typeof savedState.isLocked === 'boolean') ? savedState.isLocked : false;
  });

  const [countdown, setCountdown] = useState<string>('');
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // New State for Auto Matchmaker Modal
  const [showAutoMaker, setShowAutoMaker] = useState(false);

  // --- PERSISTENCE HELPER ---
  const persistTournamentState = (
      currentTeams: Team[], 
      currentSchedule: TournamentMatch[], 
      locked: boolean, 
      date: string
  ) => {
      localStorage.setItem(TOURNAMENT_STATE_KEY, JSON.stringify({
          teams: currentTeams,
          schedule: currentSchedule,
          isLocked: locked,
          tournamentDate: date
      }));
  };

  // --- INIT & SYNC ---
  const teamsRef = useRef<Team[]>([]);
  useEffect(() => { teamsRef.current = teams; }, [teams]);

  useEffect(() => {
    // 1. Initial Setup: Chỉ chạy nếu chưa có đội nào (cả trong RAM lẫn LocalStorage)
    if (teamsRef.current.length === 0 && activePlayers.length > 0) {
         setAvailablePlayers([...activePlayers]);
         const initialTeams = Array.from({ length: 4 }, (_, i) => ({
            id: `team-${i+1}`,
            name: `Đội ${i+1}`,
            player1: null,
            player2: null
        }));
        setTeams(initialTeams);
        // Chưa cần lưu ngay, để người dùng thao tác đã
        return;
    }

    // 2. Sync Update: Cập nhật thông tin mới nhất của Player vào Team (ví dụ điểm số thay đổi)
    if (teamsRef.current.length > 0) {
        const currentTeams = teamsRef.current;
        
        const updatedTeams = currentTeams.map(t => ({
            ...t,
            player1: t.player1 ? activePlayers.find(p => p.id === t.player1!.id) || t.player1 : null,
            player2: t.player2 ? activePlayers.find(p => p.id === t.player2!.id) || t.player2 : null,
        }));
        
        // Chỉ setTeams nếu thực sự có thay đổi sâu để tránh render loop, 
        // nhưng ở đây ta set luôn để đảm bảo UI hiển thị điểm mới nhất
        setTeams(updatedTeams);
        
        const inTeamIds = new Set<string>();
        updatedTeams.forEach(t => {
            if (t.player1) inTeamIds.add(t.player1.id);
            if (t.player2) inTeamIds.add(t.player2.id);
        });
        
        setAvailablePlayers(activePlayers.filter(p => !inTeamIds.has(p.id)));
    }
  }, [players]); // Watch 'players' to re-run filtering

  // --- COUNTDOWN LOGIC ---
  useEffect(() => {
    if (!isLocked) {
        setCountdown('');
        return;
    }
    const timer = setInterval(() => {
        const now = new Date().getTime();
        const target = new Date(tournamentDate).getTime();
        const distance = target - now;
        if (distance < 0) {
            setCountdown("ĐANG DIỄN RA");
        } else {
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            // Format output: Nd hh:mm:ss
            const dPart = days > 0 ? `${days}d ` : '';
            const hPart = hours.toString().padStart(2, '0');
            const mPart = minutes.toString().padStart(2, '0');
            const sPart = seconds.toString().padStart(2, '0');
            
            setCountdown(`${dPart}${hPart}:${mPart}:${sPart}`);
        }
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked, tournamentDate]);


  // --- HELPERS FOR RATING ---
  const getPlayerRating = (p: Player | null) => {
      if (!p) return 0;
      // 1. Nếu có điểm rating chuẩn (thường < 20) thì dùng luôn
      if (p.tournamentRating !== undefined && p.tournamentRating > 0) return p.tournamentRating;
      
      // 2. Nếu không có, fallback về initialPoints
      const init = p.initialPoints || 0;
      
      // 3. Logic chuẩn hóa: Nếu điểm > 20 (tức là điểm Betting/ELO cũ), quy về 6.0 (trung bình)
      // Nếu điểm <= 20, coi như đó là rating hợp lệ
      return init > 20 ? 6.0 : (init || 6.0);
  };

  const getTeamRating = (id: string) => {
      const t = teams.find(t => t.id === id);
      if (!t || !t.player1 || !t.player2) return 0;
      return getPlayerRating(t.player1) + getPlayerRating(t.player2);
  };

  const getTeamDisplayName = (id: string) => {
      const t = teams.find(team => team.id === id);
      if (!t) return 'Unknown';
      if (t.player1 && t.player2) return `${t.player1.name} & ${t.player2.name}`;
      return t.name;
  };


  // --- DRAG AND DROP HANDLERS ---
  const handlePlayerDragStart = (e: React.DragEvent, player: Player, source: 'pool' | 'team', teamId?: string, slot?: 1 | 2) => {
    e.stopPropagation();
    const data: DragData = { type: 'player', playerId: player.id, source, teamId, slot };
    e.dataTransfer.setData("application/json", JSON.stringify(data));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (dragOverTarget !== targetId) setDragOverTarget(targetId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverTarget(null);
  };

  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;
    try {
        const data: DragData = JSON.parse(dataStr);
        if (data.type !== 'player') return;
        if (data.source === 'team' && data.teamId && data.slot) {
            const teamId = data.teamId;
            const slot = data.slot;
            let playerToMove: Player | null = null;
            const newTeams = teams.map(t => {
                if (t.id === teamId) {
                    if (slot === 1) { playerToMove = t.player1; return { ...t, player1: null }; }
                    if (slot === 2) { playerToMove = t.player2; return { ...t, player2: null }; }
                }
                return t;
            });
            if (playerToMove) {
                setTeams(newTeams);
                setAvailablePlayers(prev => prev.some(p => p.id === playerToMove!.id) ? prev : [...prev, playerToMove!]);
                // Auto save draft state
                persistTournamentState(newTeams, schedule, isLocked, tournamentDate);
            }
        }
    } catch (err) { console.error("Drop Error", err); }
  };

  const handleDropOnTeam = (e: React.DragEvent, targetTeamId: string, targetSlot: 1 | 2) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    const dataStr = e.dataTransfer.getData("application/json");
    if (!dataStr) return;
    try {
        const data: DragData = JSON.parse(dataStr);
        if (data.type !== 'player' || !data.playerId) return;
        const { playerId, source, teamId: sourceTeamId, slot: sourceSlot } = data;
        let movingPlayer: Player | undefined;
        let newAvail = [...availablePlayers];
        let newTeams = [...teams];
        if (source === 'pool') {
            movingPlayer = newAvail.find(p => p.id === playerId);
            if (movingPlayer) newAvail = newAvail.filter(p => p.id !== playerId);
        } else {
            const t = newTeams.find(t => t.id === sourceTeamId);
            if (t && sourceSlot) movingPlayer = sourceSlot === 1 ? t.player1! : t.player2!;
        }
        if (!movingPlayer) return;
        const targetTeamIndex = newTeams.findIndex(t => t.id === targetTeamId);
        if (targetTeamIndex === -1) return;
        const targetTeam = newTeams[targetTeamIndex];
        const existingPlayerInTarget = targetSlot === 1 ? targetTeam.player1 : targetTeam.player2;
        newTeams[targetTeamIndex] = { ...targetTeam, [targetSlot === 1 ? 'player1' : 'player2']: movingPlayer };
        if (source === 'team') {
            const sourceTeamIndex = newTeams.findIndex(t => t.id === sourceTeamId);
            if (sourceTeamIndex > -1) {
                const sTeam = newTeams[sourceTeamIndex];
                newTeams[sourceTeamIndex] = { ...sTeam, [sourceSlot === 1 ? 'player1' : 'player2']: existingPlayerInTarget };
            }
        } else {
            if (existingPlayerInTarget && !newAvail.some(p => p.id === existingPlayerInTarget.id)) {
                newAvail.push(existingPlayerInTarget);
            }
        }
        setTeams(newTeams);
        setAvailablePlayers(newAvail);
        // Auto save draft state
        persistTournamentState(newTeams, schedule, isLocked, tournamentDate);
    } catch (err) { console.error("Drop Error", err); }
  };

  const handleMatchDragStart = (e: React.DragEvent, index: number) => {
      e.dataTransfer.setData("type", "match");
      e.dataTransfer.setData("matchIndex", index.toString());
      e.dataTransfer.effectAllowed = "move";
  };

  const handleMatchDrop = (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (e.dataTransfer.getData("type") !== "match") return;
      const sourceIndex = parseInt(e.dataTransfer.getData("matchIndex"));
      if (sourceIndex === targetIndex) return;
      const newSchedule = [...schedule];
      const [movedMatch] = newSchedule.splice(sourceIndex, 1);
      newSchedule.splice(targetIndex, 0, movedMatch);
      // Recalculate courts and rounds based on new order is tricky with grouping
      // For simplicity in this version, dragging reorders the array, but visually we might need to be careful with rounds
      // Ideally we re-assign round numbers or just swap positions
      setSchedule(newSchedule);
      persistTournamentState(teams, newSchedule, isLocked, tournamentDate);
  };

  const allowMatchDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  // --- ACTIONS ---
  const handleRandomize = () => {
    let allPlayers = [...availablePlayers];
    teams.forEach(t => {
        if (t.player1) allPlayers.push(t.player1);
        if (t.player2) allPlayers.push(t.player2);
    });
    
    // Sắp xếp dựa trên RATING đã chuẩn hóa (High to Low)
    // Đảm bảo người 1000 điểm không bị tính là rating 1000, mà là 6.0
    allPlayers.sort((a, b) => {
        return getPlayerRating(b) - getPlayerRating(a);
    });

    const newTeams: Team[] = [];
    const teamCount = Math.floor(allPlayers.length / 2);
    
    // Thuật toán High-Low (Con rắn): Mạnh nhất + Yếu nhất
    for (let i = 0; i < teamCount; i++) {
        const p1 = allPlayers[i];
        const p2 = allPlayers[allPlayers.length - 1 - i];
        newTeams.push({ id: `team-${i+1}`, name: `Đội ${i+1}`, player1: p1, player2: p2 });
    }
    
    const usedIds = new Set(newTeams.flatMap(t => [t.player1?.id, t.player2?.id]));
    const leftovers = allPlayers.filter(p => !usedIds.has(p.id));
    
    setTeams(newTeams);
    setAvailablePlayers(leftovers);
    setSchedule([]);
    persistTournamentState(newTeams, [], isLocked, tournamentDate);
  };

  // Apply Auto Matchmaker Results
  const applyAutoMatches = (generatedMatches: any[]) => {
      // 1. Transform generated matches into internal Team structure
      const newTeams: Team[] = [];
      const newSchedule: TournamentMatch[] = [];
      const usedPlayerIds = new Set<string>();

      // Extract unique teams from matches
      let teamCounter = 1;
      const teamMap = new Map<string, string>(); // 'p1-p2' -> teamId

      generatedMatches.forEach((m, idx) => {
          const processTeam = (gp: any) => {
              const p1 = players.find(p => p.id === gp.player1.id);
              const p2 = players.find(p => p.id === gp.player2.id);
              if (!p1 || !p2) return null;
              
              const key = [p1.id, p2.id].sort().join('-');
              if (!teamMap.has(key)) {
                  const tId = `team-${Date.now()}-${teamCounter++}`;
                  teamMap.set(key, tId);
                  newTeams.push({
                      id: tId,
                      name: `Đội ${teamCounter-1}`,
                      player1: p1,
                      player2: p2
                  });
                  usedPlayerIds.add(p1.id);
                  usedPlayerIds.add(p2.id);
              }
              return teamMap.get(key);
          };

          const t1Id = processTeam(m.team1);
          const t2Id = processTeam(m.team2);

          if (t1Id && t2Id) {
              newSchedule.push({
                  id: `match-${Date.now()}-${idx}`,
                  team1Id: t1Id,
                  team2Id: t2Id,
                  court: (idx % 2) + 1 as 1 | 2,
                  roundNumber: Math.floor(idx / 2) + 1,
                  score1: '',
                  score2: '',
                  isCompleted: false
              });
          }
      });

      // Update State
      setTeams(newTeams);
      setSchedule(newSchedule);
      
      // Update Available Players (Leftovers)
      const leftovers = activePlayers.filter(p => !usedPlayerIds.has(p.id));
      setAvailablePlayers(leftovers);

      // Save
      persistTournamentState(newTeams, newSchedule, isLocked, tournamentDate);
  };

  const addTeamSlot = () => {
    const newTeams = [...teams, { id: `team-${Date.now()}`, name: `Đội ${teams.length + 1}`, player1: null, player2: null }];
    setTeams(newTeams);
    persistTournamentState(newTeams, schedule, isLocked, tournamentDate);
  };

  const removeTeamSlot = (id: string) => {
    const t = teams.find(team => team.id === id);
    if (!t) return;
    const returning = [];
    if (t.player1) returning.push(t.player1);
    if (t.player2) returning.push(t.player2);
    setAvailablePlayers([...availablePlayers, ...returning]);
    const newTeams = teams.filter(team => team.id !== id);
    setTeams(newTeams);
    persistTournamentState(newTeams, schedule, isLocked, tournamentDate);
  };

  const generateSchedule = () => {
    const validTeams = teams.filter(t => t.player1 && t.player2);
    if (validTeams.length < 2) {
        alert("Cần ít nhất 2 đội đủ thành viên để tạo lịch.");
        return;
    }

    // 1. Generate All Round Robin Pairs
    const pool: { team1Id: string, team2Id: string }[] = [];
    const n = validTeams.length;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            pool.push({
                team1Id: validTeams[i].id,
                team2Id: validTeams[j].id
            });
        }
    }

    // 2. Shuffle Pool (Randomness)
    pool.sort(() => Math.random() - 0.5);

    // 3. Heuristic Filling
    const orderedMatches: TournamentMatch[] = [];
    
    // Track consecutive matches for fatigue logic: Map<TeamId, CurrentStreak>
    const teamStreaks: Record<string, number> = {};
    validTeams.forEach(t => teamStreaks[t.id] = 0);

    let matchIdCounter = 0;
    let roundCounter = 1; // Start Round Counting

    // Loop until pool is empty
    while (pool.length > 0) {
        // We try to fill Court 1 and Court 2 for this "Round"
        const roundMatches: TournamentMatch[] = [];
        const teamsPlayingInThisRound = new Set<string>();

        // Helper to find best match from pool
        const findBestMatchIndex = () => {
            // Filter candidates that don't conflict with current round
            const candidates = pool.map((m, idx) => ({ m, idx })).filter(item => {
                return !teamsPlayingInThisRound.has(item.m.team1Id) && !teamsPlayingInThisRound.has(item.m.team2Id);
            });

            if (candidates.length === 0) return -1;

            // Sort candidates by fatigue (Lowest combined streak first)
            // This prevents teams from playing 3 times in a row if possible
            candidates.sort((a, b) => {
                const streakA = (teamStreaks[a.m.team1Id] || 0) + (teamStreaks[a.m.team2Id] || 0);
                const streakB = (teamStreaks[b.m.team1Id] || 0) + (teamStreaks[b.m.team2Id] || 0);
                return streakA - streakB;
            });

            return candidates[0].idx;
        };

        // --- Fill Court 1 ---
        const idx1 = findBestMatchIndex();
        if (idx1 !== -1) {
            const matchData = pool.splice(idx1, 1)[0];
            const match: TournamentMatch = {
                id: `match-${Date.now()}-${matchIdCounter++}`,
                team1Id: matchData.team1Id,
                team2Id: matchData.team2Id,
                court: 1,
                roundNumber: roundCounter,
                score1: '',
                score2: '',
                isCompleted: false
            };
            roundMatches.push(match);
            teamsPlayingInThisRound.add(matchData.team1Id);
            teamsPlayingInThisRound.add(matchData.team2Id);
        }

        // --- Fill Court 2 ---
        const idx2 = findBestMatchIndex(); // This will respect teams added to teamsPlayingInThisRound from Court 1
        if (idx2 !== -1) {
            const matchData = pool.splice(idx2, 1)[0];
            const match: TournamentMatch = {
                id: `match-${Date.now()}-${matchIdCounter++}`,
                team1Id: matchData.team1Id,
                team2Id: matchData.team2Id,
                court: 2,
                roundNumber: roundCounter,
                score1: '',
                score2: '',
                isCompleted: false
            };
            roundMatches.push(match);
            teamsPlayingInThisRound.add(matchData.team1Id);
            teamsPlayingInThisRound.add(matchData.team2Id);
        }

        // Fallback: If we couldn't schedule ANY match in this round but pool is not empty
        if (roundMatches.length === 0 && pool.length > 0) {
             const matchData = pool.shift()!;
             const match: TournamentMatch = {
                id: `match-${Date.now()}-${matchIdCounter++}`,
                team1Id: matchData.team1Id,
                team2Id: matchData.team2Id,
                court: 1,
                roundNumber: roundCounter,
                score1: '',
                score2: '',
                isCompleted: false
            };
            roundMatches.push(match);
            teamsPlayingInThisRound.add(matchData.team1Id);
            teamsPlayingInThisRound.add(matchData.team2Id);
        }

        // --- Update Streaks for Fatigue Logic ---
        validTeams.forEach(t => {
            if (teamsPlayingInThisRound.has(t.id)) {
                teamStreaks[t.id] = (teamStreaks[t.id] || 0) + 1;
            } else {
                teamStreaks[t.id] = 0; // Reset streak if they rested this round
            }
        });

        orderedMatches.push(...roundMatches);
        roundCounter++; // Increment round number after filling courts
    }

    setSchedule(orderedMatches);
    persistTournamentState(teams, orderedMatches, isLocked, tournamentDate);
  };

  const updateMatchScore = (matchId: string, field: 'score1' | 'score2', value: string) => {
      const val = value === '' ? '' : parseInt(value);
      const newSchedule = schedule.map(m => m.id === matchId ? { ...m, [field]: val } : m);
      setSchedule(newSchedule);
      // Save scores while typing to avoid loss on accidental refresh
      persistTournamentState(teams, newSchedule, isLocked, tournamentDate);
  };

  const handleSaveAllResults = () => {
      const matchesToSave = schedule.filter(m => !m.isCompleted && m.score1 !== '' && m.score2 !== '');
      if (matchesToSave.length === 0) {
          alert("Chưa có kết quả mới để lưu. Vui lòng nhập tỉ số.");
          return;
      }
      const validMatches: Omit<Match, 'id'>[] = [];
      const completedIds: string[] = [];
      for (const m of matchesToSave) {
          const s1 = Number(m.score1);
          const s2 = Number(m.score2);

          if (s1 === s2) {
              alert(`Trận đấu sân ${m.court} (Lượt ${m.roundNumber}) đang có tỉ số hòa.`);
              return;
          }
          const team1 = teams.find(t => t.id === m.team1Id);
          const team2 = teams.find(t => t.id === m.team2Id);
          if (team1 && team2 && team1.player1 && team1.player2 && team2.player1 && team2.player2) {
              validMatches.push({
                  type: 'tournament',
                  date: new Date().toISOString(),
                  team1: [team1.player1.id, team1.player2.id],
                  team2: [team2.player1.id, team2.player2.id],
                  score1: s1,
                  score2: s2,
                  winner: s1 > s2 ? 1 : 2
              });
              completedIds.push(m.id);
          }
      }
      
      onSaveMatches(validMatches);
      
      const newSchedule = schedule.map(m => completedIds.includes(m.id) ? { ...m, isCompleted: true } : m);
      setSchedule(newSchedule);
      persistTournamentState(teams, newSchedule, isLocked, tournamentDate);

      alert(`Đã lưu ${validMatches.length} trận đấu và đang đồng bộ Cloud!`);
  };

  const handleConfirmSchedule = () => {
    if (schedule.length === 0) {
        alert("Vui lòng tạo lịch trước khi xác nhận.");
        return;
    }
    setIsLocked(true);
    // Save state with Lock = true
    persistTournamentState(teams, schedule, true, tournamentDate);
  };
  
  const handleUnlock = () => {
      setIsLocked(false);
      // Update state with Lock = false, allow editing again
      persistTournamentState(teams, schedule, false, tournamentDate);
  }

  const renderScheduleList = (cols: 1 | 2) => {
      // Group matches by round number
      const rounds = new Map<number, TournamentMatch[]>();
      schedule.forEach(m => {
          const r = m.roundNumber || 1; // fallback to 1 if undefined legacy
          if (!rounds.has(r)) rounds.set(r, []);
          rounds.get(r)!.push(m);
      });

      const sortedRounds = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);

      return (
        <div className="flex flex-col gap-6">
            {sortedRounds.map(([roundNum, roundMatches]) => (
                <div key={roundNum} className="space-y-3">
                    <div className="flex items-center gap-2 px-2">
                         <div className="h-px flex-1 bg-slate-200"></div>
                         <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Lượt {roundNum}
                         </span>
                         <div className="h-px flex-1 bg-slate-200"></div>
                    </div>
                    <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-4`}>
                        {roundMatches.map((match) => {
                             // Find original index for Drag & Drop
                             const originalIdx = schedule.findIndex(s => s.id === match.id);
                             return (
                                <div 
                                    key={match.id} 
                                    draggable={!isLocked}
                                    onDragStart={(e) => handleMatchDragStart(e, originalIdx)}
                                    onDragOver={allowMatchDrop}
                                    onDrop={(e) => handleMatchDrop(e, originalIdx)}
                                    className={`relative bg-white rounded-lg border shadow-sm p-3 transition-all ${match.isCompleted ? 'border-green-200 bg-green-50 opacity-80' : 'border-slate-200'} ${!isLocked ? 'cursor-move hover:border-pickle-400' : ''}`}
                                >
                                    <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${match.court === 1 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>SÂN {match.court}</span>
                                            {!isLocked && <GripVertical className="w-3 h-3 text-slate-300" />}
                                        </div>
                                        {match.isCompleted && <Check className="w-4 h-4 text-green-500" />}
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 flex flex-col items-end">
                                            <span className="font-bold text-sm text-slate-800 text-right leading-tight break-words max-w-[120px]">{getTeamDisplayName(match.team1Id)}</span>
                                            <span className="text-[10px] text-slate-400">{getTeamRating(match.team1Id).toFixed(1)} Rating</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg shrink-0">
                                            {isLocked && !match.isCompleted ? (
                                                <>
                                                    <input 
                                                        type="number" 
                                                        value={match.score1}
                                                        onChange={(e) => updateMatchScore(match.id, 'score1', e.target.value)}
                                                        className="w-10 h-10 text-center text-lg font-bold border border-slate-300 rounded focus:border-pickle-500 focus:outline-none bg-white text-slate-900"
                                                        placeholder="-"
                                                    />
                                                    <span className="text-slate-400">-</span>
                                                    <input 
                                                        type="number" 
                                                        value={match.score2}
                                                        onChange={(e) => updateMatchScore(match.id, 'score2', e.target.value)}
                                                        className="w-10 h-10 text-center text-lg font-bold border border-slate-300 rounded focus:border-blue-500 focus:outline-none bg-white text-slate-900"
                                                        placeholder="-"
                                                    />
                                                </>
                                            ) : (
                                                <div className="flex gap-2 px-2 font-mono font-bold text-lg">
                                                    <span className={match.isCompleted && (Number(match.score1) > Number(match.score2)) ? 'text-green-600' : 'text-slate-600'}>{match.score1 || 0}</span>
                                                    <span className="text-slate-300">-</span>
                                                    <span className={match.isCompleted && (Number(match.score2) > Number(match.score1)) ? 'text-blue-600' : 'text-slate-600'}>{match.score2 || 0}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col items-start">
                                            <span className="font-bold text-sm text-slate-800 text-left leading-tight break-words max-w-[120px]">{getTeamDisplayName(match.team2Id)}</span>
                                            <span className="text-[10px] text-slate-400">{getTeamRating(match.team2Id).toFixed(1)} Rating</span>
                                        </div>
                                    </div>
                                </div>
                             );
                        })}
                    </div>
                </div>
            ))}
        </div>
      );
  };

  return (
    <>
    <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
        }
        input[type=number] {
            -moz-appearance: textfield;
        }
    `}</style>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-100px)]">
        
        {/* --- LEFT COLUMN: TEAM ARRANGEMENT (1/3) --- */}
        {!isLocked && (
            <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-hidden animate-fade-in">
                {/* TOOLBAR */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-pickle-600" /> Xếp Giải
                    </h3>
                    
                    {/* NEW ACTION ROW */}
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => setShowAutoMaker(true)}
                            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-lg font-bold hover:bg-slate-800 transition-all shadow-md active:scale-95"
                        >
                            <Zap className="w-4 h-4 text-yellow-400" fill="currentColor" /> Ghép Đội AI
                        </button>

                        <div className="flex gap-2">
                            <button onClick={handleRandomize} className="flex-1 flex items-center justify-center gap-2 bg-purple-100 text-purple-700 py-2 rounded-lg font-bold hover:bg-purple-200 transition-colors text-xs sm:text-sm">
                                <Shuffle className="w-4 h-4" /> Random Cân Bằng
                            </button>
                            <button onClick={addTeamSlot} className="px-3 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-bold" title="Thêm slot đội">+</button>
                        </div>
                    </div>
                </div>

                {/* POOL & TEAMS SCROLL AREA */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-20">
                    <div 
                        onDragOver={(e) => handleDragOver(e, 'pool')}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDropOnPool}
                        className={`p-3 rounded-xl border-2 border-dashed min-h-[100px] transition-colors ${dragOverTarget === 'pool' ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-300'}`}
                    >
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Kho Người Chơi ({availablePlayers.length})</h4>
                        <div className="flex flex-wrap gap-2">
                            {availablePlayers.map(p => (
                                <div key={p.id} draggable onDragStart={(e) => handlePlayerDragStart(e, p, 'pool')} className="px-3 py-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-sm font-medium text-slate-700 cursor-grab active:cursor-grabbing hover:border-pickle-500 hover:text-pickle-600 select-none flex items-center gap-1">
                                    <GripVertical className="w-3 h-3 text-slate-400" />
                                    {p.name} 
                                    <span className="text-[10px] text-slate-400 ml-1 bg-slate-100 px-1 rounded">{getPlayerRating(p).toFixed(1)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        {teams.map((team, idx) => {
                            const totalRating = getPlayerRating(team.player1) + getPlayerRating(team.player2);
                            return (
                                <div key={team.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-100 px-3 py-2 flex justify-between items-center border-b border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 text-sm">{idx + 1}. {team.player1 && team.player2 ? `${team.player1.name} & ${team.player2.name}` : team.name}</span>
                                            <span className="text-xs font-mono bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{totalRating.toFixed(1)} Rating</span>
                                        </div>
                                        <button onClick={() => removeTeamSlot(team.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    <div className="p-2 flex flex-col gap-2">
                                        {[1, 2].map(slot => {
                                            const player = slot === 1 ? team.player1 : team.player2;
                                            const slotId = `${team.id}-${slot}`;
                                            return (
                                                <div key={slotId} 
                                                    onDragOver={(e) => handleDragOver(e, slotId)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDropOnTeam(e, team.id, slot as 1|2)}
                                                    className={`p-2 rounded-lg border-2 border-dashed transition-colors flex items-center justify-between ${dragOverTarget === slotId ? 'bg-green-100 border-green-400' : player ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}
                                                >
                                                    {player ? (
                                                        <div draggable onDragStart={(e) => handlePlayerDragStart(e, player, 'team', team.id, slot as 1|2)} className="flex-1 flex items-center gap-2 cursor-grab select-none">
                                                            <div className="w-6 h-6 rounded-full bg-white text-green-700 font-bold text-xs flex items-center justify-center border border-green-200 pointer-events-none">{player.name.charAt(0)}</div>
                                                            <span className="text-sm font-medium text-slate-900 truncate pointer-events-none">{player.name}</span>
                                                            <span className="text-[10px] text-slate-400 ml-auto bg-slate-50 px-1 rounded border border-slate-100">{getPlayerRating(player).toFixed(1)}</span>
                                                        </div>
                                                    ) : <span className="text-xs text-slate-400 pl-2 pointer-events-none">Kéo người chơi</span>}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        )}

        {/* --- RIGHT COLUMN: SCHEDULE --- */}
        <div className={`${isLocked ? 'col-span-12' : 'lg:col-span-8'} flex flex-col h-full overflow-hidden transition-all duration-300`}>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 sticky top-0 z-10">
                {isLocked ? (
                    // LOCKED HEADER: CENTERED & LARGER
                    <div className="flex flex-col items-center animate-fade-in pb-2">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-yellow-100 rounded-full">
                                <Trophy className="w-6 h-6 text-yellow-700" />
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tight text-center">
                                Mùa Giải Tháng {new Date(tournamentDate).getMonth() + 1}
                            </h2>
                            <div className="p-2 bg-yellow-100 rounded-full">
                                <Trophy className="w-6 h-6 text-yellow-700" />
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-4">
                             <span className="text-slate-400 font-bold text-sm uppercase tracking-wider">Thời gian còn lại</span>
                        </div>

                        <div className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-red-500 rounded-2xl border-4 border-slate-100 shadow-xl mb-4 transform scale-105">
                            <Clock className="w-6 h-6 md:w-8 md:h-8 animate-pulse" /> 
                            <span className="text-2xl md:text-4xl font-mono font-black tracking-widest leading-none">
                                {countdown}
                            </span>
                        </div>

                        {/* Buttons */}
                        <div className="w-full flex flex-col md:flex-row gap-3 pt-2">
                            <button 
                                onClick={handleSaveAllResults}
                                className="flex-[2] py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-lg shadow-lg flex items-center justify-center gap-2 uppercase tracking-wide transform active:scale-[0.98] transition-all"
                            >
                                <UploadCloud className="w-6 h-6" /> CẬP NHẬT KẾT QUẢ & ĐỒNG BỘ
                            </button>

                            <button 
                                onClick={handleUnlock}
                                className="md:w-auto px-6 py-4 bg-white hover:bg-slate-50 text-slate-500 hover:text-red-500 font-bold rounded-xl text-sm flex items-center justify-center gap-2 border-2 border-slate-200 transition-colors"
                            >
                                <Unlock className="w-4 h-4" /> Mở Khóa
                            </button>
                        </div>
                    </div>
                ) : (
                    // UNLOCKED HEADER: STANDARD
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 text-green-600">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">
                                    Dự Thảo Lịch Thi Đấu
                                </h2>
                                <p className="text-xs text-slate-500">Sắp xếp các đội và tạo lịch trước khi chốt.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Thời gian</label>
                                <input 
                                    type="datetime-local" 
                                    value={tournamentDate}
                                    onChange={(e) => {
                                        setTournamentDate(e.target.value);
                                        persistTournamentState(teams, schedule, isLocked, e.target.value);
                                    }}
                                    className="text-sm border border-slate-300 rounded px-2 py-1"
                                />
                            </div>
                            <button onClick={generateSchedule} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm">Tạo Lịch</button>
                            <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); handleConfirmSchedule(); }}
                                disabled={schedule.length === 0}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg text-sm shadow-md flex items-center gap-2"
                            >
                                <Lock className="w-4 h-4" /> Xác Nhận Lịch
                            </button>
                        </div>
                    </div>
                )}
             </div>

             <div className="flex-1 overflow-y-auto bg-slate-50 rounded-xl border border-slate-200 p-4">
                {schedule.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Calendar className="w-12 h-12 mb-2 opacity-50" />
                        <p>Chưa có trận đấu nào được tạo.</p>
                    </div>
                ) : (
                    renderScheduleList(isLocked ? 2 : 1)
                )}
             </div>
        </div>

        {/* --- AUTO MATCHMAKER MODAL --- */}
        {showAutoMaker && (
            <AutoMatchMakerModal 
                players={activePlayers} 
                matches={getMatches()} 
                onApplyMatches={applyAutoMatches} 
                onClose={() => setShowAutoMaker(false)} 
            />
        )}
    </div>
    </>
  );
};