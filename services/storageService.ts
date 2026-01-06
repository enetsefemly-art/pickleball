import { Player, Match } from '../types';

// KEYS CẤU HÌNH
// Key hiện tại
const PLAYERS_KEY = 'picklepro_players_v2'; 
const MATCHES_KEY = 'picklepro_matches_v2';

// Danh sách các Key cũ có thể đã được sử dụng trước đây
// Hệ thống sẽ tìm trong các key này nếu key chính bị rỗng
const LEGACY_PLAYER_KEYS = ['picklepro_players', 'players_data', 'pickle_pro_players'];
const LEGACY_MATCH_KEYS = ['picklepro_matches', 'matches_data', 'pickle_pro_matches'];

// NGÀY BẮT ĐẦU TÍNH ĐIỂM RATING CŨ (+0.1/-0.1)
const RATING_START_DATE = new Date('2024-12-16T00:00:00');

// NGÀY BẮT ĐẦU TÍNH ĐIỂM RATING 2.0 (ELO ELO)
const RATING_RULE_2_DATE = new Date('2026-01-01T00:00:00');

// --- CONSTANTS RULE 1.0 ---
const MAX_RATING_V1 = 6.0;
const MIN_RATING_V1 = 2.0;
const RATING_STEP_V1 = 0.1;

// --- CONSTANTS RULE 2.0 ---
const V2_RATING_MIN = 2.0;
const V2_RATING_MAX = 6.0;
const V2_WIN_SCORE = 11.0;
const V2_TAU = 0.45;
const V2_K = 0.18;
const V2_ALPHA = 0.55;
const V2_BETA = 1.4;
const V2_MAX_CHANGE = 0.14;

// Initial Mock Data - Chỉ dùng khi KHÔNG tìm thấy bất kỳ dữ liệu nào (New Install)
const INITIAL_PLAYERS: Player[] = [
  { id: '1', name: 'Nguyễn Văn A', initialPoints: 1000, matchesPlayed: 0, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0, totalRankingPoints: 1000, tournamentRating: 1000, championships: 0, isActive: true },
  { id: '2', name: 'Trần Thị B', initialPoints: 1000, matchesPlayed: 0, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0, totalRankingPoints: 1000, tournamentRating: 1000, championships: 0, isActive: true },
  { id: '3', name: 'Lê Văn C', initialPoints: 1000, matchesPlayed: 0, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0, totalRankingPoints: 1000, tournamentRating: 1000, championships: 0, isActive: true },
  { id: '4', name: 'Phạm Thị D', initialPoints: 1000, matchesPlayed: 0, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0, totalRankingPoints: 1000, tournamentRating: 1000, championships: 0, isActive: true },
  { id: '5', name: 'Hoàng Long', initialPoints: 1000, matchesPlayed: 0, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0, totalRankingPoints: 1000, tournamentRating: 1000, championships: 0, isActive: true },
  { id: '6', name: 'Vũ Mai', initialPoints: 1000, matchesPlayed: 0, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0, totalRankingPoints: 1000, tournamentRating: 1000, championships: 0, isActive: true },
];

const INITIAL_MATCHES: Match[] = [];

// --- HELPER FUNCTIONS ---

const safeParse = (data: string | null, fallback: any) => {
    if (!data) return fallback;
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        return fallback;
    }
};

// Hàm tìm kiếm dữ liệu từ nhiều nguồn key khác nhau
const loadFromStorageWithRecovery = (mainKey: string, legacyKeys: string[]) => {
    // 1. Thử lấy từ key chính
    let rawData = localStorage.getItem(mainKey);
    
    // 2. Nếu key chính rỗng, đi lục lọi các key cũ
    if (!rawData) {
        for (const oldKey of legacyKeys) {
            const oldData = localStorage.getItem(oldKey);
            if (oldData) {
                console.log(`[Data Recovery] Found data in legacy key: ${oldKey}. Migrating to ${mainKey}...`);
                rawData = oldData;
                // Lưu ngay sang key mới để lần sau không phải tìm nữa
                localStorage.setItem(mainKey, oldData);
                break;
            }
        }
    }
    return rawData;
};

// --- MAIN EXPORTS ---

