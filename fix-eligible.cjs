const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

code = code.replace(/    const hasEligibleMatches = monthMatches\.some\(m => new Date\(m\.date\)\.getTime\(\) >= RATING_START_DATE\.getTime\(\)\);\n    \n    const N/g, "    const N");
code = code.replace(/                if \(hasEligibleMatches\) \{\n                    const currentRating/g, "                {\n                    const currentRating");

code = code.replace(/            const hasEligible = tMatches\.some\(m => new Date\(m\.date\)\.getTime\(\) >= RATING_START_DATE\.getTime\(\)\);\n            if \(!hasEligible\) return;\n\n            const N/g, "            const N");

fs.writeFileSync('services/storageService.ts', code);
