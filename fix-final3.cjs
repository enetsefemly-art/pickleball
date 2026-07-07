const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

// There are multiple `const processedMonths = new Set<string>();` inside calculatePlayerStats probably because my script appended it and the regex didn't remove the old one.
// Let's just find and replace all but the first.

let idx1 = code.indexOf('const processedMonths = new Set<string>();');
if (idx1 !== -1) {
    let nextIdx;
    while ((nextIdx = code.indexOf('const processedMonths = new Set<string>();', idx1 + 1)) !== -1) {
        // Only replace if it's within the same function scope roughly, wait, `getPlayerRatingHistory` ALSO has one!
        // Let's manually replace `const processedMonths = new Set<string>();` around line 534 and 553.
        // Actually, just sed it. Let's write code safely.
        break;
    }
}
