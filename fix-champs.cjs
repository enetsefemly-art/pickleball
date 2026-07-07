const fs = require('fs');

const files = ['components/PlayerManager.tsx', 'components/DashboardStats.tsx', 'components/Leaderboard.tsx'];
for (const file of files) {
    if (fs.existsSync(file)) {
        let code = fs.readFileSync(file, 'utf8');
        code = code.replace(/player\.trophies\?\.length \|\| 0/g, "player.championships || 0");
        code = code.replace(/p\.trophies\?\.length \|\| 0/g, "p.championships || 0");
        fs.writeFileSync(file, code);
    }
}
