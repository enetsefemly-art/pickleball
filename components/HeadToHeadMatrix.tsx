import React, { useMemo } from 'react';
import { Player, Match } from '../types';
import { Card } from './Card';
import { Grid3X3, Info } from 'lucide-react';

interface HeadToHeadMatrixProps {
  players: Player[];
  matches: Match[];
}

export const HeadToHeadMatrix: React.FC<HeadToHeadMatrixProps> = ({ players, matches }) => {
  // 1. Calculate Matrix Data
  // Structure: Map<PlayerId, Map<OpponentId, { wins: number, total: number }>>
  const matrixData = useMemo(() => {
    const data = new Map<string, Map<string, { wins: number; total: number }>>();
    
    // Helper to init map
    const ensureInit = (p1: string, p2: string) => {
        if (!data.has(p1)) data.set(p1, new Map());
        if (!data.get(p1)!.has(p2)) data.get(p1)!.set(p2, { wins: 0, total: 0 });
    };

    matches.forEach(m => {
        if (!m.team1 || !m.team2) return;
        
        const team1 = m.team1.map(String);
        const team2 = m.team2.map(String);
        
        // Strict Winner Logic
        let s1 = Number(m.score1);
        let s2 = Number(m.score2);
        if (isNaN(s1)) s1 = 0; if (isNaN(s2)) s2 = 0;
        
        if (s1 === s2) return; // Skip draws

        let winner: 1 | 2;
        if (s1 > s2) winner = 1;
        else if (s2 > s1) winner = 2;
        else winner = Number(m.winner) === 1 ? 1 : 2;

        // Cross-reference every player in Team 1 with every player in Team 2
        team1.forEach(p1 => {
            team2.forEach(p2 => {
                // Ignore if playing against self (shouldn't happen in valid data)
                if (p1 === p2) return;

                ensureInit(p1, p2);
                ensureInit(p2, p1);

                const p1Stats = data.get(p1)!.get(p2)!;
                const p2Stats = data.get(p2)!.get(p1)!;

                p1Stats.total += 1;
                p2Stats.total += 1;

                if (winner === 1) {
                    p1Stats.wins += 1;
                } else {
                    p2Stats.wins += 1;
                }
            });
        });
    });

    return data;
  }, [matches]);

  // 2. Filter Active Players (Rows/Cols)
  // Only show players who have at least 1 interaction in the filtered matches
  const activePlayers = useMemo(() => {
      const activeIds = new Set<string>();
      matches.forEach(m => {
          m.team1.forEach(id => activeIds.add(String(id)));
          m.team2.forEach(id => activeIds.add(String(id)));
      });
      
      // Sort alphabetically
      return players
        .filter(p => activeIds.has(String(p.id)))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, matches]);

  // Helper to get cell color
  const getCellColor = (wins: number, total: number) => {
      if (total === 0) return 'bg-slate-50 text-slate-300';
      const rate = wins / total;
      if (rate === 0.5) return 'bg-yellow-100 text-yellow-700 font-medium';
      if (rate > 0.5) {
          // Gradient of green
          if (rate === 1) return 'bg-green-600 text-white font-bold';
          if (rate >= 0.75) return 'bg-green-400 text-white font-medium';
          return 'bg-green-200 text-green-800';
      } else {
          // Gradient of red/orange
          if (rate === 0) return 'bg-red-100 text-red-400';
          if (rate <= 0.25) return 'bg-orange-200 text-orange-800';
          return 'bg-orange-100 text-orange-700';
      }
  };

  if (activePlayers.length < 2) {
      return (
          <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50">
              Chưa đủ dữ liệu trận đấu để tạo ma trận.
          </div>
      );
  }

  return (
    <div className="overflow-hidden bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse table-fixed">
            <thead>
              <tr>
                {/* Top Left Empty Cell - Now with VS label */}
                <th className="sticky left-0 top-0 z-20 bg-slate-50 border-b border-r border-slate-200 p-1 w-[80px] md:w-[120px] text-left text-[10px] font-bold text-slate-400 uppercase align-bottom">
                    <span className="block px-1">VS</span>
                </th>
                
                {/* Top Header Row (Opponents) - Horizontal Text */}
                {activePlayers.map(colPlayer => (
                  <th key={colPlayer.id} className="p-2 border-b border-slate-200 w-16 md:w-20 text-center text-[10px] font-bold text-slate-700 bg-slate-50 align-bottom">
                     <span className="block truncate" title={colPlayer.name}>
                        {colPlayer.name}
                     </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activePlayers.map(rowPlayer => (
                <tr key={rowPlayer.id} className="hover:bg-slate-50 transition-colors h-10">
                  {/* Left Sticky Column (Player) */}
                  <th className="sticky left-0 z-10 p-1 border-r border-b border-slate-200 bg-slate-50 text-left text-[10px] md:text-xs font-bold text-slate-800 shadow-[1px_0_3px_rgba(0,0,0,0.05)] truncate">
                    <span className="block px-1 truncate" title={rowPlayer.name}>{rowPlayer.name}</span>
                  </th>
                  
                  {/* Data Cells */}
                  {activePlayers.map(colPlayer => {
                    if (rowPlayer.id === colPlayer.id) {
                        return <td key={colPlayer.id} className="bg-slate-100 border-b border-slate-200"></td>;
                    }

                    const stats = matrixData.get(String(rowPlayer.id))?.get(String(colPlayer.id));
                    const wins = stats?.wins || 0;
                    const total = stats?.total || 0;
                    
                    return (
                      <td 
                        key={colPlayer.id} 
                        className={`p-0 border-b border-slate-100 text-center border-r border-slate-50 last:border-r-0 ${getCellColor(wins, total)}`}
                        title={`${rowPlayer.name} vs ${colPlayer.name}: Thắng ${wins}/${total} (${total > 0 ? Math.round((wins / total) * 100) : 0}%)`}
                      >
                        {total > 0 ? (
                            <div className="flex flex-col justify-center items-center h-full w-full py-1">
                                <span className="text-[10px] md:text-xs font-bold leading-none mb-0.5">
                                    {Math.round((wins / total) * 100)}%
                                </span>
                                <span className="text-[8px] opacity-80 font-mono leading-none">
                                    {wins}-{total-wins}
                                </span>
                            </div>
                        ) : (
                            <span className="text-slate-200 text-[10px]">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};