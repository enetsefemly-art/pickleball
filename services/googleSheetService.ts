import { Player, Match } from '../types';

// URL API được gắn cứng
const API_URL = 'https://script.google.com/macros/s/AKfycbxpLj986RP9SzKcLjzjFhDC6qtyAvFUg2VdHWTlwHmmg-jZEIeNnpkZxtoP6GBHVTtG/exec';

export const getApiUrl = () => API_URL;

export const saveApiUrl = (url: string) => {
    console.warn("API URL đã được gắn cứng, không thể thay đổi.");
};

interface SyncResponse {
    status: 'success' | 'error';
    data?: {
        players: Player[];
        matches: Match[];
    };
    message?: string;
}

// Hàm helper để fetch có timeout
const fetchWithTimeout = async (resource: string, options: RequestInit = {}, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const syncToCloud = async (players: Player[], matches: Match[]): Promise<boolean> => {
    const url = getApiUrl();
    console.log("Starting Cloud Sync (Upload)...");
    
    try {
        // Upload không cần timeout ngắn, nhưng cũng nên có
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            redirect: 'follow', 
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({ players, matches }),
        }, 30000); // 30s cho upload

        const text = await response.text();
        let result: SyncResponse;
        
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error("Invalid JSON response (POST):", text);
            throw new Error("Máy chủ phản hồi không đúng định dạng JSON.");
        }

        if (result.status === 'success') {
            return true;
        } else {
            throw new Error(result.message || 'Lỗi không xác định từ Google Sheet');
        }
    } catch (error) {
        console.error("Cloud Sync Upload Error:", error);
        throw error;
    }
};

export const syncFromCloud = async (): Promise<{ players: Player[], matches: Match[] }> => {
    const url = getApiUrl();
    const finalUrl = `${url}?nocache=${Date.now()}`;
    
    console.log("Starting Cloud Sync (Download) from:", finalUrl);

    try {
        const response = await fetchWithTimeout(finalUrl, {
            method: 'GET',
            redirect: 'follow',
            // Sử dụng mode 'cors' và credentials 'omit' là combo an toàn nhất cho GAS public web app
            mode: 'cors',
            credentials: 'omit'
        }, 15000); // 15s timeout

        if (!response.ok) {
            throw new Error(`Lỗi kết nối HTTP: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        console.log("Response received, length:", text.length);

        // Kiểm tra xem có phải HTML báo lỗi của Google không
        if (text.trim().startsWith("<")) {
             if (text.includes("Google Drive") || text.includes("Google Docs")) {
                 throw new Error("Không có quyền truy cập. Hãy đảm bảo Web App được set là 'Who has access: Anyone'.");
             }
             throw new Error("Google trả về trang HTML thay vì dữ liệu JSON. Có thể Script bị lỗi.");
        }

        let result: SyncResponse;
        try {
            result = JSON.parse(text);
        } catch (e) {
            throw new Error("Dữ liệu tải về không phải JSON hợp lệ.");
        }

        if (result.status === 'success' && result.data) {
            return result.data;
        } else {
            throw new Error(result.message || 'Lỗi: Cấu trúc dữ liệu không hợp lệ.');
        }
    } catch (error: any) {
        console.error("Cloud Fetch Download Error:", error);
        if (error.name === 'AbortError') {
            throw new Error("Hết thời gian chờ (Timeout). Kiểm tra lại kết nối mạng.");
        }
        throw error;
    }
};