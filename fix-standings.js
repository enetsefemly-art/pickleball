const fs = require('fs');
let code = fs.readFileSync('services/storageService.ts', 'utf8');

const regex = /m\.type === 'tournament' \|\| m\.type === 'tour'/g;
code = code.replace(regex, "m.type === 'tournament'");

fs.writeFileSync('services/storageService.ts', code);
