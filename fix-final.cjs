const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

// 1. Remove takeSnapshot from getPlayerRatingHistory (lines around 693)
// We just remove the takeSnapshot definition inside getPlayerRatingHistory.
code = code.replace(/    \/\/ Function to snapshot\n    const takeSnapshot = \(date: string\) => \{\n        const snapshot: Record<string, number> = \{\};\n        playerMap\.forEach\(p => \{\n            snapshot\[p\.id\] = p\.tournamentRating \|\| 3\.0;\n        \}\);\n        const existing = history\.find\(h => h\.date === date\);\n        if \(existing\) \{\n            existing\.ratings = snapshot;\n        \} else \{\n            history\.push\(\{ date, ratings: snapshot \}\);\n        \}\n    \};\n/g, '');

// 2. Fix TS2532: Object is possibly 'undefined' in getPlayerRatingHistory
// This happens at `roundRobinMatchesByMonth.get(month)!.push(m);` wait, I used `!` but TS complains? No, maybe it's `roundRobinMatchesByMonth.get(month).push(m)` without `!`.
code = code.replace(/roundRobinMatchesByMonth\.get\(month\)\.push\(m\);/g, 'roundRobinMatchesByMonth.get(month)!.push(m);');
code = code.replace(/tourMatchesByMonth\.get\(month\)\.push\(m\);/g, 'tourMatchesByMonth.get(month)!.push(m);');


// 3. Fix TS2554 and TS2552 in getMatchRatingDetails
// Where I call applyBonusSim(month), it seems applyBonusSim was declared as `const applyBonusSim = (month: string, type: string)` maybe?
// Wait, I replaced it! Let's just redefine processedMonths before the loop if it's missing.
code = code.replace(/    \/\/ 4\. Simulate ALL matches BEFORE the target match to get the "Old Ratings"\n    \/\/ Also need to account for monthly bonuses in the simulation to be accurate\n    for/g, `    const processedMonths = new Set<string>();\n\n    // 4. Simulate ALL matches BEFORE the target match to get the "Old Ratings"\n    // Also need to account for monthly bonuses in the simulation to be accurate\n    for`);

// Ensure applyBonusSim takes 1 argument
code = code.replace(/const applyBonusSim = \(month: string, type: string\) => \{/g, `const applyBonusSim = (month: string) => {`);

fs.writeFileSync('services/storageService.ts', code);
