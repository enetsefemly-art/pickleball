const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

// 1. Add takeSnapshot definition in calculatePlayerStats
// We need to inject it before `const processedMonths = new Set<string>();` if it's there.
// Let's find where calculatePlayerStats loop begins.

code = code.replace(/    \/\/ 2\. Loop/g, `
    // Function to snapshot
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
    
    // 2. Loop`);

// 2. Fix `processedMonths` in getMatchRatingDetails.
// In fix-month3.cjs, I did this:
/*
    const processedMonths = new Set<string>();

    for (let i = 0; i < targetMatchIndex; i++) {
*/
// But wait, the regex was replacing `for (let i = 0; i < targetMatchIndex; i++) {`
// Let's check where `processedMonths` is in getMatchRatingDetails.

fs.writeFileSync('services/storageService.ts', code);
