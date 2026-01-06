import React, { useState, useEffect, useRef } from 'react';
import { Player, Match, TabView } from './types';
import { getPlayers, getMatches, saveMatches, savePlayers, calculatePlayerStats } from './services/storageService';
import { getApiUrl, syncToCloud, syncFromCloud } from './services/googleSheetService';
import { Leaderboard } from './components/Leaderboard';
import { BatchMatchRecorder } from './components/BatchMatchRecorder';
import { DashboardStats } from './components/DashboardStats';
import { RecentMatches } from './components/RecentMatches';
import { PlayerManager } from './components/PlayerManager';
import { TournamentManager } from './components/TournamentManager'; 
import { Analysis } from './components/Analysis';
import { AiMatchmaker } from './components/AiMatchmaker'; 
import { CloudSync } from './components/CloudSync';
import { ChangelogModal } from './components/ChangelogModal'; // New Import
import { LayoutDashboard, History, Trophy, PlusCircle, Zap, Cloud, Loader2, CheckCircle2, AlertCircle, CloudOff, Swords, UserCog, Scale, Plus, BrainCircuit, Users, Bell } from 'lucide-react';

// Current App Version - Bump this to trigger red dot for users
const APP_VERSION = '3.3.0';

const App: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<TabView | 'tournament'>('dashboard');
  
  // Recording Mode: 'none' or 'batch'
  const [recordingMode, setRecordingMode] = useState<'none' | 'batch'>('none');

  // Cloud Sync State
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Changelog State
  const [showChangelog, setShowChangelog] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(false);

  // --- SYNC QUEUE REFS ---
  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef<{players: Player[], matches: Match[]} | null>(null);

  // --- AUTO SYNC LOGIC ---
  const performAutoSync = async (currentPlayers: Player[], currentMatches: Match[]) => {
    const url = getApiUrl();
    if (!url) return;

    if (isSyncingRef.current) {
        pendingSyncRef.current = { players: currentPlayers, matches: currentMatches };
        return;
    }

    isSyncingRef.current = true;
    setSyncStatus('syncing');

    try {
        await syncToCloud(currentPlayers, currentMatches);
        setSyncStatus('success');
        setTimeout(() => setSyncStatus(prev => prev === 'success' ? 'idle' : prev), 2000);
    } catch (e) {
        console.error("Auto sync failed:", e);
        setSyncStatus('error');
    } finally {
        isSyncingRef.current = false;
        if (pendingSyncRef.current) {
            const { players: nextPlayers, matches: nextMatches } = pendingSyncRef.current;
            pendingSyncRef.current = null;
            performAutoSync(nextPlayers, nextMatches);
        }
    }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    const initData = async () => {
      const localMatches = getMatches();
      const localPlayers = getPlayers();
      const localStats = calculatePlayerStats(localPlayers, localMatches);
      
      setMatches(localMatches);
      setPlayers(localStats);

      // Check Version for Changelog
      const lastSeenVersion = localStorage.getItem('picklepro_last_version');
      if (lastSeenVersion !== APP_VERSION) {
          setHasNewUpdate(true);
      }

      const url = getApiUrl();
      if (url) {
        setSyncStatus('syncing');
        try {
          const cloudData = await syncFromCloud();
          const cloudStats = calculatePlayerStats(cloudData.players, cloudData.matches);
          
          setMatches(cloudData.matches);
          setPlayers(cloudStats);
          saveMatches(cloudData.matches);
          savePlayers(cloudStats);

          setSyncStatus('success');
          setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
          console.error("Initial cloud fetch failed:", e);
          setSyncStatus('error');
        }
      }
    };

    initData();
  }, []);

  // --- HANDLERS ---
  const handleCloudDataLoaded = (newPlayers: Player[], newMatches: Match[]) => {
      savePlayers(newPlayers);
      saveMatches(newMatches);
      const recalculatedPlayers = calculatePlayerStats(newPlayers, newMatches);
      setMatches(newMatches);
      setPlayers(recalculatedPlayers);
      savePlayers(recalculatedPlayers);
      setSyncStatus('success');
  };

  const handleSaveBatchMatches = (matchesData: Omit<Match, 'id'>[]) => {
    const newMatches: Match[] = matchesData.map((m, index) => ({
        ...m,
        id: (Date.now() + index).toString()
    }));

    const updatedMatches = [...matches, ...newMatches];
    const updatedPlayers = calculatePlayerStats(players, updatedMatches);

    setMatches(updatedMatches);
    setPlayers(updatedPlayers);
    saveMatches(updatedMatches);
    savePlayers(updatedPlayers);

    performAutoSync(updatedPlayers, updatedMatches);

    alert("Lưu kết quả thành công!");
    setRecordingMode('none');
    setActiveTab('matches');
  };

  // Allow passing IDs if present (for updating Pending matches)
  const handleTournamentSave = (matchesData: (Omit<Match, 'id'> & { id?: string })[]) => {
      const newMatches: Match[] = matchesData.map((m, index) => ({
          ...m,
          id: m.id || (Date.now() + index).toString()
      }));

      const updatedMatches = [...matches, ...newMatches];
      // Note: calculatePlayerStats will automatically ignore negative scores (pending matches)
      const updatedPlayers = calculatePlayerStats(players, updatedMatches);

      setMatches(updatedMatches);
      setPlayers(updatedPlayers);
      saveMatches(updatedMatches);
      savePlayers(updatedPlayers);

      performAutoSync(updatedPlayers, updatedMatches);
  };

  const handleDeleteMatch = (id: string) => {
     const updatedMatches = matches.filter(m => m.id !== id);
     // Optimization: Only recalc if match count changed
     if (matches.length === updatedMatches.length) return;

     const updatedPlayers = calculatePlayerStats(players, updatedMatches);

     setMatches(updatedMatches);
     setPlayers(updatedPlayers);
     saveMatches(updatedMatches);
     savePlayers(updatedPlayers);

     performAutoSync(updatedPlayers, updatedMatches);
  };

  const handleAddPlayer = (name: string, initialPoints: number) => {
    const newPlayer: Player = {
      id: Date.now().toString(),
      name,
      initialPoints,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsScored: 0,
      pointsConceded: 0,
      totalRankingPoints: initialPoints,
      championships: 0,
      isActive: true
    };
    
    const updatedPlayers = [...players, newPlayer];
    setPlayers(updatedPlayers);
    savePlayers(updatedPlayers);
    performAutoSync(updatedPlayers, matches);
  };

  const handleDeletePlayer = (id: string) => {
    const updatedPlayers = players.filter(p => p.id !== id);
    setPlayers(updatedPlayers);
    savePlayers(updatedPlayers);
    performAutoSync(updatedPlayers, matches);
  };

  const handleTogglePlayerStatus = (id: string) => {
      const updatedPlayers = players.map(p => 
          p.id === id ? { ...p, isActive: !p.isActive } : p
      );
      setPlayers(updatedPlayers);
      savePlayers(updatedPlayers);
      performAutoSync(updatedPlayers, matches);
  };

  const handleOpenChangelog = () => {
      setShowChangelog(true);
      setHasNewUpdate(false);
      localStorage.setItem('picklepro_last_version', APP_VERSION);
  };

  // --- COMPONENTS ---
  
  // Header Nav Button (Desktop)
  const HeaderNavBtn = ({ tab, label }: { tab: any; label: string }) => (
      <button
          onClick={() => { setActiveTab(tab); setRecordingMode('none'); }}
          className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
              activeTab === tab && recordingMode === 'none'
              ? 'bg-pickle-500 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
      >
          {label}
      </button>
  );

  // Sync Indicator
  const SyncStatusIcon = () => {
      const url = getApiUrl();
      if (!url) return <CloudOff className="w-5 h-5 text-slate-500" />;
      switch (syncStatus) {
          case 'syncing': return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
          case 'success': return <CheckCircle2 className="w-5 h-5 text-green-400" />;
          case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
          default: return <Cloud className="w-5 h-5 text-slate-400" />;
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0">
      {/* HEADER (Desktop & Mobile) */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
             <div className="bg-pickle-500 p-1.5 rounded-lg">
                <Zap className="w-5 h-5 text-white" fill="currentColor" />
             </div>
             <div className="hidden sm:block">
                <h1 className="text-xl font-black tracking-tight leading-none">PICKLE<span className="text-pickle-400">PRO</span></h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider">STATS & BETTING</p>
             </div>
             {/* Mobile Logo: Compact */}
             <div className="sm:hidden">
                <h1 className="text-lg font-black tracking-tight">P<span className="text-pickle-400">P</span></h1>
             </div>
          </div>

          {/* Desktop Navigation (Inline) */}
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar">
              <HeaderNavBtn tab="dashboard" label="Tổng Quan" />
              <HeaderNavBtn tab="matches" label="Lịch Sử" />
              <HeaderNavBtn tab="leaderboard" label="BXH" />
              <HeaderNavBtn tab="analysis" label="So Kèo" />
              <HeaderNavBtn tab="ai-match" label="So Kèo AI" />
              <HeaderNavBtn tab="tournament" label="Giải Đấu" />
              <HeaderNavBtn tab="players" label="Người Chơi" />
          </nav>
          
          {/* Right Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
             {/* Desktop: Batch Record Button */}
             <button 
                onClick={() => setRecordingMode('batch')}
                className="hidden md:flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md font-bold text-sm transition-colors shadow-md border border-orange-500 mr-2"
             >
                <Plus size={16} strokeWidth={3} />
                Ghi Trận Chung
             </button>

             {/* Mobile: Top Header Navigation Shortcuts */}
             <div className="md:hidden flex items-center gap-0.5">
                 {/* So Kèo */}
                 <button 
                    onClick={() => { setActiveTab('analysis'); setRecordingMode('none'); }}
                    className={`p-2 rounded-full transition-colors ${activeTab === 'analysis' ? 'text-pickle-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                    title="So Kèo"
                 >
                    <Scale className="w-5 h-5" />
                 </button>
                 
                 {/* So Kèo AI */}
                 <button 
                    onClick={() => { setActiveTab('ai-match'); setRecordingMode('none'); }}
                    className={`p-2 rounded-full transition-colors ${activeTab === 'ai-match' ? 'text-pickle-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                    title="So Kèo AI"
                 >
                    <BrainCircuit className="w-5 h-5" />
                 </button>

                 {/* Người Chơi */}
                 <button 
                    onClick={() => { setActiveTab('players'); setRecordingMode('none'); }}
                    className={`p-2 rounded-full transition-colors ${activeTab === 'players' ? 'text-pickle-400 bg-slate-800' : 'text-slate-400 hover:text-white'}`}
                    title="Người Chơi"
                 >
                    <Users className="w-5 h-5" />
                 </button>
             </div>

             <div className="w-px h-6 bg-slate-700 mx-1"></div>

             {/* Changelog Notification Button */}
             <button
                onClick={handleOpenChangelog}
                className="p-2 rounded-full hover:bg-slate-800 transition-colors relative"
                title="Thông báo cập nhật"
             >
                <Bell className={`w-5 h-5 ${hasNewUpdate ? 'text-yellow-400' : 'text-slate-400'}`} />
                {hasNewUpdate && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-slate-900"></span>
                )}
             </button>

             <button 
                onClick={() => setIsSyncOpen(true)}
                className="p-2 rounded-full hover:bg-slate-800 transition-colors relative"
                title="Đồng bộ Cloud"
             >
                <SyncStatusIcon />
                {syncStatus === 'error' && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="animate-fade-in min-h-[500px]">
            {activeTab === 'dashboard' && <DashboardStats matches={matches} players={players} />}
            
            {activeTab === 'matches' && (
                <div className="space-y-6">
                    <RecentMatches 
                        matches={matches} 
                        players={players} 
                        onDeleteMatch={handleDeleteMatch} 
                    />
                </div>
            )}
            
            {activeTab === 'leaderboard' && <Leaderboard players={players} matches={matches} />}

            {activeTab === 'analysis' && <Analysis players={players} matches={matches} />}

            {activeTab === 'ai-match' && <AiMatchmaker players={players} matches={matches} />}
            
            {activeTab === 'tournament' && (
                <TournamentManager 
                    players={players} 
                    matches={matches} // New Prop for Sync
                    onSaveMatches={handleTournamentSave} 
                    onDeleteMatch={handleDeleteMatch} // New Prop for Sync
                />
            )}
            
            {activeTab === 'players' && (
                <PlayerManager 
                    players={players} 
                    onAddPlayer={handleAddPlayer} 
                    onDeletePlayer={handleDeletePlayer}
                    onToggleActive={handleTogglePlayerStatus}
                />
            )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-1 flex justify-between items-end z-50 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {/* 1. Tổng Quan */}
        <button 
            onClick={() => { setActiveTab('dashboard'); setRecordingMode('none'); }} 
            className={`flex-1 flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'text-pickle-600' : 'text-slate-400'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-bold">Tổng Quan</span>
        </button>

        {/* 2. Lịch Sử */}
        <button 
            onClick={() => { setActiveTab('matches'); setRecordingMode('none'); }} 
            className={`flex-1 flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors ${activeTab === 'matches' ? 'text-pickle-600' : 'text-slate-400'}`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-bold">Lịch Sử</span>
        </button>
        
        {/* Floating Add Button Placeholder (Spacing) */}
        <div className="w-16"></div>

        {/* 3. BXH */}
        <button 
            onClick={() => { setActiveTab('leaderboard'); setRecordingMode('none'); }} 
            className={`flex-1 flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors ${activeTab === 'leaderboard' ? 'text-pickle-600' : 'text-slate-400'}`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px] font-bold">BXH</span>
        </button>

        {/* 4. Giải Đấu */}
        <button 
            onClick={() => { setActiveTab('tournament'); setRecordingMode('none'); }} 
            className={`flex-1 flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors ${activeTab === 'tournament' ? 'text-pickle-600' : 'text-slate-400'}`}
        >
          <Swords className="w-5 h-5" />
          <span className="text-[10px] font-bold">Giải Đấu</span>
        </button>
      </div>

      {/* Mobile Floating Action Button (Only Visible on Mobile now) */}
      <button
        onClick={() => setRecordingMode('batch')}
        className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-full shadow-xl shadow-slate-900/30 transition-all hover:scale-110 z-50 group border-4 border-slate-50"
      >
        <PlusCircle className="w-8 h-8 text-pickle-400" />
      </button>

      {/* Batch Match Recorder Modal */}
      {recordingMode === 'batch' && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm overflow-y-auto animate-fade-in p-0 sm:p-4">
           <div className="min-h-full flex items-center justify-center">
             <div className="w-full max-w-7xl">
                <BatchMatchRecorder 
                    players={players} 
                    onSave={handleSaveBatchMatches} 
                    onCancel={() => setRecordingMode('none')} 
                />
             </div>
           </div>
        </div>
      )}

      {/* Cloud Sync Modal */}
      {isSyncOpen && (
        <CloudSync 
            players={players} 
            matches={matches} 
            onDataLoaded={handleCloudDataLoaded}
            onClose={() => setIsSyncOpen(false)}
        />
      )}

      {/* Changelog Modal */}
      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}

    </div>
  );
};

export default App;