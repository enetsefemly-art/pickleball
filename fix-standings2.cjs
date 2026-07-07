const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

code = code.replace(
    /export const getTournamentStandings = \(monthKey: string, _players: Player\[\], matches: Match\[\]\) => \{[\s\S]*?const validMatches = matches\.filter\(m => \{[\s\S]*?return m\.date\.startsWith\(monthKey\) &&\s*\(m\.type === 'tournament' \|\| m\.type === 'tour'\);\s*\}\);/m,
    `export const getTournamentStandings = (monthKey: string, _players: Player[], matches: Match[], matchType: string = 'tournament') => {
    // Filter matches for the specific month and tournament type
    // FIX: Removed RATING_START_DATE check so historical cups (e.g. Oct) are counted
    const validMatches = matches.filter(m => {
        return m.date.startsWith(monthKey) && m.type === matchType;
    });`
);

fs.writeFileSync('services/storageService.ts', code);
