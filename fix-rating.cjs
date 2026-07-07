const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

// For applyLegacy in calculatePlayerStats, getDailyRatingHistory, getPlayerRatingHistory
code = code.replace(/let currentRating = p\.tournamentRating \|\| 3\.0;\s+if \(isWin\) currentRating = Math\.min\(MAX_RATING_V1, currentRating \+ RATING_STEP_V1\);\s+else currentRating = Math\.max\(MIN_RATING_V1, currentRating - RATING_STEP_V1\);/g, 
`let currentRating = p.tournamentRating || 3.0;
                let step = RATING_STEP_V1;
                if (isWin && (match.type === 'tournament' || match.type === 'tour')) {
                    const month = match.date.slice(0, 7);
                    if (p.trophies && p.trophies.some(t => t.month === month)) {
                        step *= 2;
                    }
                }
                if (isWin) currentRating = Math.min(MAX_RATING_V1, currentRating + step);
                else currentRating = Math.max(MIN_RATING_V1, currentRating - step);`);

// For isRuleV2 in calculatePlayerStats, getDailyRatingHistory, getPlayerRatingHistory
code = code.replace(/let change = Math\.min\(V2_MAX_CHANGE, Math\.max\(-V2_MAX_CHANGE, W \* teamChange\)\);\s+pendingUpdates\.set\(pid, change\);/g, 
`let change = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * teamChange));
            if (change > 0 && (match.type === 'tournament' || match.type === 'tour')) {
                const month = match.date.slice(0, 7);
                if (p.trophies && p.trophies.some(t => t.month === month)) {
                    change *= 2;
                }
            }
            pendingUpdates.set(pid, change);`);

// For getMatchRatingDetails (V1 simulation)
code = code.replace(/const change = RATING_STEP_V1;\s+t1Ids\.forEach\(pid => \{\s+const current = getR\(pid\);\s+const next = Math\.min\(MAX_RATING_V1, current \+ \(isWin \? change : -change\)\);/g,
`let change = RATING_STEP_V1;
             t1Ids.forEach(pid => {
                 const current = getR(pid);
                 let pChange = change;
                 if (isWin && (m.type === 'tournament' || m.type === 'tour')) {
                     const month = m.date.slice(0, 7);
                     const pObj = players.find(x => String(x.id) === pid);
                     if (pObj && pObj.trophies && pObj.trophies.some(t => t.month === month)) pChange *= 2;
                 }
                 const next = Math.min(MAX_RATING_V1, current + (isWin ? pChange : -change));`);
                 
// For getMatchRatingDetails (V2 simulation)
code = code.replace(/const finalChg = Math\.min\(V2_MAX_CHANGE, Math\.max\(-V2_MAX_CHANGE, W \* chg\)\);\s+\/\/ Use 4 decimal places for storage, and CLAMP to min\/max/g,
`let finalChg = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * chg));
                 if (finalChg > 0 && (m.type === 'tournament' || m.type === 'tour')) {
                     const month = m.date.slice(0, 7);
                     const pObj = players.find(x => String(x.id) === pid);
                     if (pObj && pObj.trophies && pObj.trophies.some(t => t.month === month)) finalChg *= 2;
                 }
                 // Use 4 decimal places for storage, and CLAMP to min/max`);

// For getMatchRatingDetails (target match)
code = code.replace(/const change = Math\.min\(V2_MAX_CHANGE, Math\.max\(-V2_MAX_CHANGE, W \* teamChange\)\);\s+\/\/ Use 4 decimal places for consistency/g,
`let change = Math.min(V2_MAX_CHANGE, Math.max(-V2_MAX_CHANGE, W * teamChange));
        if (change > 0 && (targetMatch.type === 'tournament' || targetMatch.type === 'tour')) {
            const month = targetMatch.date.slice(0, 7);
            const pObj = players.find(x => String(x.id) === pid);
            if (pObj && pObj.trophies && pObj.trophies.some(t => t.month === month)) change *= 2;
        }
        // Use 4 decimal places for consistency`);

fs.writeFileSync('services/storageService.ts', code);
