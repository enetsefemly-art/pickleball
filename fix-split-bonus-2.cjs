const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

const replacement = `
const applyRoundRobinBonuses = (
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

const applyTourBonuses = (
    monthKey: string, 
    playerMap: Map<string, Player>
) => {
    playerMap.forEach(p => {
        // If the player has a cup (any cup) for this month, they get +0.1
        // The user says "Điểm cộng thêm 0.1 cho tất cả những người có dữ liệu cup của tháng trong bộ sưu tập cúp."
        if (p.trophies && p.trophies.some(t => t.month === monthKey)) {
            const currentRating = p.tournamentRating || 3.0;
            const updatedRating = Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, currentRating + 0.1));
            p.tournamentRating = Math.round(updatedRating * 10000) / 10000;
        }
    });
};
`;

code = code.replace(/const calculateAndApplyMonthlyBonuses = \([\s\S]*?p\.tournamentRating = Math\.round\(updatedRating \* 10000\) \/ 10000;\n                \}\n            \}\n        \}\);\n    \}\);\n\};\n/m, replacement);

// Replace calls
code = code.replace(/calculateAndApplyMonthlyBonuses\(month, rMatches, playerMap\);/g, "applyRoundRobinBonuses(month, rMatches, playerMap);");
code = code.replace(/calculateAndApplyMonthlyBonuses\(month, tMatches, playerMap\);/g, "applyTourBonuses(month, playerMap);");

// Replace applyBonusSim logic
const simReplacement = `
    const applyBonusSim = (month: string, type: string) => {
        if (type === 'tournament') {
            const tMatches = roundRobinMatchesByMonth.get(month) || [];
            const standings = calculateStandings(tMatches);
            if (standings.length < 3) return;
            
            const hasEligible = tMatches.some(m => new Date(m.date).getTime() >= RATING_START_DATE.getTime());
            if (!hasEligible) return;

            const N = standings.length;
            const S = 1 + 0.10 * (N - 5);
            const baseBonuses: Record<number, number> = { 1: 0.10, 2: 0.07, 3: 0.05 };

            standings.slice(0, 3).forEach((team, idx) => {
                const place = idx + 1;
                const rawBonus = baseBonuses[place] * S;
                const bonus = Math.min(0.15, Math.round(rawBonus * 100) / 100);
                
                team.playerIds.forEach(pid => {
                    const cur = tempPlayerMap.get(String(pid)) || 3.0;
                    tempPlayerMap.set(String(pid), Math.round(Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, cur + bonus)) * 10000) / 10000);
                });
            });
        } else if (type === 'tour') {
            players.forEach(p => {
                if (p.trophies && p.trophies.some(t => t.month === month)) {
                    const cur = tempPlayerMap.get(String(p.id)) || 3.0;
                    tempPlayerMap.set(String(p.id), Math.round(Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, cur + 0.1)) * 10000) / 10000);
                }
            });
        }
    };
`;

code = code.replace(/    const applyBonusSim = \([\s\S]*?\}\);\n    \};\n/m, simReplacement);

fs.writeFileSync('services/storageService.ts', code);
