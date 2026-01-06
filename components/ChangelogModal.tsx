import React from 'react';
import { X, Sparkles, CheckCircle2, Zap, Shield, UserCog } from 'lucide-react';

interface ChangelogModalProps {
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
  const versions = [
    {
      version: '3.2.0',
      date: '02/01/2026',
      title: 'Active Status & AI Core 3.0',
      highlight: true,
      changes: [
        { icon: UserCog, text: 'Quản lý trạng thái: Thêm tính năng bật/tắt (Active/Inactive) người chơi. Người nghỉ chơi sẽ ẩn khỏi BXH và không được xếp kèo.' },
        { icon: Zap, text: 'AI Core 3.0: Nâng cấp thuật toán ghép đội. Sử dụng toàn bộ dữ liệu lịch sử thay vì chỉ tháng hiện tại. Áp dụng công thức ELO + Margin Score mới.' },
        { icon: Shield, text: 'Smart Handicap: Hệ thống tự động tính kèo chấp dựa trên chênh lệch trình độ và chỉ số "dễ vỡ trận" (Blowout Index).' }
      ]
    },
    {
      version: '2.5.0',
      date: '01/01/2026',
      title: 'Rule 2.0 & Calculation Log',
      highlight: false,
      changes: [
        { icon: CheckCircle2, text: 'Áp dụng hệ thống tính điểm Rule 2.0 (ELO Based) từ ngày 01/01/2026.' },
        { icon: CheckCircle2, text: 'Xem chi tiết cách tính điểm (Calculation Log) từng bước cho các trận đấu.' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
              <Sparkles className="w-5 h-5 text-yellow-300" fill="currentColor" />
            </div>
            <div className="text-white">
              <h3 className="font-bold text-lg leading-tight">Nhật Ký Cập Nhật</h3>
              <p className="text-indigo-200 text-xs">Các tính năng mới nhất</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-0 bg-slate-50">
          {versions.map((ver, idx) => (
            <div key={idx} className={`p-5 border-b border-slate-200 last:border-0 ${ver.highlight ? 'bg-white' : 'bg-slate-50 opacity-90'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-black ${ver.highlight ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                    v{ver.version}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{ver.date}</span>
                </div>
              </div>
              
              <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide">{ver.title}</h4>
              
              <ul className="space-y-3">
                {ver.changes.map((change, cIdx) => (
                  <li key={cIdx} className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed">
                    <change.icon className={`w-4 h-4 shrink-0 mt-0.5 ${ver.highlight ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span>{change.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all shadow-lg active:scale-[0.98]"
          >
            Đã Hiểu
          </button>
        </div>

      </div>
    </div>
  );
};