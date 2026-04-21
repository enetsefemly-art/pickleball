import React from 'react';
import { Player, Match, TournamentState } from '../types';
import { Cloud, CheckCircle, Database } from 'lucide-react';

interface CloudSyncProps {
  players: Player[];
  matches: Match[];
  onDataLoaded: (players: Player[], matches: Match[], tournament: TournamentState | null) => void;
  onClose: () => void;
}

export const CloudSync: React.FC<CloudSyncProps> = ({ players, matches, onClose }) => {
  return (
    <div className="bg-slate-800 rounded-xl max-w-sm w-[90vw] mx-auto overflow-hidden shadow-2xl border border-slate-700">
        <div className="bg-slate-900 p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-green-400" />
                Hệ Thống Đồng Bộ
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1">✕</button>
        </div>
        <div className="p-5 text-sm text-slate-300">
            <div className="flex items-start gap-4 mb-4">
                <CheckCircle className="w-8 h-8 text-green-400 mt-0.5 shrink-0" />
                <div>
                    <strong className="text-white text-base mb-1 block">Tự động hoàn toàn!</strong>
                    <p>Ứng dụng đã chuyển sang Firebase <strong>Realtime Sync</strong>. Mọi sự thay đổi (Thêm, Sửa, Xoá) của bạn sẽ được lưu trực tiếp và tất cả thiết bị khác sẽ được tự động đồng bộ theo thời gian thực.</p>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6 mt-6">
                <div className="bg-slate-900 rounded-lg p-4 flex flex-col items-center justify-center border border-slate-700">
                    <Database className="w-6 h-6 text-blue-400 mb-2" />
                    <div className="text-2xl font-bold text-white">{matches.length}</div>
                    <div className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-1">Trận Đấu</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-4 flex flex-col items-center justify-center border border-slate-700">
                    <Database className="w-6 h-6 text-purple-400 mb-2" />
                    <div className="text-2xl font-bold text-white">{players.length}</div>
                    <div className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-1">Người Chơi</div>
                </div>
            </div>

            <button onClick={onClose} className="w-full py-3 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl text-white transition-colors">
                Tuyệt Vời!
            </button>
        </div>
    </div>
  );
};
