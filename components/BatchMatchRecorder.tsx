import React, { useState, useMemo } from 'react';
import { Player, Match } from '../types';
import { Card } from './Card';
import { Plus, Trash2, Save, User, Users, AlertCircle, Banknote, Trophy } from 'lucide-react';

interface BatchMatchRecorderProps {
  players: Player[];
  onSave: (matches: Omit<Match, 'id'>[]) => void;
  onCancel: () => void;
}

interface BatchRow {
  id: string; // Temporary ID for UI handling
  mode: 'singles' | 'doubles';
  team1: string[];
  team2: string[];
  score1: string;
  score2: string;
  rankingPoints: number;
}

export const BatchMatchRecorder: React.FC<BatchMatchRecorderProps> = ({ players, onSave, onCancel }) => {
  const [matchType, setMatchType] = useState<'betting' | 'tournament'>('betting');
  const [matchDate, setMatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Initialize with one empty row
  const [rows, setRows] = useState<BatchRow[]>([
    { id: '1', mode: 'doubles', team1: ['', ''], team2: ['', ''], score1: '', score2: '', rankingPoints: 50 }
  ]);

  const [error, setError] = useState<string | null>(null);

  // Sort players alphabetically for dropdowns
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  const addRow = () => {
    const newId = Date.now().toString();
    setRows([...rows, { id: newId, mode: 'doubles', team1: ['', ''], team2: ['', ''], score1: '', score2: '', rankingPoints: 50 }]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return; // Keep at least one row
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof BatchRow, value: any) => {
    setRows(rows.map(r => {
      if (r.id !== id) return r;
      
      // Special handling for mode change to reset slots
      if (field === 'mode') {
        const newMode = value as 'singles' | 'doubles';
        const count = newMode === 'singles' ? 1 : 2;
        // Keep existing selections if possible, otherwise reset or trim
        const t1 = r.team1.slice(0, count);
        const t2 = r.team2.slice(0, count);
        while(t1.length < count) t1.push('');
        while(t2.length < count) t2.push('');
        
        return { ...r, mode: newMode, team1: t1, team2: t2 };
      }

      return { ...r, [field]: value };
    }));
  };

  const updateTeamSlot = (rowId: string, team: 1 | 2, slotIndex: number, playerId: string) => {
    setRows(rows.map(r => {
      if (r.id !== rowId) return r;
      
      if (team === 1) {
        const newTeam = [...r.team1];
        newTeam[slotIndex] = playerId;
        return { ...r, team1: newTeam };
      } else {
        const newTeam = [...r.team2];
        newTeam[slotIndex] = playerId;
        return { ...r, team2: newTeam };
      }
    }));
  };

  const getAvailablePlayers = (currentRow: BatchRow, currentId: string) => {
    const rowSelectedIds = [...currentRow.team1, ...currentRow.team2].filter(id => id !== currentId && id !== '');
    return sortedPlayers.filter(p => !rowSelectedIds.includes(p.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validMatches: Omit<Match, 'id'>[] = [];
    const finalDate = new Date(matchDate);
    finalDate.setHours(new Date().getHours(), new Date().getMinutes());

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let s1 = parseInt(r.score1);
      let s2 = parseInt(r.score2);

      if (isNaN(s1) || isNaN(s2)) {
          setError(`Trận số ${i + 1}: Vui lòng nhập đầy đủ tỉ số.`);
          return;
      }

      if (s1 === s2) {
          setError(`Trận số ${i + 1}: Tỉ số không được hòa.`);
          return;
      }
      
      const winner = s1 > s2 ? 1 : 2;
      
      const t1Filled = r.team1.filter(p => p !== '');
      const t2Filled = r.team2.filter(p => p !== '');
      const required = r.mode === 'singles' ? 1 : 2;

      if (t1Filled.length !== required || t2Filled.length !== required) {
        setError(`Trận số ${i + 1}: Vui lòng chọn đủ vận động viên.`);
        return;
      }

      const allP = [...t1Filled, ...t2Filled];
      if (new Set(allP).size !== allP.length) {
         setError(`Trận số ${i + 1}: Có vận động viên bị trùng.`);
         return;
      }

      validMatches.push({
        type: matchType,
        date: finalDate.toISOString(),
        team1: t1Filled,
        team2: t2Filled,
        score1: s1,
        score2: s2,
        winner: winner,
        rankingPoints: r.rankingPoints
      });
    }

    onSave(validMatches);
  };

  return (
    <Card className="max-w-7xl mx-auto overflow-visible p-0 sm:p-6" classNameTitle="px-4">
      <div className="flex flex-col gap-4 mb-2 sm:mb-6 p-4 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
            <h2 className="text-xl font-bold text-slate-800">Ghi Trận Chung</h2>
            <p className="text-sm text-slate-600 font-medium">Nhập danh sách nhiều trận đấu cùng lúc</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                 {/* Type Selector */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        type="button"
                        onClick={() => setMatchType('betting')}
                        className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1 transition-all ${
                            matchType === 'betting' 
                            ? 'bg-white text-slate-800 shadow-sm border border-slate-200' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Banknote className="w-3 h-3" /> KÈO
                    </button>
                    <button
                        type="button"
                        onClick={() => setMatchType('tournament')}
                        className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1 transition-all ${
                            matchType === 'tournament' 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Trophy className="w-3 h-3" /> GIẢI
                    </button>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 w-full sm:w-auto">
                    <span className="text-sm font-bold text-slate-700 px-2 whitespace-nowrap">Ngày đấu:</span>
                    <input 
                        type="date"
                        value={matchDate}
                        onChange={(e) => setMatchDate(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker()}
                        className="bg-white border border-slate-300 text-slate-900 text-sm rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pickle-500 font-bold cursor-pointer w-full"
                    />
                </div>
            </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-2 sm:px-0">
        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block overflow-x-auto pb-4">
            <table className="w-full min-w-[900px] border-collapse">
                <thead>
                    <tr className="text-xs font-bold text-slate-700 uppercase tracking-wider text-left bg-slate-100 border-y border-slate-200">
                        <th className="py-4 px-3 w-10 text-center text-slate-400">#</th>
                        <th className="py-4 px-2 w-28 text-center">Chế độ</th>
                        <th className="py-4 px-2 w-[30%] text-center text-green-800 border-l border-slate-200">Đội 1</th>
                        <th className="py-4 px-2 w-32 text-center border-l border-slate-200">Tỉ Số</th>
                        <th className="py-4 px-2 w-[30%] text-center text-blue-800 border-l border-slate-200">Đội 2</th>
                        <th className="py-4 px-2 w-24 text-center border-l border-slate-200">Mức Cược</th>
                        <th className="py-4 px-2 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {rows.map((row, index) => (
                        <tr key={row.id} className="group transition-colors even:bg-slate-50 hover:bg-white border-b border-slate-200">
                            {/* Index */}
                            <td className="py-3 px-3 text-center font-bold text-slate-400">
                                {index + 1}
                            </td>

                            {/* Mode Toggle */}
                            <td className="py-3 px-2 text-center">
                                <button
                                    type="button"
                                    onClick={() => updateRow(row.id, 'mode', row.mode === 'doubles' ? 'singles' : 'doubles')}
                                    className={`w-full py-1.5 rounded border transition-colors flex items-center justify-center gap-1 text-xs font-bold ${
                                        row.mode === 'doubles' 
                                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                        : 'bg-teal-50 text-teal-700 border-teal-200'
                                    }`}
                                >
                                    {row.mode === 'doubles' ? <><Users size={14} /> Đôi</> : <><User size={14} /> Đơn</>}
                                </button>
                            </td>

                            {/* Team 1 */}
                            <td className="py-3 px-4 border-l border-slate-200">
                                <div className="flex flex-col gap-2">
                                    <select
                                        value={row.team1[0]}
                                        onChange={(e) => updateTeamSlot(row.id, 1, 0, e.target.value)}
                                        className="w-full text-xs py-2 px-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500 font-bold text-slate-900 shadow-sm"
                                    >
                                        <option value="">-- P1 --</option>
                                        {getAvailablePlayers(row, row.team1[0]).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    {row.mode === 'doubles' && (
                                        <select
                                            value={row.team1[1]}
                                            onChange={(e) => updateTeamSlot(row.id, 1, 1, e.target.value)}
                                            className="w-full text-xs py-2 px-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500 font-bold text-slate-900 shadow-sm"
                                        >
                                            <option value="">-- P2 --</option>
                                            {getAvailablePlayers(row, row.team1[1]).map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </td>

                            {/* Score Inputs */}
                            <td className="py-3 px-2 border-l border-slate-200">
                                <div className="flex gap-1 justify-center items-center">
                                    <input 
                                        type="number"
                                        value={row.score1}
                                        onChange={(e) => updateRow(row.id, 'score1', e.target.value)}
                                        className="w-10 h-10 text-center font-bold text-green-700 bg-green-50 border border-green-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                        placeholder="-"
                                    />
                                    <span className="text-slate-300 font-bold">:</span>
                                    <input 
                                        type="number"
                                        value={row.score2}
                                        onChange={(e) => updateRow(row.id, 'score2', e.target.value)}
                                        className="w-10 h-10 text-center font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="-"
                                    />
                                </div>
                            </td>

                            {/* Team 2 */}
                            <td className="py-3 px-4 border-l border-slate-200">
                                <div className="flex flex-col gap-2">
                                    <select
                                        value={row.team2[0]}
                                        onChange={(e) => updateTeamSlot(row.id, 2, 0, e.target.value)}
                                        className="w-full text-xs py-2 px-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-bold text-slate-900 shadow-sm"
                                    >
                                        <option value="">-- P1 --</option>
                                        {getAvailablePlayers(row, row.team2[0]).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    {row.mode === 'doubles' && (
                                        <select
                                            value={row.team2[1]}
                                            onChange={(e) => updateTeamSlot(row.id, 2, 1, e.target.value)}
                                            className="w-full text-xs py-2 px-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-bold text-slate-900 shadow-sm"
                                        >
                                            <option value="">-- P2 --</option>
                                            {getAvailablePlayers(row, row.team2[1]).map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </td>

                            {/* Ranking Points */}
                            <td className="py-3 px-2 text-center border-l border-slate-200">
                                <div className="flex flex-col gap-2 justify-center items-center">
                                    {matchType === 'betting' ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => updateRow(row.id, 'rankingPoints', 50)}
                                                className={`w-full text-[10px] px-2 py-1 rounded border transition-all ${row.rankingPoints === 50 ? 'bg-yellow-500 border-yellow-500 text-white shadow-sm scale-105' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                            >
                                                50
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateRow(row.id, 'rankingPoints', 100)}
                                                className={`w-full text-[10px] px-2 py-1 rounded border transition-all ${row.rankingPoints === 100 ? 'bg-yellow-500 border-yellow-500 text-white shadow-sm scale-105' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                            >
                                                100
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">N/A</span>
                                    )}
                                </div>
                            </td>

                            {/* Remove Row */}
                            <td className="py-3 px-2 text-center">
                                <button
                                    type="button"
                                    onClick={() => removeRow(row.id)}
                                    className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                    disabled={rows.length === 1}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="md:hidden space-y-6 pb-4">
            {rows.map((row, index) => (
                <div key={row.id} className="bg-white border-2 border-slate-200 rounded-xl shadow-md overflow-hidden relative">
                    {/* Distinct Header per Card */}
                    <div className="flex items-center justify-between bg-slate-100 p-3 border-b border-slate-200">
                         <div className="flex items-center gap-2">
                             <div className="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded">TRẬN {index + 1}</div>
                             <button
                                type="button"
                                onClick={() => updateRow(row.id, 'mode', row.mode === 'doubles' ? 'singles' : 'doubles')}
                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${
                                    row.mode === 'doubles' 
                                    ? 'bg-purple-100 text-purple-700 border-purple-200' 
                                    : 'bg-teal-100 text-teal-700 border-teal-200'
                                }`}
                            >
                                {row.mode === 'doubles' ? <><Users size={12} /> Đôi</> : <><User size={12} /> Đơn</>}
                            </button>
                         </div>
                         <div className="flex items-center gap-2">
                             {rows.length > 1 && (
                                 <button onClick={() => removeRow(row.id)} className="text-slate-400 hover:text-red-500 p-1 bg-white rounded-full border border-slate-200">
                                     <Trash2 size={16} />
                                 </button>
                             )}
                         </div>
                    </div>

                    <div className="p-3 space-y-3">
                        {/* Team 1 Section */}
                        <div className="bg-green-50/50 p-2 rounded-lg border border-green-100">
                            <div className="text-[10px] font-bold text-green-700 uppercase mb-2">Đội 1</div>
                            <div className="flex gap-2">
                                <select
                                    value={row.team1[0]}
                                    onChange={(e) => updateTeamSlot(row.id, 1, 0, e.target.value)}
                                    className="flex-1 text-sm py-2 px-2 bg-white border border-slate-300 rounded font-bold text-slate-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none shadow-sm"
                                >
                                    <option value="">- Người 1 -</option>
                                    {getAvailablePlayers(row, row.team1[0]).map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                {row.mode === 'doubles' && (
                                    <select
                                        value={row.team1[1]}
                                        onChange={(e) => updateTeamSlot(row.id, 1, 1, e.target.value)}
                                        className="flex-1 text-sm py-2 px-2 bg-white border border-slate-300 rounded font-bold text-slate-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none shadow-sm"
                                    >
                                        <option value="">- Người 2 -</option>
                                        {getAvailablePlayers(row, row.team1[1]).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                         {/* Scores & Points */}
                        <div className="grid grid-cols-5 gap-2 items-center">
                            <div className="col-span-3 flex justify-center gap-1 bg-slate-50 p-2 rounded border border-slate-100">
                                <input 
                                    type="number"
                                    value={row.score1}
                                    onChange={(e) => updateRow(row.id, 'score1', e.target.value)}
                                    className="w-12 h-10 text-center font-bold text-lg text-green-700 bg-white border border-green-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                    placeholder="0"
                                />
                                <span className="text-slate-300 font-bold self-center">:</span>
                                <input 
                                    type="number"
                                    value={row.score2}
                                    onChange={(e) => updateRow(row.id, 'score2', e.target.value)}
                                    className="w-12 h-10 text-center font-bold text-lg text-blue-700 bg-white border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="0"
                                />
                            </div>

                            <div className="col-span-2 flex flex-col gap-1">
                                {matchType === 'betting' ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => updateRow(row.id, 'rankingPoints', 50)}
                                            className={`flex-1 rounded text-[10px] font-bold border ${row.rankingPoints === 50 ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                                        >
                                            50
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => updateRow(row.id, 'rankingPoints', 100)}
                                            className={`flex-1 rounded text-[10px] font-bold border ${row.rankingPoints === 100 ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                                        >
                                            100
                                        </button>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-xs text-slate-300 italic border rounded bg-slate-50">N/A</div>
                                )}
                            </div>
                        </div>

                        {/* Team 2 Section */}
                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                            <div className="text-[10px] font-bold text-blue-700 uppercase mb-2">Đội 2</div>
                            <div className="flex gap-2">
                                <select
                                    value={row.team2[0]}
                                    onChange={(e) => updateTeamSlot(row.id, 2, 0, e.target.value)}
                                    className="flex-1 text-sm py-2 px-2 bg-white border border-slate-300 rounded font-bold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-sm"
                                >
                                    <option value="">- Người 1 -</option>
                                    {getAvailablePlayers(row, row.team2[0]).map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                {row.mode === 'doubles' && (
                                    <select
                                        value={row.team2[1]}
                                        onChange={(e) => updateTeamSlot(row.id, 2, 1, e.target.value)}
                                        className="flex-1 text-sm py-2 px-2 bg-white border border-slate-300 rounded font-bold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-sm"
                                    >
                                        <option value="">- Người 2 -</option>
                                        {getAvailablePlayers(row, row.team2[1]).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200 mb-4 mx-2 sm:mx-0">
                <AlertCircle size={16} />
                {error}
            </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100 p-2 sm:p-0 sticky bottom-0 bg-white/95 backdrop-blur-sm z-20 pb-4">
             <button
                type="button"
                onClick={addRow}
                className="flex items-center justify-center gap-2 py-3 sm:py-2 px-4 bg-orange-600 hover:bg-orange-700 ring-2 ring-orange-200 text-white font-bold rounded-lg transition-all shadow-md animate-[pulse_3s_ease-in-out_infinite]"
             >
                <Plus size={18} strokeWidth={3} /> THÊM DÒNG
             </button>
             
             <div className="flex-1 hidden sm:block"></div>

             <div className="flex gap-2 w-full sm:w-auto">
                 <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 sm:flex-none py-3 sm:py-2 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                 >
                    Hủy
                 </button>
                 
                 <button
                    type="submit"
                    className="flex-[2] sm:flex-none py-3 sm:py-2 px-8 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-lg shadow-slate-300 transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                 >
                    <Save size={18} /> Lưu {rows.length} Trận
                 </button>
             </div>
        </div>
      </form>
    </Card>
  );
};