const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

const replacement1 = `
    // --- PRE-CALCULATE TOURNAMENT TRIGGERS ---
    const roundRobinEndTriggers = new Set<string>();
    const roundRobinMatchesByMonth = new Map<string, Match[]>();
    
    const tourEndTriggers = new Set<string>();
    const tourMatchesByMonth = new Map<string, Match[]>();

    sortedMatches.forEach(m => {
        const month = m.date.slice(0, 7);
        if (m.type === 'tournament') {
            if (!roundRobinMatchesByMonth.has(month)) roundRobinMatchesByMonth.set(month, []);
            roundRobinMatchesByMonth.get(month).push(m);
        } else if (m.type === 'tour') {
            if (!tourMatchesByMonth.has(month)) tourMatchesByMonth.set(month, []);
            tourMatchesByMonth.get(month).push(m);
        }
    });

    roundRobinMatchesByMonth.forEach((list) => {
        if (list.length > 0) roundRobinEndTriggers.add(list[list.length - 1].id);
    });
    
    tourMatchesByMonth.forEach((list) => {
        if (list.length > 0) tourEndTriggers.add(list[list.length - 1].id);
    });
`;

code = code.replace(/    \/\/ --- PRE-CALCULATE TOURNAMENT TRIGGERS ---[\s\S]*?tournamentEndTriggers\.add\(list\[list\.length - 1\]\.id\);\n        \}\n    \}\);\n/g, replacement1);

const replacement2 = `
        // Apply BONUS immediately if this is the last tournament match
        if (roundRobinEndTriggers.has(match.id)) {
            const month = match.date.slice(0, 7);
            const rMatches = roundRobinMatchesByMonth.get(month) || [];
            calculateAndApplyMonthlyBonuses(month, rMatches, playerMap);
        }
        if (tourEndTriggers.has(match.id)) {
            const month = match.date.slice(0, 7);
            const tMatches = tourMatchesByMonth.get(month) || [];
            calculateAndApplyMonthlyBonuses(month, tMatches, playerMap);
        }
`;

code = code.replace(/        \/\/ Apply BONUS immediately if this is the last tournament match\n        if \(tournamentEndTriggers\.has\(match\.id\)\) \{\n            const month = match\.date\.slice\(0, 7\);\n            const tourMatches = tournamentMatchesByMonth\.get\(month\) \|\| \[\];\n            calculateAndApplyMonthlyBonuses\(month, tourMatches, playerMap\);\n        \}\n/g, replacement2);

// Same for the simulation helper
const replacement3 = `
    const applyBonusSim = (month: string, type: string) => {
        const tMatches = (type === 'tournament' ? roundRobinMatchesByMonth.get(month) : tourMatchesByMonth.get(month)) || [];
        const standings = calculateStandings(tMatches);
        if (standings.length < 3) return;
        
        const hasEligible = tMatches.some(m => new Date(m.date).getTime() >= RATING_START_DATE.getTime());
        if (!hasEligible) return;

        const N = standings.length;
        const S = 1 + 0.10 * (N - 5);
        const baseBonuses = { 1: 0.10, 2: 0.07, 3: 0.05 };

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

code = code.replace(/    const applyBonusSim = \([\s\S]*?\}\);\n        \}\);\n    \};\n/g, replacement3);

const replacement4 = `
        if (roundRobinEndTriggers.has(m.id)) {
            applyBonusSim(m.date.slice(0, 7), 'tournament');
        }
        if (tourEndTriggers.has(m.id)) {
            applyBonusSim(m.date.slice(0, 7), 'tour');
        }
`;

code = code.replace(/        if \(tournamentEndTriggers\.has\(m\.id\)\) \{\n            applyBonusSim\(m\.date\.slice\(0, 7\)\);\n        \}\n/g, replacement4);

fs.writeFileSync('services/storageService.ts', code);
