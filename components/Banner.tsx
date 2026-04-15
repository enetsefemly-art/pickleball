import React, { useState, useEffect } from 'react';
import { Image, X, Check, Loader2 } from 'lucide-react';
import { saveBannerToCloud } from '../services/firebaseService';

const BANNER_STORAGE_KEY = 'picklepro_banner_url';

interface BannerProps {
    isEditing: boolean;
    onCloseEdit: () => void;
    externalBannerUrl?: string | null;
    onBannerChange?: (url: string | null) => void;
}

export const Banner: React.FC<BannerProps> = ({ isEditing, onCloseEdit, externalBannerUrl, onBannerChange }) => {
    const [bannerUrl, setBannerUrl] = useState<string | null>(externalBannerUrl || null);
    const [tempUrl, setTempUrl] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (externalBannerUrl !== undefined) {
            setBannerUrl(externalBannerUrl);
        }
    }, [externalBannerUrl]);

    useEffect(() => {
        if (isEditing) {
            setTempUrl(bannerUrl || '');
            setPassword('');
            setError('');
        }
    }, [isEditing, bannerUrl]);

    const handleSave = async () => {
        if (password !== 'Tducteam') {
            setError('Mật khẩu không đúng!');
            return;
        }
        
        setIsSaving(true);
        setError('');

        try {
            await saveBannerToCloud(tempUrl.trim());
            
            if (tempUrl.trim() === '') {
                localStorage.removeItem(BANNER_STORAGE_KEY);
                setBannerUrl(null);
                if (onBannerChange) onBannerChange(null);
            } else {
                localStorage.setItem(BANNER_STORAGE_KEY, tempUrl);
                setBannerUrl(tempUrl);
                if (onBannerChange) onBannerChange(tempUrl);
            }
            
            onCloseEdit();
        } catch (err: any) {
            setError(err.message || 'Lỗi khi lưu banner lên cloud.');
        } finally {
            setIsSaving(false);
        }
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
                                disabled={isSaving}
                                className="px-3 py-1.5 text-sm bg-pickle-600 text-white rounded-md hover:bg-pickle-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                {isSaving ? 'Đang lưu...' : 'Lưu Banner'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
