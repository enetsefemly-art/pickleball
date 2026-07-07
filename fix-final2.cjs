const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

// 1. Add takeSnapshot before the `for (let i = 0; i < sortedMatches.length; i++) {` in calculatePlayerStats
// calculatePlayerStats starts with:
/*
export const calculatePlayerStats = (
  players: Player[],
  matches: Match[]
): Player[] => {
*/
// It's the first `for (let i = 0; i < sortedMatches.length; i++) {` in the file.

let firstLoopIndex = code.indexOf('for (let i = 0; i < sortedMatches.length; i++) {');

let takeSnapshotCode = `
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
    
    `;
    
code = code.slice(0, firstLoopIndex) + takeSnapshotCode + code.slice(firstLoopIndex);

// But wait, what if `const processedMonths = new Set<string>();` is already right before it?
// Let's just remove ALL instances of `const processedMonths = new Set<string>();` BEFORE `takeSnapshotCode` injection for the first one, or just clean it up.

code = code.replace(/    const processedMonths = new Set<string>\(\);\n\n    \/\/ 2\. Loop/g, '    // 2. Loop');

// 2. Add processedMonths to getMatchRatingDetails before targetMatchIndex loop
let targetMatchIndexStr = 'for (let i = 0; i < targetMatchIndex; i++) {';
let targetLoopIndex = code.indexOf(targetMatchIndexStr);

code = code.slice(0, targetLoopIndex) + `const processedMonths = new Set<string>();\n    ` + code.slice(targetLoopIndex);

fs.writeFileSync('services/storageService.ts', code);
