const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

// Find the for loop in calculatePlayerStats and replace it
const replaceStr = `  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // --- PRE-CALCULATE TOURNAMENT TRIGGERS ---
  const roundRobinMatchesByMonth = new Map<string, Match[]>();
  
  sortedMatches.forEach(m => {
      const month = m.date.slice(0, 7);
      if (m.type === 'tournament') {
          if (!roundRobinMatchesByMonth.has(month)) roundRobinMatchesByMonth.set(month, []);
          roundRobinMatchesByMonth.get(month).push(m);
      }
  });

  const processedMonths = new Set<string>();

  for (let i = 0; i < sortedMatches.length; i++) {
    const match = sortedMatches[i];`;

code = code.replace(/  const sortedMatches = \[\.\.\.matches\]\.sort\(\(a, b\) => new Date\(a\.date\)\.getTime\(\) - new Date\(b\.date\)\.getTime\(\)\);\n\n  for \(const match of sortedMatches\) \{/g, replaceStr);

fs.writeFileSync('services/storageService.ts', code);
