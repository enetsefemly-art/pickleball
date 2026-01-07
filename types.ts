
export interface Player {
  id: string;
  name: string;
  avatar?: string; 
  initialPoints?: number; 
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsScored: number;
  pointsConceded: number;
  totalRankingPoints: number; 
  tournamentRating?: number; 
  championships?: number; 
  isActive?: boolean; 
}

export interface Match {
  id: string;
  type: 'betting' | 'tournament'; 
  date: string; 
  team1: string[]; 
  team2: string[]; 
  score1: number;
  score2: number;
  winner: 1 | 2; 
  rankingPoints?: number; 
}

export interface TournamentBonus {
  tournamentId: string; // "YYYY-MM"
  teamId: string; // Sorted IDs "p1-p2"
  playerId: string;
  finalPlace: number; // 1, 2, 3
  teamCount: number; // N
  scaleFactor: number; // S
  baseBonus: number;
  placementBonus: number;
  ratingBefore: number;
  ratingAfter: number;
  timestamp: string;
  reason: string; // "tournament_placement_bonus"
}

export type TabView = 'dashboard' | 'matches' | 'leaderboard' | 'players' | 'analysis' | 'ai-match';

export interface MonthlyStat {
  month: string;
  matches: number;
}

// --- TOURNAMENT TYPES ---
export interface Team {
  id: string;
  name: string;
  player1: Player | null;
  player2: Player | null;
}

export interface TournamentMatch {
  id: string;
  team1Id: string;
  team2Id: string;
  court: 1 | 2;
  roundNumber: number; // This is the "Official Round Robin Round"
  displayTurn?: number; // This is the visual "Turn" (Lượt đấu)
  score1: number | '';
  score2: number | '';
  isCompleted: boolean;
  matchId?: string; 
}

export interface TournamentState {
    isActive: boolean;
    teams: Team[];
    schedule: TournamentMatch[];
    tournamentDate: string; // ISO String
}