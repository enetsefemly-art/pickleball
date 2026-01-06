import React, { useState } from 'react';
import { Player } from '../types';
import { Card } from './Card';
import { Plus, Trash2, Trophy, Eye, EyeOff } from 'lucide-react';
import { PlayerProfile } from './PlayerProfile';
import { getMatches } from '../services/storageService'; // Helper to pass matches to profile

interface PlayerManagerProps {
  players: Player[];
  onAddPlayer: (name: string, initialPoints: number) => void;
  onDeletePlayer: (id: string) => void;
  onToggleActive: (id: string) => void; // New Prop
}

export const PlayerManager: React.FC<PlayerManagerProps> = ({ 
  players, 
  onAddPlayer,
  onDeletePlayer,
  onToggleActive
}) => {
  const [newName, setNewName] = useState('');
  const [initialPoints, setInitialPoints] = useState('1000');
  
  // State for Player Profile Modal
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      const points = parseInt(initialPoints) || 1000;
      onAddPlayer(newName.trim(), points);
      setNewName('');
      setInitialPoints('1000');
    }
  };

  const handleDelete = (e: React.MouseEvent, player: Player) => {
    e.stopPropagation(); // Prevent opening profile
    if (player.matchesPlayed > 0) {
      alert('Không thể xóa người chơi này vì đã có lịch sử đấu.');
      return;
    }
    if (window.confirm(`Bạn có chắc muốn xóa người chơi ${player.name}?`)) {
      onDeletePlayer(player.id);
    }
  };

  // Helper to get matches for the profile
  const allMatches = getMatches();

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
                <h3 className="text-lg font-semibold">Thêm Người Chơi Mới</h3>
                <p className="text-slate-400 text-sm">Nhập tên và điểm gốc để bắt đầu</p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tên người chơi..."
                    className="flex-[2] px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pickle-500"
                />
                <input
                    type="number"
                    value={initialPoints}
                    onChange={(e) => setInitialPoints(e.target.value)}
                    placeholder="Điểm gốc..."
                    className="w-full sm:w-28 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pickle-500"
                />
                <button 
                    type="submit"
                    disabled={!newName.trim()}
                    className="px-4 py-2 bg-pickle-500 hover:bg-pickle-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" /> Thêm
                </button>
            </form>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map(player => (
            <div 
                key={player.id} 
                onClick={() => setSelectedPlayer(player)}
                className={`p-4 rounded-xl border shadow-sm flex flex-col gap-4 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden ${player.isActive === false ? 'bg-slate-100 border-slate-200 opacity-70' : 'bg-white border-slate-200'}`}
            >
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-slate-100 to-white rounded-bl-full -mr-8 -mt-8 z-0"></div>

                <div className="flex items-start gap-4 z-10">
                    <div className="relative">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 transition-colors ${player.isActive === false ? 'bg-slate-200 text-slate-400 border-slate-300' : 'bg-slate-100 text-slate-700 border-slate-200 group-hover:border-pickle-500'}`}>
                            {player.name.charAt(0).toUpperCase()}
                        </div>
                        {(player.championships || 0) > 0 && (
                             <div className="absolute -top-1 -right-1 bg-yellow-400 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                <Trophy className="w-2.5 h-2.5 fill-current" />
                             </div>
                        )}
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-1">
                        <h4 className={`font-bold truncate transition-colors text-lg ${player.isActive === false ? 'text-slate-500 line-through' : 'text-slate-900 group-hover:text-pickle-600'}`} title={player.name}>
                            {player.name}
                        </h4>
                        
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium border border-slate-200">
                                ID: {player.id}
                            </span>
                            {(player.tournamentRating || 0) > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-bold border border-blue-100">
                                    {(player.tournamentRating || 0).toFixed(1)} Rate
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto z-10">
                    <div className="flex gap-4 text-xs">
                        <div className="flex flex-col">
                            <span className="text-slate-400 font-medium uppercase text-[10px]">Trận</span>
                            <span className="font-bold text-slate-700">{player.matchesPlayed}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-400 font-medium uppercase text-[10px]">Thắng</span>
                            <span className="font-bold text-green-600">{player.wins}</span>
                        </div>
                         <div className="flex flex-col">
                            <span className="text-slate-400 font-medium uppercase text-[10px]">Cúp</span>
                            <span className="font-bold text-yellow-600">{player.championships || 0}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleActive(player.id);
                            }}
                            className={`p-2 rounded-lg transition-colors ${player.isActive === false ? 'text-slate-400 hover:text-green-600 hover:bg-green-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                            title={player.isActive === false ? "Kích hoạt lại" : "Tạm ẩn"}
                        >
                            {player.isActive === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>

                        <button 
                            onClick={(e) => handleDelete(e, player)}
                            disabled={player.matchesPlayed > 0}
                            className={`p-2 rounded-lg transition-colors ${
                                player.matchesPlayed > 0 
                                ? 'text-slate-200 cursor-not-allowed' 
                                : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={player.matchesPlayed > 0 ? "Không thể xóa (đã có trận đấu)" : "Xóa"}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {/* PLAYER PROFILE MODAL */}
      {selectedPlayer && (
        <PlayerProfile 
            player={selectedPlayer} 
            players={players}
            matches={allMatches}
            onClose={() => setSelectedPlayer(null)} 
        />
      )}
    </div>
  );
};