export const getPlayers = (): Player[] => {
  const data = loadFromStorageWithRecovery(PLAYERS_KEY, LEGACY_PLAYER_KEYS);

  if (!data) {
    // Nếu vẫn không có dữ liệu, dùng mặc định và lưu lại
    console.log("No existing data found. Initializing with default players.");
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(INITIAL_PLAYERS));
    return INITIAL_PLAYERS;
  }
  
  // MIGRATION & VALIDATION LOGIC
  try {
    const parsedPlayers = JSON.parse(data);
    
    if (!Array.isArray(parsedPlayers)) return INITIAL_PLAYERS;

    // Duyệt qua từng người chơi và chuẩn hóa dữ liệu (đảm bảo không bị lỗi khi thiếu trường)
    const migratedPlayers = parsedPlayers.map((p: any) => ({
      ...p,
      // QUAN TRỌNG: Ép kiểu ID thành chuỗi để tránh lỗi tìm kiếm "Unknown" do lệch kiểu (số vs chuỗi)
      id: String(p.id || Math.random().toString()),
      name: p.name || 'Unknown Player',
      // Giữ nguyên initialPoints cũ, nếu không có thì gán 1000
      initialPoints: typeof p.initialPoints === 'number' ? p.initialPoints : 1000,
      
      // Các chỉ số thống kê sẽ được tính toán lại từ Matches, nhưng ta gán giá trị an toàn
      matchesPlayed: Number(p.matchesPlayed || 0),
      wins: Number(p.wins || 0),
      losses: Number(p.losses || 0),
      pointsScored: Number(p.pointsScored || 0),
      pointsConceded: Number(p.pointsConceded || 0),
      // Total points tạm thời lấy từ storage hoặc initial, sẽ được calculatePlayerStats ghi đè chính xác sau
      totalRankingPoints: typeof p.totalRankingPoints === 'number' ? p.totalRankingPoints : (p.initialPoints || 1000),
      // Mặc định tournamentRating = initialPoints
      tournamentRating: typeof p.tournamentRating === 'number' ? p.tournamentRating : (p.initialPoints || 1000),
      // Cúp vô địch
      championships: typeof p.championships === 'number' ? p.championships : 0,
      // Status Active (Default true if missing)
      isActive: p.isActive !== undefined ? p.isActive : true
    }));

    return migratedPlayers;
  } catch (e) {
    console.error("Critical Error reading players data:", e);
    return INITIAL_PLAYERS;
  }
};

export const savePlayers = (players: Player[]) => {
  try {
      localStorage.setItem(PLAYERS_KEY, JSON.stringify(players));
  } catch (e) {
      console.error("Failed to save players:", e);
  }
};

export const getMatches = (): Match[] => {
  const data = loadFromStorageWithRecovery(MATCHES_KEY, LEGACY_MATCH_KEYS);

  if (!data) {
    localStorage.setItem(MATCHES_KEY, JSON.stringify(INITIAL_MATCHES));
    return INITIAL_MATCHES;
  }
  
  try {
      const parsedMatches = JSON.parse(data);
      if (!Array.isArray(parsedMatches)) return INITIAL_MATCHES;

      // Migration: Đảm bảo trường 'type' tồn tại cho các trận đấu cũ
      const migratedMatches = parsedMatches.map((m: any) => {
          // Robust Number casting to prevent NaN issues from legacy data
          // If score is undefined/null/"" -> 0
          const s1 = Number(m.score1);
          const s2 = Number(m.score2);
          // Ép kiểu winner về số để tránh lỗi logic "1" !== 1
          const w = Number(m.winner);
          
          return {
            ...m,
            id: String(m.id), // Ensure Match ID is string
            type: m.type || 'betting', // Mặc định là 'betting' nếu dữ liệu cũ chưa có
            score1: isNaN(s1) ? 0 : s1, 
            score2: isNaN(s2) ? 0 : s2,
            winner: (w === 1 || w === 2) ? w : 1, // Mặc định winner là 1 nếu lỗi
            rankingPoints: m.rankingPoints !== undefined ? Number(m.rankingPoints) : 50 // Mặc định 50 nếu thiếu
          };
      });
      return migratedMatches;
  } catch (e) {
      console.error("Error reading matches data:", e);
      return INITIAL_MATCHES;
  }
};

