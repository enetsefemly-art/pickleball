const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

// The `calculatePlayerStats` function starts with `export const calculatePlayerStats` and ends with `return Array.from(playerMap.values());\n};`
// We need to inject the bonus logic in `calculatePlayerStats` loop.

// First, find the beginning of calculatePlayerStats:
const matchStr1 = "  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());\n\n  for (const match of sortedMatches) {";
const replaceStr1 = `  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // --- PRE-CALCULATE TOURNAMENT TRIGGERS ---
  const roundRobinMatchesByMonth = new Map<string, Match[]>();
  
  sortedMatches.forEach(m => {
      const month = m.date.slice(0, 7);
      if (m.type === 'tournament') {
          if (!roundRobinMatchesByMonth.has(month)) roundRobinMatchesByMonth.set(month, []);
          roundRobinMatchesByMonth.get(month)!.push(m);
      }
  });

  const processedMonths = new Set<string>();

  for (let i = 0; i < sortedMatches.length; i++) {
    const match = sortedMatches[i];`;

code = code.replace(matchStr1, replaceStr1);

// Now for the end of the loop:
const matchStr2 = "    // Apply updates\n        pendingUpdates.forEach((change, pid) => {\n            const p = playerMap.get(pid);\n            if (p) {\n                const R_old = p.tournamentRating || 3.0;\n                // Use 4 decimal places for storage\n                p.tournamentRating = Math.round(Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, R_old + change)) * 10000) / 10000;\n            }\n        });\n    }\n  }\n\n  return Array.from(playerMap.values());";

const replaceStr2 = `    // Apply updates
        pendingUpdates.forEach((change, pid) => {
            const p = playerMap.get(pid);
            if (p) {
                const R_old = p.tournamentRating || 3.0;
                // Use 4 decimal places for storage
                p.tournamentRating = Math.round(Math.min(V2_RATING_MAX, Math.max(V2_RATING_MIN, R_old + change)) * 10000) / 10000;
            }
        });
    }

    // Apply BONUS immediately if this is the last match of the month
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

  return Array.from(playerMap.values());`;

code = code.replace(matchStr2, replaceStr2);

fs.writeFileSync('services/storageService.ts', code);
