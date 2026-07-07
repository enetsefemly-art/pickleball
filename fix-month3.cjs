const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

const regex1 = /    \/\/ --- PRE-CALCULATE TOURNAMENT TRIGGERS ---[\s\S]*?    for \(let i = 0; i < targetMatchIndex; i\+\+\) \{/g;

const replacement1 = `    // --- PRE-CALCULATE TOURNAMENT TRIGGERS ---
    const roundRobinMatchesByMonth = new Map<string, Match[]>();
    
    sortedMatches.forEach(m => {
        const month = m.date.slice(0, 7);
        if (m.type === 'tournament') {
            if (!roundRobinMatchesByMonth.has(month)) roundRobinMatchesByMonth.set(month, []);
            roundRobinMatchesByMonth.get(month).push(m);
        }
    });

    const applyBonusSim = (month: string) => {
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

    // 4. Simulate ALL matches BEFORE the target match to get the "Old Ratings"
    // Also need to account for monthly bonuses in the simulation to be accurate
    const processedMonths = new Set<string>();

    for (let i = 0; i < targetMatchIndex; i++) {`;

code = code.replace(regex1, replacement1);

const regex2 = /        \/\/ --- APPLY BONUS IF TRIGGER HIT ---[\s\S]*?        \}\n    \}\n\n    \/\/ 5\. Calculate Details for TARGET Match/g;

const replacement2 = `        // --- APPLY BONUS IF TRIGGER HIT ---
        const nextMatch = sortedMatches[i + 1];
        if (!nextMatch || nextMatch.date.slice(0, 7) !== m.date.slice(0, 7)) {
            const month = m.date.slice(0, 7);
            applyBonusSim(month);
            processedMonths.add(month);
        }
    }

    // Apply bonuses for months that had NO matches but have cups BEFORE targetMatch
    const targetMonth = targetMatch.date.slice(0, 7);
    const unprocessedMonths = new Set<string>();
    players.forEach(p => {
        if (p.trophies) p.trophies.forEach(t => {
            if (!processedMonths.has(t.month) && t.month < targetMonth) unprocessedMonths.add(t.month);
        });
    });
    Array.from(unprocessedMonths).sort().forEach(month => {
        applyBonusSim(month);
    });

    // 5. Calculate Details for TARGET Match`;

code = code.replace(regex2, replacement2);

fs.writeFileSync('services/storageService.ts', code);
