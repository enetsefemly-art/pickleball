const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

const replacement = `
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

    // 4. Simulate ALL matches BEFORE the target match to get the "Old Ratings"
`;

code = code.replace(/    \/\/ 4\. Simulate ALL matches BEFORE the target match to get the "Old Ratings"\n/m, replacement);

const replacement2 = `
        if (roundRobinEndTriggers.has(m.id)) {
            applyBonusSim(m.date.slice(0, 7), 'tournament');
        }
        if (tourEndTriggers.has(m.id)) {
            applyBonusSim(m.date.slice(0, 7), 'tour');
        }
    }

    // 5. Calculate Details for TARGET Match
`;

code = code.replace(/    \}\n\n    \/\/ 5\. Calculate Details for TARGET Match\n/m, replacement2);

fs.writeFileSync('services/storageService.ts', code);
