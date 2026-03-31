import React, { useState, useEffect } from 'react';
import { Image, X, Check } from 'lucide-react';

const BANNER_STORAGE_KEY = 'picklepro_banner_url';

interface BannerProps {
    isEditing: boolean;
    onCloseEdit: () => void;
}

export const Banner: React.FC<BannerProps> = ({ isEditing, onCloseEdit }) => {
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [tempUrl, setTempUrl] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const storedUrl = localStorage.getItem(BANNER_STORAGE_KEY);
        if (storedUrl) {
            setBannerUrl(storedUrl);
        }
    }, []);

    useEffect(() => {
        if (isEditing) {
            setTempUrl(bannerUrl || '');
            setPassword('');
            setError('');
        }
    }, [isEditing, bannerUrl]);

    const handleSave = () => {
        if (password !== 'Tducteam') {
            setError('Mật khẩu không đúng!');
            return;
        }
        
        if (tempUrl.trim() === '') {
            localStorage.removeItem(BANNER_STORAGE_KEY);
            setBannerUrl(null);
        } else {
            localStorage.setItem(BANNER_STORAGE_KEY, tempUrl);
            setBannerUrl(tempUrl);
        }
        
        onCloseEdit();
    };

    const handleCancel = () => {
        onCloseEdit();
    };

    if (!bannerUrl && !isEditing) return null;

    return (
        <div className="relative w-full bg-slate-100 border-b border-slate-200">
            {bannerUrl && !isEditing && (
                <div className="w-full max-h-[200px] md:max-h-[300px] overflow-hidden flex justify-center items-center bg-slate-200">
                    <img 
                        src={bannerUrl} 
                        alt="App Banner" 
                        className="w-full h-auto object-cover max-h-[200px] md:max-h-[300px]"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            )}

            {/* Edit Form */}
            {isEditing && (
                <div className="p-4 bg-white shadow-inner">
                    <div className="max-w-3xl mx-auto space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Image size={16} />
                                Cập nhật Banner
                            </h3>
                            <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Link ảnh (Direct Link)</label>
                                <input 
                                    type="text" 
                                    value={tempUrl}
                                    onChange={(e) => setTempUrl(e.target.value)}
                                    placeholder="https://example.com/image.png"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pickle-500"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Để trống để xóa banner</p>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Mật khẩu xác nhận</label>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pickle-500"
                                />
                            </div>
                        </div>
                        
                        {error && <p className="text-xs text-red-500">{error}</p>}
                        
                        <div className="flex justify-end gap-2 pt-2">
                            <button 
                                onClick={handleCancel}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={handleSave}
                                className="px-3 py-1.5 text-sm bg-pickle-600 text-white rounded-md hover:bg-pickle-700 transition-colors flex items-center gap-1"
                            >
                                <Check size={16} />
                                Lưu Banner
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
