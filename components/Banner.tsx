import React, { useState, useEffect } from 'react';
import { Settings, Image as ImageIcon, X } from 'lucide-react';

export const Banner: React.FC = () => {
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [password, setPassword] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchBanner();
  }, []);

  const fetchBanner = async () => {
    try {
      const res = await fetch('/api/app-config');
      const data = await res.json();
      if (data.url) {
        setBannerUrl(data.url);
      }
    } catch (e) {
      console.error("Failed to fetch banner", e);
    }
  };

  const handleSave = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/app-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl, password })
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error("Failed to parse JSON. Server returned:", text);
        throw new Error("Invalid JSON response from server");
      }
      
      if (res.ok) {
        setBannerUrl(newUrl);
        setIsEditing(false);
        setPassword('');
        setNewUrl('');
      } else {
        setError(data.message || 'Lỗi cập nhật banner');
      }
    } catch (e: any) {
      console.error("Banner save error:", e);
      setError(e.message === "Invalid JSON response from server" ? 'Lỗi phản hồi từ máy chủ' : 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full bg-slate-100 border-b border-slate-200 group flex justify-center">
      {bannerUrl ? (
        <div className="w-full max-w-7xl max-h-32 md:max-h-48 overflow-hidden flex items-center justify-center relative">
          <img 
            src={bannerUrl} 
            alt="App Banner" 
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/1200x200/e2e8f0/475569?text=Invalid+Image+URL';
            }}
          />
          {/* Edit Button - visible on hover or always on mobile */}
          <button 
            onClick={() => {
              setNewUrl(bannerUrl);
              setIsEditing(true);
            }}
            className="absolute top-2 right-2 md:right-4 p-2 bg-slate-900/60 hover:bg-slate-900/90 text-white rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
            title="Cập nhật Banner"
          >
            <Settings size={16} />
          </button>
        </div>
      ) : (
        <div className="w-full max-w-7xl h-10 md:h-12 flex items-center justify-center bg-slate-50 relative">
          <button 
            onClick={() => {
              setNewUrl('');
              setIsEditing(true);
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-pickle-600 transition-colors text-sm font-medium"
          >
            <ImageIcon size={16} />
            <span>Thêm Banner</span>
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <ImageIcon size={18} className="text-pickle-600" />
                Cập nhật Banner
              </h3>
              <button 
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Link ảnh (Direct URL)
                </label>
                <input 
                  type="text" 
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pickle-500 focus:border-pickle-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mật khẩu xác nhận
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pickle-500 focus:border-pickle-500 outline-none transition-all"
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-2 rounded-lg border border-red-100">
                  {error}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                disabled={isLoading}
              >
                Hủy
              </button>
              <button 
                onClick={handleSave}
                disabled={isLoading || !password}
                className="px-4 py-2 bg-pickle-600 hover:bg-pickle-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? 'Đang lưu...' : 'Lưu Banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
