const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

const regex1 = /    \/\/ --- PRE-CALCULATE TOURNAMENT TRIGGERS ---[\s\S]*?    for \(let i = 0; i < sortedMatches\.length; i\+\+\) \{/g;

const replacement1 = `    // --- PRE-CALCULATE TOURNAMENT TRIGGERS ---
    const roundRobinMatchesByMonth = new Map<string, Match[]>();
    
    sortedMatches.forEach(m => {
        const month = m.date.slice(0, 7);
        if (m.type === 'tournament') {
            if (!roundRobinMatchesByMonth.has(month)) roundRobinMatchesByMonth.set(month, []);
            roundRobinMatchesByMonth.get(month)!.push(m);
        }
    });

    const processedMonths = new Set<string>();

    // 2. Loop
    for (let i = 0; i < sortedMatches.length; i++) {`;

code = code.replace(regex1, replacement1);

const regex2 = /        \/\/ Apply BONUS immediately if this is the last tournament match[\s\S]*?        \}\n    \}\n\n    return history;\n\};\n\n\/\/ IMPLEMENTED/g;

const replacement2 = `        // Apply BONUS immediately if this is the last match of the month
        const nextMatch = sortedMatches[i + 1];
        if (!nextMatch || nextMatch.date.slice(0, 7) !== match.date.slice(0, 7)) {
            const month = match.date.slice(0, 7);
            const rMatches = roundRobinMatchesByMonth.get(month) || [];
            applyRoundRobinBonuses(month, rMatches, playerMap);
            applyTourBonuses(month, playerMap);
            processedMonths.add(month);
        }
    }

    // Apply bonuses for months that had NO matches but have cups
    const unprocessedMonths = new Set<string>();
    players.forEach(p => {
        if (p.trophies) p.trophies.forEach(t => {
            if (!processedMonths.has(t.month)) unprocessedMonths.add(t.month);
        });
    });
    Array.from(unprocessedMonths).sort().forEach(month => {
        applyTourBonuses(month, playerMap);
    });

    return history;
};

// IMPLEMENTED`;

code = code.replace(regex2, replacement2);

fs.writeFileSync('services/storageService.ts', code);
