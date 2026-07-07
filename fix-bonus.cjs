const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

const bonusFunc = `
// Helper: Calculate bonuses for a specific month based on matches
const calculateAndApplyMonthlyBonuses = (
    _monthKey: string, 
    monthMatches: Match[], 
    playerMap: Map<string, Player>
) => {
    // 1. Calculate standings using ALL matches for this month (for Cups)
    const finalStandings = calculateStandings(monthMatches);

    // FIX: Award Cup to #1 regardless of team count (if there is a winner)
    if (finalStandings.length > 0) {
        const championTeam = finalStandings[0];
        championTeam.playerIds.forEach(pid => {
            const p = playerMap.get(String(pid));
            if (p) {
                p.championships = (p.championships || 0) + 1;
            }
        });
    }

    // 2. Check if this month is eligible for RATING updates (on or after Start Date)
    // Bonus Rating Points (Top 3) strictly require >= 3 teams
    if (finalStandings.length < 3) return;

    const hasEligibleMatches = monthMatches.some(m => new Date(m.date).getTime() >= RATING_START_DATE.getTime());
    
    const N = finalStandings.length;
    const S = 1 + 0.10 * (N - 5);
    const baseBonuses: Record<number, number> = { 1: 0.10, 2: 0.07, 3: 0.05 };

    finalStandings.slice(0, 3).forEach((team, idx) => {
        const place = idx + 1;
        const baseBonus = baseBonuses[place];
        const rawBonus = baseBonus * S;
        const placementBonus = Math.min(0.15, Math.round(rawBonus * 100) / 100);

        team.playerIds.forEach(pid => {
            const p = playerMap.get(String(pid));
            if (p) {
                if (hasEligibleMatches) {
                    const currentRating = p.tournamentRating || 3.0;
                    const updatedRating = Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, currentRating + placementBonus));
                    p.tournamentRating = Math.round(updatedRating * 10000) / 10000;
                }
            }
        });
    });
};
`;

code = code.replace(/export const calculatePlayerStats = \(/, bonusFunc + '\nexport const calculatePlayerStats = (');
fs.writeFileSync('services/storageService.ts', code);
