const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

// Replace the entire applyBonusSim function in getMatchRatingDetails
code = code.replace(/    const applyBonusSim = \(month: string\) => \{[\s\S]*?        \} else if \(type === 'tour'\) \{[\s\S]*?        \}\n    \};\n/g, `    const applyBonusSim = (month: string) => {
        const tMatches = roundRobinMatchesByMonth.get(month) || [];
        const standings = calculateStandings(tMatches);
        if (standings.length >= 3) {
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
        }
        players.forEach(p => {
            if (p.trophies && p.trophies.some(t => t.month === month)) {
                const cur = tempPlayerMap.get(String(p.id)) || 3.0;
                tempPlayerMap.set(String(p.id), Math.round(Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, cur + 0.1)) * 10000) / 10000);
            }
        });
    };
`);

// 2. We need to add takeSnapshot back to calculatePlayerStats
// calculatePlayerStats starts around line 510.
// Let's locate:
/*
    const processedMonths = new Set<string>();

    // 2. Loop
    for (let i = 0; i < sortedMatches.length; i++) {
*/
// The first occurrence of `const processedMonths = new Set<string>();` is in calculatePlayerStats.

code = code.replace(/    const processedMonths = new Set<string>\(\);\n\n    \/\/ 2\. Loop\n    for \(let i = 0; i < sortedMatches\.length; i\+\+\) \{/g, `    // Function to snapshot
    const takeSnapshot = (date: string) => {
        const snapshot: Record<string, number> = {};
        playerMap.forEach(p => {
            snapshot[p.id] = p.tournamentRating || 3.0;
        });
        const existing = history.find(h => h.date === date);
        if (existing) {
            existing.ratings = snapshot;
        } else {
            history.push({ date, ratings: snapshot });
        }
    };

    const processedMonths = new Set<string>();

    // 2. Loop
    for (let i = 0; i < sortedMatches.length; i++) {`);

fs.writeFileSync('services/storageService.ts', code);