export const saveMatches = (matches: Match[]) => {
  try {
      localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
  } catch (e) {
      console.error("Failed to save matches:", e);
  }
};

// Interface helper for pair calculation
interface PairWinStat {
    pairId: string;
    playerIds: string[];
    wins: number;
    losses: number;
    pointsScored: number;
    pointsConceded: number;
}

// Interface for Rating Detail Log
export interface RatingCalculationLog {
    teamA_Rating: number;
    teamB_Rating: number;
    diff: number;
    expectedA: number;
    scoreA: number;
    scoreB: number;
    marginFactor: number;
    teamChangeA: number;
    players: {
        id: string;
        name: string;
        oldRating: number;
        newRating: number;
        weight: number;
        change: number;
        team: 1 | 2;
    }[];
    isRule2: boolean;
}

// --- NEW FUNCTION: Get Detailed Calculation for a specific match ---
export const getMatchRatingDetails = (
    targetMatchId: string, 
    allMatches: Match[], 
    allPlayers: Player[]
): RatingCalculationLog | null => {
    
    // 1. Reset Stats (Simulate from beginning)
    const playerMap = new Map<string, any>();
    allPlayers.forEach(p => {
        const baseRating = typeof p.initialPoints === 'number' ? p.initialPoints : 1000;
        playerMap.set(String(p.id), { ...p, tournamentRating: baseRating });
    });

    const getR = (pid: string) => {
        const p = playerMap.get(String(pid));
        return p ? (p.tournamentRating || 0) : 3.0;
    };

    // 2. Sort Matches
    const sortedMatches = [...allMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Replay loop
    for (const match of sortedMatches) {
        const matchDate = new Date(match.date);
        const isRuleV2 = matchDate.getTime() >= RATING_RULE_2_DATE.getTime();
        const isTarget = match.id === targetMatchId;

        // Extract Basic Info
        let s1 = Number(match.score1);
        let s2 = Number(match.score2);
        if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
        
        let winner: 1 | 2;
        if (s1 > s2) winner = 1;
        else if (s2 > s1) winner = 2;
        else winner = Number(match.winner) === 1 ? 1 : 2;
        const isTeam1Winner = winner === 1;

        const team1Ids = match.team1.map(String);
        const team2Ids = match.team2.map(String);

        if (isRuleV2) {
            // --- RULE 2.0 CALC ---
            const getTeamRating = (ids: string[]) => {
                if (ids.length === 0) return 3.0;
                const sum = ids.reduce((acc, pid) => acc + getR(pid), 0);
                return sum / ids.length;
            };

            const TA = getTeamRating(team1Ids);
            const TB = getTeamRating(team2Ids);
            const Diff = TA - TB;
            const ExpectedA = 1 / (1 + Math.exp(-Diff / V2_TAU));
            const ResultA = isTeam1Winner ? 1 : 0;
            
            const ScoreDiff = Math.abs(s1 - s2);
            let MarginFactor = 1 + V2_ALPHA * ((ScoreDiff / V2_WIN_SCORE) - 0.25);
            if (MarginFactor < 0.85) MarginFactor = 0.85;
            if (MarginFactor > 1.20) MarginFactor = 1.20;

            let TeamChangeA = V2_K * (ResultA - ExpectedA) * MarginFactor;
            const TeamChangeB = -TeamChangeA;

            // Capture Data if this is the target match
            let logData: RatingCalculationLog | null = null;
            if (isTarget) {
                logData = {
                    teamA_Rating: TA,
                    teamB_Rating: TB,
                    diff: Diff,
                    expectedA: ExpectedA,
                    scoreA: s1,
                    scoreB: s2,
                    marginFactor: MarginFactor,
                    teamChangeA: TeamChangeA,
                    players: [],
                    isRule2: true
                };
            }

            // Apply Updates
            const updateV2Player = (pid: string, teamAvgRating: number, teamChange: number, teamNum: 1 | 2) => {
                const p = playerMap.get(pid);
                if (!p) return;
                
                const R_old = p.tournamentRating;
                
                let teammateId = teamNum === 1
                    ? team1Ids.find(id => id !== pid) 
                    : team2Ids.find(id => id !== pid);
                
                let W = 1.0;
                if (teammateId) {
                    const R_partner = getR(teammateId);
                    const w_me = Math.exp(-V2_BETA * (R_old - teamAvgRating));
                    const w_partner = Math.exp(-V2_BETA * (R_partner - teamAvgRating));
                    W = w_me / (w_me + w_partner);
                }

                let individualChange = W * teamChange;
                if (individualChange > V2_MAX_CHANGE) individualChange = V2_MAX_CHANGE;
                if (individualChange < -V2_MAX_CHANGE) individualChange = -V2_MAX_CHANGE;

                let R_new = R_old + individualChange;
                if (R_new > V2_RATING_MAX) R_new = V2_RATING_MAX;
                if (R_new < V2_RATING_MIN) R_new = V2_RATING_MIN;

                p.tournamentRating = Math.round(R_new * 100) / 100;

                if (isTarget && logData) {
                    logData.players.push({
                        id: pid,
                        name: p.name,
                        oldRating: R_old,
                        newRating: p.tournamentRating,
                        weight: W,
                        change: individualChange,
                        team: teamNum
                    });
                }
            };

            team1Ids.forEach(pid => updateV2Player(pid, TA, TeamChangeA, 1));
            team2Ids.forEach(pid => updateV2Player(pid, TB, TeamChangeB, 2));

            if (isTarget && logData) return logData;

        } else if (isTarget) {
            // Target match but not Rule 2.0
            return {
                teamA_Rating: 0, teamB_Rating: 0, diff: 0, expectedA: 0, scoreA: s1, scoreB: s2, marginFactor: 0, teamChangeA: 0, players: [], isRule2: false
            };
        } else {
            // Replay V1 Legacy
            const applyLegacy = (ids: string[], isWin: boolean) => {
                ids.forEach(pid => {
                    const p = playerMap.get(pid);
                    if (!p) return;
                    let currentRating = p.tournamentRating || p.initialPoints || 0;
                    if (isWin) {
                        currentRating += RATING_STEP_V1;
                        if (currentRating > MAX_RATING_V1) currentRating = MAX_RATING_V1;
                    } else {
                        if (currentRating > MIN_RATING_V1) {
                            currentRating -= RATING_STEP_V1;
                            if (currentRating < MIN_RATING_V1) currentRating = MIN_RATING_V1;
                        }
                    }
                    p.tournamentRating = Math.round(currentRating * 100) / 100;
                });
            };
            applyLegacy(team1Ids, isTeam1Winner);
            applyLegacy(team2Ids, !isTeam1Winner);
        }
    }

    return null;
};

// --- NEW FUNCTION: Get Daily Rating History ---
// Trả về lịch sử rating sau mỗi ngày có trận đấu
export const getDailyRatingHistory = (players: Player[], matches: Match[]) => {
    // 1. Reset Stats
    const playerMap = new Map<string, any>();
    players.forEach(p => {
        const baseRating = typeof p.initialPoints === 'number' ? p.initialPoints : 1000;
        playerMap.set(String(p.id), { ...p, tournamentRating: baseRating });
    });

    const getR = (pid: string) => {
        const p = playerMap.get(String(pid));
        return p ? (p.tournamentRating || 0) : 3.0;
    };

    const history: { date: string, ratings: Record<string, number> }[] = [];
    
    // Sort matches
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let currentDayStr = '';

    sortedMatches.forEach(match => {
        // --- PROCESS RATING UPDATE (Copy of calculatePlayerStats Logic) ---
        const matchDate = new Date(match.date);
        const dateStr = match.date.split('T')[0];
        
        let s1 = Number(match.score1);
        let s2 = Number(match.score2);
        if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
        if (s1 === s2) return; // Ignore draws

        let winner = s1 > s2 ? 1 : 2;
        const isTeam1Winner = winner === 1;
        const team1Ids = match.team1.map(String);
        const team2Ids = match.team2.map(String);

        const isRuleV2 = matchDate.getTime() >= RATING_RULE_2_DATE.getTime();
        const isLegacyV1 = matchDate.getTime() >= RATING_START_DATE.getTime() && !isRuleV2;

        if (isLegacyV1) {
            const applyLegacy = (ids: string[], isWin: boolean) => {
                ids.forEach(pid => {
                    const p = playerMap.get(String(pid));
                    if (!p) return;
                    let currentRating = p.tournamentRating || p.initialPoints || 0;
                    if (isWin) {
                        currentRating += RATING_STEP_V1;
                        if (currentRating > MAX_RATING_V1) currentRating = MAX_RATING_V1;
                    } else {
                        if (currentRating > MIN_RATING_V1) {
                            currentRating -= RATING_STEP_V1;
                            if (currentRating < MIN_RATING_V1) currentRating = MIN_RATING_V1;
                        }
                    }
                    p.tournamentRating = Math.round(currentRating * 100) / 100;
                });
            };
            applyLegacy(team1Ids, isTeam1Winner);
            applyLegacy(team2Ids, !isTeam1Winner);
        } else if (isRuleV2) {
            // Note: This block applies to ALL matches (Betting & Tournament) if they are in the array
            // Rule 2.0 covers all competitive play stored in 'matches'
            const getTeamRating = (ids: string[]) => {
                if (ids.length === 0) return 3.0;
                const sum = ids.reduce((acc, pid) => acc + getR(pid), 0);
                return sum / ids.length;
            };
            const TA = getTeamRating(team1Ids);
            const TB = getTeamRating(team2Ids);
            const Diff = TA - TB;
            const ExpectedA = 1 / (1 + Math.exp(-Diff / V2_TAU));
            const ResultA = isTeam1Winner ? 1 : 0;
            const ScoreDiff = Math.abs(s1 - s2);
            let MarginFactor = 1 + V2_ALPHA * ((ScoreDiff / V2_WIN_SCORE) - 0.25);
            if (MarginFactor < 0.85) MarginFactor = 0.85;
            if (MarginFactor > 1.20) MarginFactor = 1.20;
            let TeamChangeA = V2_K * (ResultA - ExpectedA) * MarginFactor;
            const TeamChangeB = -TeamChangeA;

            const updateV2Player = (pid: string, teamAvgRating: number, teamChange: number) => {
                const p = playerMap.get(String(pid));
                if (!p) return;
                const R_old = p.tournamentRating || p.initialPoints || 3.0;
                let teammateId = team1Ids.includes(pid) ? team1Ids.find(id => id !== pid) : team2Ids.find(id => id !== pid);
                let W = 1.0;
                if (teammateId) {
                    const R_partner = getR(teammateId);
                    const w_me = Math.exp(-V2_BETA * (R_old - teamAvgRating));
                    const w_partner = Math.exp(-V2_BETA * (R_partner - teamAvgRating));
                    W = w_me / (w_me + w_partner);
                }
                let change = W * teamChange;
                if (change > V2_MAX_CHANGE) change = V2_MAX_CHANGE;
                if (change < -V2_MAX_CHANGE) change = -V2_MAX_CHANGE;
                let R_new = R_old + change;
                if (R_new > V2_RATING_MAX) R_new = V2_RATING_MAX;
                if (R_new < V2_RATING_MIN) R_new = V2_RATING_MIN;
                p.tournamentRating = Math.round(R_new * 100) / 100;
            };
            team1Ids.forEach(pid => updateV2Player(pid, TA, TeamChangeA));
            team2Ids.forEach(pid => updateV2Player(pid, TB, TeamChangeB));
        }

        // --- SNAPSHOT END OF DAY ---
        // If the date changes, we push the snapshot of the *previous* day.
        // Or simpler: We always overwrite the entry for the current date.
        // We want one entry per date.
        
        // Find if we already have an entry for this date
        const existingEntryIndex = history.findIndex(h => h.date === dateStr);
        const currentSnapshot: Record<string, number> = {};
        playerMap.forEach((v, k) => {
            currentSnapshot[k] = v.tournamentRating;
        });

        if (existingEntryIndex >= 0) {
            // Update existing entry (it's the same day, so this is the "latest" rating for that day)
            history[existingEntryIndex].ratings = currentSnapshot;
        } else {
            // New day
            history.push({ date: dateStr, ratings: currentSnapshot });
        }
    });

    return history;
};


export const calculatePlayerStats = (players: Player[], matches: Match[]): Player[] => {
  // 1. Reset toàn bộ chỉ số về trạng thái ban đầu
  const resetPlayers = players.map(p => {
      // Logic mới: Điểm đấu hiện tại tương đương điểm gốc (Initial Points)
      const baseRating = typeof p.initialPoints === 'number' ? p.initialPoints : 1000;

      return {
        ...p,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsScored: 0,
        pointsConceded: 0,
        // Điểm tổng Betting bắt đầu từ 0 (Chỉ tính Net Profit)
        totalRankingPoints: 0,
        // Điểm giải đấu bắt đầu từ điểm gốc (không còn normalize về 6.0 nữa)
        tournamentRating: baseRating,
        // Reset Championships để tính toán lại từ đầu lịch sử
        championships: 0,
        // Preserve Status
        isActive: p.isActive !== undefined ? p.isActive : true
      };
  });

  const playerMap = new Map(resetPlayers.map(p => [String(p.id), p]));

  // 2. Duyệt qua từng trận đấu để cộng dồn chỉ số
  // Sắp xếp matches theo thời gian để tính điểm Rating lũy tiến đúng thứ tự
  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedMatches.forEach(match => {
    const matchDate = new Date(match.date);
    const isBetting = match.type === 'betting' || !match.type; 
    const bettingPoints = (isBetting && match.rankingPoints) ? Number(match.rankingPoints) : 0; 
    
    // --- XỬ LÝ ĐIỂM SỐ & WINNER ---
    // Ép kiểu số an toàn
    let s1 = Number(match.score1);
    let s2 = Number(match.score2);
    if (isNaN(s1)) s1 = 0;
    if (isNaN(s2)) s2 = 0;

    // --- LOGIC MỚI: BỎ QUA TRẬN HÒA (0-0) ---
    // Nếu tỉ số bằng nhau, coi như trận đấu chưa hoàn thành hoặc hòa, không tính vào thống kê.
    if (s1 === s2) {
        return; 
    }

    // Logic xác định winner dựa trên tỉ số (Rule mới yêu cầu dựa vào score)
    let winner: 1 | 2;
    if (s1 > s2) winner = 1;
    else if (s2 > s1) winner = 2;
    else winner = Number(match.winner) === 1 ? 1 : 2; // Fallback legacy if strictly needed, but equal score check above handles most

    const isTeam1Winner = winner === 1;

    // --- UPDATE THỐNG KÊ CƠ BẢN (Win/Loss/Score) ---
    const updateStats = (pid: string, isWinner: boolean, scoreFor: number, scoreAgainst: number) => {
        const p = playerMap.get(String(pid));
        if (!p) return;

        p.matchesPlayed += 1;
        p.pointsScored += Number(scoreFor) || 0;
        p.pointsConceded += Number(scoreAgainst) || 0;

        // 1. Logic Betting
        if (isWinner) {
            p.wins += 1;
            if (isBetting) p.totalRankingPoints += bettingPoints;
        } else {
            p.losses += 1;
            if (isBetting) p.totalRankingPoints -= bettingPoints;
        }
    };

    // Lọc trùng lặp người chơi
    const team1Ids = [...new Set(match.team1)];
    const team2Ids = [...new Set(match.team2)];

    team1Ids.forEach(pid => updateStats(pid, isTeam1Winner, s1, s2));
    team2Ids.forEach(pid => updateStats(pid, !isTeam1Winner, s2, s1));

    // --- LOGIC TÍNH ĐIỂM RATING ---
    
    // Check Date to determine Rule
    const isLegacyV1 = matchDate.getTime() >= RATING_START_DATE.getTime() && matchDate.getTime() < RATING_RULE_2_DATE.getTime();
    const isRuleV2 = matchDate.getTime() >= RATING_RULE_2_DATE.getTime();

    if (isLegacyV1) {
        // --- RULE 1.0: +/- 0.1 Fixed ---
        const applyLegacy = (ids: string[], isWin: boolean) => {
            ids.forEach(pid => {
                const p = playerMap.get(String(pid));
                if (!p) return;
                let currentRating = p.tournamentRating || p.initialPoints || 0;
                
                if (isWin) {
                    currentRating += RATING_STEP_V1;
                    if (currentRating > MAX_RATING_V1) currentRating = MAX_RATING_V1;
                } else {
                    if (currentRating > MIN_RATING_V1) {
                        currentRating -= RATING_STEP_V1;
                        if (currentRating < MIN_RATING_V1) currentRating = MIN_RATING_V1;
                    }
                }
                p.tournamentRating = Math.round(currentRating * 100) / 100;
            });
        };
        applyLegacy(team1Ids, isTeam1Winner);
        applyLegacy(team2Ids, !isTeam1Winner);

    } else if (isRuleV2) {
        // --- RULE 2.0: ELO CALCULATION ---
        // Chỉ áp dụng đánh đôi (2vs2). Nếu đánh đơn (1vs1) hoặc thiếu người, fallback về logic đơn giản hoặc bỏ qua.
        // Để linh hoạt, code này sẽ hỗ trợ đánh đơn như một trường hợp đặc biệt của đánh đôi (TeamRating = PlayerRating).
        
        // Helper lấy rating hiện tại
        const getR = (pid: string) => {
             const p = playerMap.get(String(pid));
             return p ? (p.tournamentRating || p.initialPoints || 3.0) : 3.0;
        };

        // STEP 1: Tính điểm đội (Trung bình cộng)
        const getTeamRating = (ids: string[]) => {
            if (ids.length === 0) return 3.0;
            const sum = ids.reduce((acc, pid) => acc + getR(pid), 0);
            return sum / ids.length;
        };

        const TA = getTeamRating(team1Ids);
        const TB = getTeamRating(team2Ids);
        const Diff = TA - TB;

        // STEP 2: Kỳ vọng thắng (Logistic Function)
        const ExpectedA = 1 / (1 + Math.exp(-Diff / V2_TAU));
        // const ExpectedB = 1 - ExpectedA;

        // STEP 3: Result Actual
        const ResultA = isTeam1Winner ? 1 : 0;
        
        // STEP 4: Margin Factor
        const ScoreDiff = Math.abs(s1 - s2);
        let MarginFactor = 1 + V2_ALPHA * ((ScoreDiff / V2_WIN_SCORE) - 0.25);
        // Clamp MarginFactor [0.85, 1.20]
        if (MarginFactor < 0.85) MarginFactor = 0.85;
        if (MarginFactor > 1.20) MarginFactor = 1.20;

        // STEP 5: Team Change Base
        let TeamChangeA = V2_K * (ResultA - ExpectedA) * MarginFactor;
        const TeamChangeB = -TeamChangeA;

        // STEP 6 & 7: Distribute & Update
        const updateV2Player = (pid: string, teamAvgRating: number, teamChange: number) => {
            const p = playerMap.get(String(pid));
            if (!p) return;
            
            const R_old = p.tournamentRating || p.initialPoints || 3.0;
            
            // Weight calculation: w = exp(-BETA * (R - TeamAvg))
            
            // Tìm đồng đội (hoặc chính mình nếu đánh đơn)
            let teammateId = team1Ids.includes(pid) 
                ? team1Ids.find(id => id !== pid) 
                : team2Ids.find(id => id !== pid);
            
            // Nếu đánh đơn hoặc không tìm thấy đồng đội, W = 1
            let W = 1.0;
            
            if (teammateId) {
                const R_partner = getR(teammateId);
                const w_me = Math.exp(-V2_BETA * (R_old - teamAvgRating));
                const w_partner = Math.exp(-V2_BETA * (R_partner - teamAvgRating));
                W = w_me / (w_me + w_partner);
            }

            let individualChange = W * teamChange;

            // STEP 8: Safety Limits
            // Max change per match +/- 0.14
            if (individualChange > V2_MAX_CHANGE) individualChange = V2_MAX_CHANGE;
            if (individualChange < -V2_MAX_CHANGE) individualChange = -V2_MAX_CHANGE;

            let R_new = R_old + individualChange;

            // Range Clamp [2.0, 6.0]
            if (R_new > V2_RATING_MAX) R_new = V2_RATING_MAX;
            if (R_new < V2_RATING_MIN) R_new = V2_RATING_MIN;

            p.tournamentRating = Math.round(R_new * 100) / 100;
        };

        team1Ids.forEach(pid => updateV2Player(pid, TA, TeamChangeA));
        team2Ids.forEach(pid => updateV2Player(pid, TB, TeamChangeB));
    }
  });


  // --- 3. AUTO-CALCULATE CHAMPIONSHIPS ---
  // A. Lọc và nhóm các trận Giải theo tháng
  const tournamentMatches = matches.filter(m => m.type === 'tournament');
  const matchesByMonth = new Map<string, Match[]>(); // Key: "YYYY-MM"

  tournamentMatches.forEach(m => {
      // Cũng bỏ qua các trận hòa trong tính giải
      if (Number(m.score1) === Number(m.score2)) return;

      const monthKey = m.date.slice(0, 7); // "2024-12"
      if (!matchesByMonth.has(monthKey)) matchesByMonth.set(monthKey, []);
      matchesByMonth.get(monthKey)!.push(m);
  });

  // B. Xử lý từng tháng để tìm nhà vô địch
  matchesByMonth.forEach((monthlyMatches, monthKey) => {
      const pairStats = new Map<string, PairWinStat>();
      const h2hMatrix = new Map<string, Map<string, number>>();
      const getPairId = (ids: string[]) => ids.map(String).sort().join('-');
      
      monthlyMatches.forEach(m => {
          if (m.team1.length < 2 || m.team2.length < 2) return; // Chỉ xét đánh đôi

          const pId1 = getPairId(m.team1);
          const pId2 = getPairId(m.team2);
          
          let s1 = Number(m.score1);
          let s2 = Number(m.score2);
          
          // Logic Winner derived from score
          let winner: 1 | 2;
          if (s1 > s2) winner = 1;
          else if (s2 > s1) winner = 2;
          else winner = Number(m.winner) === 1 ? 1 : 2;

          if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;

          if (!pairStats.has(pId1)) pairStats.set(pId1, { pairId: pId1, playerIds: m.team1, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });
          if (!pairStats.has(pId2)) pairStats.set(pId2, { pairId: pId2, playerIds: m.team2, wins: 0, losses: 0, pointsScored: 0, pointsConceded: 0 });

          if (!h2hMatrix.has(pId1)) h2hMatrix.set(pId1, new Map());
          if (!h2hMatrix.has(pId2)) h2hMatrix.set(pId2, new Map());

          const ps1 = pairStats.get(pId1)!;
          ps1.pointsScored += s1; ps1.pointsConceded += s2;
          if (winner === 1) ps1.wins++; else ps1.losses++;

          const ps2 = pairStats.get(pId2)!;
          ps2.pointsScored += s2; ps2.pointsConceded += s1;
          if (winner === 2) ps2.wins++; else ps2.losses++;

          const h2h1 = h2hMatrix.get(pId1)!.get(pId2) || 0;
          const h2h2 = h2hMatrix.get(pId2)!.get(pId1) || 0;
          if (winner === 1) {
              h2hMatrix.get(pId1)!.set(pId2, h2h1 + 1);
              h2hMatrix.get(pId2)!.set(pId1, h2h2 - 1);
          } else {
              h2hMatrix.get(pId1)!.set(pId2, h2h1 - 1);
              h2hMatrix.get(pId2)!.set(pId1, h2h2 + 1);
          }
      });

      const sortedPairs = Array.from(pairStats.values())
        .filter(p => (p.wins + p.losses) > 0)
        .sort((a, b) => {
            const netA = a.wins - a.losses;
            const netB = b.wins - b.losses;
            if (netA !== netB) return netB - netA;
            const h2h = h2hMatrix.get(a.pairId)?.get(b.pairId) || 0;
            if (h2h !== 0) return -h2h;
            const pDiffA = a.pointsScored - a.pointsConceded;
            const pDiffB = b.pointsScored - b.pointsConceded;
            if (pDiffA !== pDiffB) return pDiffB - pDiffA;
            return b.pointsScored - a.pointsScored;
        });

      if (sortedPairs.length > 0) {
          const championPair = sortedPairs[0];
          championPair.playerIds.forEach(pid => {
              const p = playerMap.get(String(pid));
              if (p) {
                  p.championships = (p.championships || 0) + 1;
              }
          });
      }
  });

  return Array.from(playerMap.values());
};