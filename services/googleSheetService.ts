import { Player, Match, TournamentState } from '../types';

// URL API được lấy từ file hiện tại
const API_URL = 'https://script.google.com/macros/s/AKfycbxmlwOwE0mOIoZMznr3-nqTTJNEwtek0zhBYTVjYm8fE8TZCNY9Ejs7RghiZDkNXnnD/exec';

export const getApiUrl = () => API_URL;

export const saveApiUrl = (url: string) => {
    console.warn("API URL đã được gắn cứng, không thể thay đổi.");
};

interface SyncResponse {
    status: 'success' | 'error';
    data?: {
        players: Player[];
        matches: Match[];
        tournament?: TournamentState | null;
    };
    message?: string;
}

// --- HELPER FUNCTIONS FOR ROBUST PARSING ---

// 1. Lấy giá trị property linh hoạt (không phân biệt hoa thường, nhiều tên gọi)
const getProp = (obj: any, ...candidates: string[]): any => {
    if (!obj || typeof obj !== 'object') return undefined;
    
    // 1. Thử khớp chính xác
    for (const key of candidates) {
        if (obj[key] !== undefined) return obj[key];
    }

    // 2. Thử khớp mờ (lowercase, bỏ khoảng trắng)
    const objKeys = Object.keys(obj);
    for (const candidate of candidates) {
        const normalizedCand = candidate.toLowerCase().replace(/\s/g, '');
        const foundKey = objKeys.find(k => k.toLowerCase().replace(/\s/g, '') === normalizedCand);
        if (foundKey) return obj[foundKey];
    }
    return undefined;
};

// 2. Parse ngày tháng an toàn (CRITICAL FIX FOR WHITE SCREEN)
const parseDateSafe = (input: any): string => {
    try {
        if (!input) return new Date().toISOString();
        
        // Nếu Sheet trả về Object Date (thường gặp)
        if (input instanceof Date) {
            return input.toISOString();
        }

        // Nếu là string
        if (typeof input === 'string') {
            // Nếu đã là ISO string
            if (input.includes('T')) return input;
            
            // Thử parse
            const d = new Date(input);
            if (!isNaN(d.getTime())) return d.toISOString();
        }

        return new Date().toISOString();
    } catch {
        return new Date().toISOString();
    }
};

