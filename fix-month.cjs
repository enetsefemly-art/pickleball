const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

const regex1 = /    \/\/ --- PRE-CALCULATE TOURNAMENT TRIGGERS ---[\s\S]*?    for \(const match of sortedMatches\) \{/g;

const replacement1 = `    // --- PRE-CALCULATE TOURNAMENT TRIGGERS ---
    const roundRobinMatchesByMonth = new Map<string, Match[]>();
    
    sortedMatches.forEach(m => {
        const month = m.date.slice(0, 7);
        if (m.type === 'tournament') {
            if (!roundRobinMatchesByMonth.has(month)) roundRobinMatchesByMonth.set(month, []);
            roundRobinMatchesByMonth.get(month)!.push(m);
        }
    });

    // Function to snapshot
    const takeSnapshot = (date: string) => {
        const snapshot: Record<string, number> = {};
        playerMap.forEach(p => {
            snapshot[p.id] = p.tournamentRating || 3.0;
        });
        
        // If snapshot for this date already exists, update it (last state of day)
        const existing = history.find(h => h.date === date);
        if (existing) {
            existing.ratings = snapshot;
        } else {
            history.push({ date, ratings: snapshot });
        }
    };

    const processedMonths = new Set<string>();

    // 2. Loop
    for (let i = 0; i < sortedMatches.length; i++) {
        const match = sortedMatches[i];`;

code = code.replace(regex1, replacement1);

// Now replace the end of the loop
const regex2 = /        \/\/ Apply BONUS immediately if this is the last tournament match[\s\S]*?        takeSnapshot\(matchDate\);\n    \}\n\n    return history;/g;

const replacement2 = `        // C. Snapshot after every match
        takeSnapshot(matchDate);

        // Apply BONUS immediately if this is the last match of the month
        const nextMatch = sortedMatches[i + 1];
        if (!nextMatch || nextMatch.date.slice(0, 7) !== match.date.slice(0, 7)) {
            const month = match.date.slice(0, 7);
            const rMatches = roundRobinMatchesByMonth.get(month) || [];
            applyRoundRobinBonuses(month, rMatches, playerMap);
            applyTourBonuses(month, playerMap);
            processedMonths.add(month);
            // Snapshot again after bonuses
            takeSnapshot(matchDate);
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
        takeSnapshot(month + '-28'); // Arbitrary date for snapshot
    });

    return history;`;

code = code.replace(regex2, replacement2);

fs.writeFileSync('services/storageService.ts', code);
