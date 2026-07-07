const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

// Replace step *= 2 in applyLegacy
code = code.replace(/let currentRating = p\.tournamentRating \|\| 3\.0;\s+let step = RATING_STEP_V1;\s+if \(isWin && \(match\.type === 'tournament' \|\| match\.type === 'tour'\)\) \{\s+const month = match\.date\.slice\(0, 7\);\s+if \(p\.trophies && p\.trophies\.some\(t => t\.month === month\)\) \{\s+step \*= 2;\s+\}\s+\}\s+if \(isWin\) currentRating = Math\.min\(MAX_RATING_V1, currentRating \+ step\);\s+else currentRating = Math\.max\(MIN_RATING_V1, currentRating - step\);/g, 
`let currentRating = p.tournamentRating || 3.0;
                let step = RATING_STEP_V1;
                if (isWin) currentRating = Math.min(MAX_RATING_V1, currentRating + step);
                else currentRating = Math.max(MIN_RATING_V1, currentRating - step);`);

// Replace change *= 2 in calculateUpdate
code = code.replace(/let change = Math\.min\(V2_MAX_CHANGE, Math\.max\(-V2_MAX_CHANGE, W \* teamChange\)\);\s+if \(change > 0 && \(match\.type === 'tournament' \|\| match\.type === 'tour'\)\) \{\s+const month = match\.date\.slice\(0, 7\);\s+if \(p\.trophies && p\.trophies\.some\(t => t\.month === month\)\) \{\s+change \*= 2;\s+\}\s+\}\s+pendingUpdates\.set\(pid, change\);/g, 
`let change = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * teamChange));
            pendingUpdates.set(pid, change);`);

// Replace finalChg *= 2 in applyV2 update inside loop
code = code.replace(/let finalChg = Math\.min\(V2_MAX_CHANGE, Math\.max\(-V2_MAX_CHANGE, W \* chg\)\);\s+if \(finalChg > 0 && \(m\.type === 'tournament' \|\| m\.type === 'tour'\)\) \{\s+const month = m\.date\.slice\(0, 7\);\s+const pObj = players\.find\(x => String\(x\.id\) === pid\);\s+if \(pObj && pObj\.trophies && pObj\.trophies\.some\(t => t\.month === month\)\) finalChg \*= 2;\s+\}\s+\/\/ Use 4 decimal places for storage, and CLAMP to min\/max/g,
`let finalChg = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * chg));
                 // Use 4 decimal places for storage, and CLAMP to min/max`);

// Replace pChange *= 2 in applyLegacy inside loop
code = code.replace(/let change = RATING_STEP_V1;\s+t1Ids\.forEach\(pid => \{\s+const current = getR\(pid\);\s+let pChange = change;\s+if \(isWin && \(m\.type === 'tournament' \|\| m\.type === 'tour'\)\) \{\s+const month = m\.date\.slice\(0, 7\);\s+const pObj = players\.find\(x => String\(x\.id\) === pid\);\s+if \(pObj && pObj\.trophies && pObj\.trophies\.some\(t => t\.month === month\)\) pChange \*= 2;\s+\}\s+const next = Math\.min\(MAX_RATING_V1, current \+ \(isWin \? pChange : -change\)\);/g,
`let change = RATING_STEP_V1;
             t1Ids.forEach(pid => {
                 const current = getR(pid);
                 const next = Math.min(MAX_RATING_V1, current + (isWin ? change : -change));`);

// Replace change *= 2 in final calculate update
code = code.replace(/let change = Math\.min\(V2_MAX_CHANGE, Math\.max\(-V2_MAX_CHANGE, W \* teamChange\)\);\s+if \(change > 0 && \(targetMatch\.type === 'tournament' \|\| targetMatch\.type === 'tour'\)\) \{\s+const month = targetMatch\.date\.slice\(0, 7\);\s+const pObj = players\.find\(x => String\(x\.id\) === pid\);\s+if \(pObj && pObj\.trophies && pObj\.trophies\.some\(t => t\.month === month\)\) change \*= 2;\s+\}\s+\/\/ Use 4 decimal places for consistency/g,
`let change = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * teamChange));
        // Use 4 decimal places for consistency`);

fs.writeFileSync('services/storageService.ts', code);