// 3. Parse mảng Team an toàn
const parseTeamSafe = (t: any): string[] => {
    if (!t) return [];
    
    let rawArray: any[] = [];

    if (Array.isArray(t)) {
        rawArray = t;
    } else if (typeof t === 'number') {
        rawArray = [String(t)]; // Convert single number to string array
    } else if (typeof t === 'string') {
        // Loại bỏ các ký tự gây nhiễu: [, ], ", '
        const cleanString = t.replace(/[\[\]"']/g, '');
        if (cleanString.trim() === '') return [];
        // Tách bằng dấu phẩy
        rawArray = cleanString.split(',');
    }

    // Ép kiểu về String và Trim khoảng trắng
    return rawArray
        .map(x => String(x).trim())
        .filter(x => x !== '' && x.toLowerCase() !== 'null' && x.toLowerCase() !== 'undefined');
};

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

export const syncToCloud = async (players: Player[], matches: Match[], tournament: TournamentState | null = null): Promise<boolean> => {
    const url = getApiUrl();
    console.log("Starting Cloud Sync (Upload)...");
    
    try {
        const response = await fetchWithTimeout(url, {
            method: 'POST',
            redirect: 'follow', 
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            // Gửi cả tournament
            body: JSON.stringify({ players, matches, tournament }),
        }, 30000); 

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

export const syncFromCloud = async (): Promise<{ players: Player[], matches: Match[], tournament: TournamentState | null }> => {
    const url = getApiUrl();
    const finalUrl = `${url}?nocache=${Date.now()}`;
    
    console.log("Starting Cloud Sync (Download) from:", finalUrl);

    try {
        const response = await fetchWithTimeout(finalUrl, {
            method: 'GET',
            redirect: 'follow',
            mode: 'cors',
            credentials: 'omit'
        }, 15000);

        if (!response.ok) {
            throw new Error(`Lỗi kết nối HTTP: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        
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
            const sanitizedPlayers = (result.data.players || []).map(p => ({
                ...p,
                id: String(getProp(p, 'id', 'Id', 'ID')).trim(),
                name: String(getProp(p, 'name', 'Name', 'HoTen') || 'Unknown').trim(),
                initialPoints: Number(getProp(p, 'initialPoints', 'InitialPoints', 'DiemGoc')) || 1000,
                isActive: getProp(p, 'isActive', 'IsActive') === false ? false : true
            })).filter(p => p.id !== "" && p.id !== "undefined");

            const idSet = new Set(sanitizedPlayers.map(p => p.id));
            const nameToIdMap = new Map<string, string>();
            sanitizedPlayers.forEach(p => {
                if (p.name) nameToIdMap.set(p.name.toLowerCase(), p.id);
            });

            const sanitizedMatches: Match[] = [];
            const rawMatches = result.data.matches || [];
            
            rawMatches.forEach((m: any, index: number) => {
                try {
                    let rawId = getProp(m, 'id', 'MatchId', 'ID');
                    let rawType = getProp(m, 'type', 'Type', 'Loai');
                    let rawDate = getProp(m, 'date', 'Date', 'Ngay');
                    let rawTeam1 = getProp(m, 'team1', 'Team1', 'Doi1');
                    let rawTeam2 = getProp(m, 'team2', 'Team2', 'Doi2');
                    let rawScore1 = getProp(m, 'score1', 'Score1', 'Diem1');
                    let rawScore2 = getProp(m, 'score2', 'Score2', 'Diem2');
                    let rawWinner = getProp(m, 'winner', 'Winner');
                    let rawPoints = getProp(m, 'rankingPoints', 'RankingPoints', 'DiemThuong');

                    // --- AUTO-FIX FOR SHIFTED COLUMNS (MISSING ID) ---
                    // Nếu ID lại chứa giá trị 'betting' hoặc 'tournament', tức là cột bị lệch sang trái
                    if (rawId && String(rawId).trim().match(/^(betting|tournament)$/i)) {
                        console.warn("Detected shifted columns at row", index, m);
                        // Shift values to the right to align with correct headers
                        // Mapping: ID(betting) -> Type, Type(Date) -> Date, Date(T1) -> T1, etc.
                        
                        // Cấu trúc dữ liệu bị lệch:
                        // ID=Type, Type=Date, Date=T1, T1=T2, T2=S1, S1=S2, S2=Winner, RP=RP
                        
                        rawPoints = rawPoints; // Vẫn đúng nếu file có 8 cột và RankingPoints là cuối cùng
                        rawWinner = rawScore2; // Cột Score2 chứa Winner
                        rawScore2 = rawScore1; // Cột Score1 chứa Score2
                        rawScore1 = rawTeam2;  // Cột Team2 chứa Score1
                        rawTeam2 = rawTeam1;   // Cột Team1 chứa Team2
                        rawTeam1 = rawDate;    // Cột Date chứa Team1
                        rawDate = rawType;     // Cột Type chứa Date
                        rawType = rawId;       // Cột ID chứa Type
                        
                        // Tạo ID giả để không bị skip
                        rawId = `recovered_${Date.now()}_${index}`;
                    }

                    if (!rawId) return; 
                    const matchId = String(rawId).trim();

                    let team1 = parseTeamSafe(rawTeam1);
                    let team2 = parseTeamSafe(rawTeam2);

                    const normalizeIds = (ids: string[]) => {
                        return ids.map(item => {
                            const cleanItem = item.trim();
                            if (idSet.has(cleanItem)) return cleanItem;
                            const foundId = nameToIdMap.get(cleanItem.toLowerCase());
                            return foundId || cleanItem; 
                        });
                    };

                    team1 = normalizeIds(team1);
                    team2 = normalizeIds(team2);
                    
                    const s1 = Number(rawScore1) || 0;
                    const s2 = Number(rawScore2) || 0;
                    let winner: 1 | 2 = 1;
                    
                    if (s1 > s2) winner = 1;
                    else if (s2 > s1) winner = 2;
                    else {
                        // Fallback to explicit winner column if scores are equal or zero (shifted data case)
                        const wVal = Number(rawWinner);
                        winner = wVal === 2 ? 2 : 1;
                    }

                    sanitizedMatches.push({
                        id: matchId,
                        type: rawType === 'tournament' ? 'tournament' : 'betting', 
                        date: parseDateSafe(rawDate), 
                        team1,
                        team2,
                        score1: s1,
                        score2: s2,
                        winner: winner, 
                        rankingPoints: Number(rawPoints) || 0
                    });
                } catch (err) {
                    console.warn("Skipping invalid match row from Cloud:", m, err);
                }
            });

            // Handle Tournament State Parsing (Needs robust parsing too if stored in a cell)
            let tournament: TournamentState | null = null;
            if (result.data.tournament) {
                // If it's a string (from Sheet cell), parse it
                if (typeof result.data.tournament === 'string') {
                    try {
                        tournament = JSON.parse(result.data.tournament);
                    } catch (e) { console.error("Failed to parse tournament JSON string", e); }
                } else {
                    tournament = result.data.tournament;
                }
            }

            return {
                players: sanitizedPlayers,
                matches: sanitizedMatches,
                tournament: tournament
            };
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