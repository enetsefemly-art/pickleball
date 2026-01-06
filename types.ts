
export interface Player {
  id: string;
  name: string;
  avatar?: string; // URL or Initials
  initialPoints?: number; // Starting points (handicap or previous season)
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsScored: number;
  pointsConceded: number;
  totalRankingPoints: number; // Cumulative points (initial + earned) for Betting
  tournamentRating?: number; // Dynamic Skill Rating (2.0 - 8.0) for Tournament
  championships?: number; // Number of tournament wins
  isActive?: boolean; // Active status for filtering
}

export interface Match {
  id: string;
  type: 'betting' | 'tournament'; // New field: Kèo vs Giải
  date: string; // ISO String
  team1: string[]; // Array of Player IDs
  team2: string[]; // Array of Player IDs
  score1: number;
  score2: number;
  winner: 1 | 2; // Team 1 or Team 2
  rankingPoints?: number; // Custom points awarded for this match (usually to winner)
}

export type TabView = 'dashboard' | 'matches' | 'leaderboard' | 'players' | 'analysis' | 'ai-match';

export interface MonthlyStat {
  month: string;
  matches: number;
}