const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

const triggerStr = `
    // --- PRE-CALCULATE TOURNAMENT TRIGGERS ---
    const tournamentEndTriggers = new Set<string>();
    const tournamentMatchesByMonth = new Map<string, Match[]>();
    sortedMatches.forEach(m => {
        if (m.type === 'tournament' || m.type === 'tour') {
            const month = m.date.slice(0, 7);
            if (!tournamentMatchesByMonth.has(month)) tournamentMatchesByMonth.set(month, []);
            tournamentMatchesByMonth.get(month)!.push(m);
        }
    });
    tournamentMatchesByMonth.forEach((list) => {
        if (list.length > 0) tournamentEndTriggers.add(list[list.length - 1].id);
    });
`;

code = code.replace(/    const sortedMatches = \[\.\.\.matches\]\.sort\(\(a, b\) => new Date\(a\.date\)\.getTime\(\) - new Date\(b\.date\)\.getTime\(\)\);\n  \/\/ Function to snapshot/g, 
    \`    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());\n\${triggerStr}\n    // Function to snapshot\`);

code = code.replace(/    const sortedMatches = \[\.\.\.matches\]\.sort\(\(a, b\) => new Date\(a\.date\)\.getTime\(\) - new Date\(b\.date\)\.getTime\(\)\);\n  for \(const match of sortedMatches\) \{/g, 
    \`    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());\n\${triggerStr}\n    for (const match of sortedMatches) {\`);

// For getMatchRatingDetails
code = code.replace(/    const sortedMatches = \[\.\.\.matches\]\.sort\(\(a, b\) => new Date\(a\.date\)\.getTime\(\) - new Date\(b\.date\)\.getTime\(\)\);\n\n    \/\/ 3\. Find target match index/g,
    \`    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());\n\${triggerStr}\n    // 3. Find target match index\`);


const applyStr1 = `
        if (tournamentEndTriggers.has(match.id)) {
            const month = match.date.slice(0, 7);
            const tourMatches = tournamentMatchesByMonth.get(month) || [];
            calculateAndApplyMonthlyBonuses(month, tourMatches, playerMap);
        }
`;

code = code.replace(/        \/\/ C\. Snapshot after every match/g, \`\${applyStr1}\n        // C. Snapshot after every match\`);

code = code.replace(/        takeSnapshot\(matchDate\);\n    \}\n\n    return history;/g, \`\${applyStr1}\n        takeSnapshot(matchDate);\n    }\n\n    return history;\`);

// Need to handle getPlayerRatingHistory which doesn't have takeSnapshot
code = code.replace(/             \}\n        \} else if \(isEligible\) \{\n             \/\/ V1 Logic Simplified/g, 
    \`             }\n        } else if (isEligible) {\n             // V1 Logic Simplified\`);

const applyStr2 = `
        if (tournamentEndTriggers.has(match.id)) {
            const month = match.date.slice(0, 7);
            const tourMatches = tournamentMatchesByMonth.get(month) || [];
            calculateAndApplyMonthlyBonuses(month, tourMatches, playerMap);
        }
`;
// We will replace the end of loop in getPlayerRatingHistory
code = code.replace(/             pendingUpdates\.forEach\(\(newR, pid\) => setR\(pid, newR\)\);\n        \}\n    \}\n\n    return history;/g,
    \`             pendingUpdates.forEach((newR, pid) => setR(pid, newR));\n        }\n\${applyStr2}\n    }\n\n    return history;\`);

// For applyBonusSim in getMatchRatingDetails
const applyBonusSimStr = `
    const applyBonusSim = (month: string) => {
        const tourMatches = tournamentMatchesByMonth.get(month) || [];
        const standings = calculateStandings(tourMatches);
        if (standings.length < 3) return;
        
        const hasEligible = tourMatches.some(m => new Date(m.date).getTime() >= RATING_START_DATE.getTime());
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
    };
`;
// We need to insert it in getMatchRatingDetails
code = code.replace(/    \/\/ 4\. Simulate ALL matches BEFORE the target match to get the "Old Ratings"\n    \/\/ Also need to account for monthly bonuses in the simulation to be accurate/g,
    \`    // 4. Simulate ALL matches BEFORE the target match to get the "Old Ratings"
    // Also need to account for monthly bonuses in the simulation to be accurate\n\${applyBonusSimStr}\`);

code = code.replace(/            \}\n        \}\n    \}\n\n    \/\/ 5\. Calculate Details for TARGET Match/g,
    \`            }\n        }\n        if (tournamentEndTriggers.has(m.id)) {\n            applyBonusSim(m.date.slice(0, 7));\n        }\n    }\n\n    // 5. Calculate Details for TARGET Match\`);


fs.writeFileSync('services/storageService.ts', code);
