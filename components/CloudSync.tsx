import React, { useState, useEffect } from 'react';
import { Player, Match } from '../types';
import { syncToCloud, syncFromCloud } from '../services/googleSheetService';
import { Cloud, Download, Upload, CheckCircle, AlertCircle, Loader2, Terminal } from 'lucide-react';

interface CloudSyncProps {
  players: Player[];
  matches: Match[];
  onDataLoaded: (players: Player[], matches: Match[]) => void;
  onClose: () => void;
}

export const CloudSync: React.FC<CloudSyncProps> = ({ players, matches, onDataLoaded, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'upload' | 'download' | null>(null);
  
  // Confirmation state for download
  const [confirmDownload, setConfirmDownload] = useState(false);

  // Status logs instead of just one message
  const [logs, setLogs] = useState<string[]>([]);
  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  useEffect(() => {
      addLog("Đã kết nối giao diện đồng bộ.");
  }, []);

  const handleUpload = async () => {
    setIsLoading(true);
    setLoadingType('upload');
    setLogs([]); // Clear old logs
    addLog("Bắt đầu tải lên dữ liệu...");
    
    try {
      addLog(`Đang gửi ${players.length} người chơi và ${matches.length} trận đấu...`);
      await syncToCloud(players, matches);
      addLog("Thành công: Dữ liệu đã được lưu an toàn trên Google Sheet.");
    } catch (e) {
      addLog("LỖI: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleDownloadClick = async () => {
    if (!confirmDownload) {
        setConfirmDownload(true);
        addLog("Yêu cầu xác nhận: Dữ liệu trên máy sẽ bị thay thế. Nhấn nút Tải Về lần nữa để đồng ý.");
        // Reset confirm state after 5 seconds if not clicked
        setTimeout(() => {
            setConfirmDownload(false);
        }, 5000);
        return;
    }

    // Reset confirm state
    setConfirmDownload(false);
    
    setIsLoading(true);
    setLoadingType('download');
    setLogs([]); // Clear old logs
    addLog("Bắt đầu kết nối máy chủ Google...");

    try {
      const data = await syncFromCloud();
      addLog(`Đã nhận dữ liệu: ${data.players.length} người chơi, ${data.matches.length} trận.`);
      
      onDataLoaded(data.players, data.matches);
      addLog("Thành công: Dữ liệu App đã được cập nhật!");
    } catch (e) {
      console.error("Download Error:", e);
      addLog("LỖI NGHIÊM TRỌNG: " + (e instanceof Error ? e.message : String(e)));
      addLog("Vui lòng thử lại hoặc kiểm tra kết nối mạng.");
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
            <h3 className="text-lg font-bold flex items-center gap-2">
                <Cloud className="w-5 h-5 text-pickle-400" />
                Đồng Bộ Google Sheet
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
                ✕
            </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
            <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-100">
                <p>Hệ thống kết nối trực tiếp với Google Sheet.</p>
                <p className="mt-1 font-semibold text-xs text-blue-600 uppercase">Trạng thái: Sẵn sàng</p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={handleDownloadClick}
                    disabled={isLoading}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all group disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden ${
                        confirmDownload 
                        ? 'bg-red-50 border-red-500 animate-pulse' 
                        : 'border-slate-100 hover:border-blue-500 hover:bg-blue-50'
                    }`}
                >
                    {isLoading && loadingType === 'download' && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                             <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    )}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${confirmDownload ? 'bg-red-100 text-red-600 scale-110' : 'bg-blue-100 text-blue-600 group-hover:scale-110'}`}>
                        {confirmDownload ? <AlertCircle className="w-6 h-6" /> : <Download className="w-5 h-5" />}
                    </div>
                    
                    <span className={`font-bold text-center ${confirmDownload ? 'text-red-700' : 'text-slate-700 group-hover:text-blue-700'}`}>
                        {confirmDownload ? "Bấm lần nữa để Xác Nhận" : "Tải Về App"}
                    </span>
                    
                    {!confirmDownload && (
                        <span className="text-xs text-slate-500 text-center">Lấy dữ liệu từ Sheet</span>
                    )}
                </button>

                <button
                    onClick={handleUpload}
                    disabled={isLoading || confirmDownload} // Disable upload if verifying download
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-slate-100 hover:border-pickle-500 hover:bg-pickle-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                >
                    {isLoading && loadingType === 'upload' && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                             <Loader2 className="w-8 h-8 text-pickle-500 animate-spin" />
                        </div>
                    )}
                    <div className="w-10 h-10 rounded-full bg-pickle-100 text-pickle-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-slate-700 group-hover:text-pickle-700">Lưu Lên Cloud</span>
                    <span className="text-xs text-slate-500 text-center">Ghi đè dữ liệu lên Sheet</span>
                </button>
            </div>

            {/* Visual Log Console */}
            <div className="mt-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                    <Terminal className="w-3 h-3" /> Nhật ký hệ thống
                </div>
                <div className="bg-slate-900 rounded-lg p-3 h-32 overflow-y-auto font-mono text-xs border border-slate-800 shadow-inner custom-scrollbar">
                    {logs.length === 0 ? (
                        <span className="text-slate-600 italic">Chờ thao tác...</span>
                    ) : (
                        logs.map((log, idx) => (
                            <div key={idx} className={`mb-1 ${
                                log.includes("LỖI") ? 'text-red-400 font-bold' : 
                                log.includes("Thành công") ? 'text-green-400 font-bold' : 
                                'text-slate-300'
                            }`}>
                                {log}
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div className="text-blue-400 animate-pulse">_ Đang xử lý...</div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};