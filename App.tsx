import React, { useState, useEffect } from 'react';
import { Player, Match, TabView, TournamentState } from './types';
import { 
    getPlayers, getMatches, saveMatches, savePlayers, 
    calculatePlayerStats, getTournamentState, saveTournamentState
} from './services/storageService';
import { 
    subscribeToMatches, subscribeToPlayers, subscribeToConfig,
    deleteMatchFromCloud, saveBatchMatchesToCloud,
    addPlayerToCloud, deletePlayerFromCloud, updateTournamentInCloud
} from './services/firebaseService';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Leaderboard } from './components/Leaderboard';
import { BatchMatchRecorder } from './components/BatchMatchRecorder';
import { DashboardStats } from './components/DashboardStats';
import { RecentMatches } from './components/RecentMatches';
import { PlayerManager } from './components/PlayerManager';
import { TournamentManager } from './components/TournamentManager'; 
import { Analysis } from './components/Analysis';
import { AiMatchmaker } from './components/AiMatchmaker'; 
import { CloudSync } from './components/CloudSync';
import { Banner } from './components/Banner';
import { LayoutDashboard, History, Trophy, PlusCircle, Swords, Zap, Cloud, Loader2, AlertCircle, Scale, Plus, BrainCircuit, Users, Image as ImageIcon, LogOut, LogIn } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  // Manage Tournament State Globally
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  
  const [activeTab, setActiveTab] = useState<TabView | 'tournament'>('dashboard');
  
  // Recording Mode: 'none' or 'batch'
  const [recordingMode, setRecordingMode] = useState<'none' | 'batch'>('none');

  // Cloud Sync State
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Banner State
  const [isEditingBanner, setIsEditingBanner] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(() => localStorage.getItem('picklepro_banner_url'));

  // --- AUTHENTICATION ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      alert("Đăng nhập thất bại. Vui lòng thử lại.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // --- REALTIME INITIALIZATION ---
  useEffect(() => {
    if (!isAuthReady) return;

    // Load instantly from cache
    const localMatches = getMatches();
    const localPlayers = getPlayers();
    const localTournament = getTournamentState();
    
    setMatches(localMatches);
    setPlayers(calculatePlayerStats(localPlayers, localMatches));
    setTournamentState(localTournament);

    setSyncStatus('syncing');

    // Setup real-time listeners
    const unsubMatches = subscribeToMatches((cloudMatches) => {
      // Sort matches by date
      cloudMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setMatches(() => {
        saveMatches(cloudMatches);
        // Player stats must be recalculated whenever matches update
        setPlayers(prevPlayers => {
            const newStats = calculatePlayerStats(prevPlayers, cloudMatches);
            savePlayers(newStats);
            return newStats;
        });
        return cloudMatches;
      });
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    });

    const unsubPlayers = subscribeToPlayers((cloudPlayers) => {
      setPlayers(() => {
          // Keep local stats logic flowing correctly simply using current matches memory
          // Actually, calculatePlayerStats re-aggregates based on current matches.
          // Since setMatches handles the heavy recalculation, here we just do a safe merge if needed, 
          // but Firestore is source of truth.
          const matchesInCache = getMatches(); 
          const currentStats = calculatePlayerStats(cloudPlayers, matchesInCache);
          savePlayers(currentStats);
          return currentStats;
      });
    });

    const unsubConfig = subscribeToConfig((cloudTournament, cloudBannerUrl) => {
      if (cloudTournament) {
        setTournamentState(cloudTournament);
        saveTournamentState(cloudTournament);
      } else {
        setTournamentState(null);
        saveTournamentState(null);
      }

      if (cloudBannerUrl !== null) {
        setBannerUrl(cloudBannerUrl);
        localStorage.setItem('picklepro_banner_url', cloudBannerUrl);
      } else {
        setBannerUrl('');
        localStorage.removeItem('picklepro_banner_url');
      }
    });

    return () => {
        unsubMatches();
        unsubPlayers();
        unsubConfig();
    };

  }, [user, isAuthReady]);

  // --- HANDLERS ---
  const handleCloudDataLoaded = (newPlayers: Player[], newMatches: Match[], newTournament: TournamentState | null) => {
      savePlayers(newPlayers);
      saveMatches(newMatches);
      
      // FIX: Apply same protection logic for manual download
      const currentLocal = getTournamentState();
      if (newTournament) {
          saveTournamentState(newTournament);
          setTournamentState(newTournament);
      } else if (currentLocal && currentLocal.isActive) {
          console.log("Manual sync: Preserving local active tournament");
          // Do NOT clear tournament state
      } else {
          saveTournamentState(null);
          setTournamentState(null);
      }
      
      // Note: Manual sync from CloudSync component currently doesn't return bannerUrl
      // We would need to update CloudSync to handle bannerUrl if we want manual sync to update it.
      
      const recalculatedPlayers = calculatePlayerStats(newPlayers, newMatches);
      setMatches(newMatches);
      setPlayers(recalculatedPlayers);
      savePlayers(recalculatedPlayers);
      
      setSyncStatus('success');
  };

  const handleSaveBatchMatches = async (matchesData: Omit<Match, 'id'>[]) => {
    const newMatches: Match[] = matchesData.map((m, index) => ({
        ...m,
        id: (Date.now() + index).toString()
    }));

    // Optimistic UI
    const updatedMatches = [...matches, ...newMatches];
    const updatedPlayers = calculatePlayerStats(players, updatedMatches);
    setMatches(updatedMatches);
    setPlayers(updatedPlayers);
    saveMatches(updatedMatches);
    savePlayers(updatedPlayers);

    setRecordingMode('none');
    setActiveTab('matches');

    await saveBatchMatchesToCloud(newMatches);
    alert("Đã đồng bộ kết quả lên Cloud!");
  };

  // Called when a match is finished in tournament
  const handleTournamentSaveMatch = async (matchesData: (Omit<Match, 'id'> & { id?: string })[]) => {
      const newMatches: Match[] = matchesData.map((m, index) => ({
          ...m,
          id: m.id || (Date.now() + index).toString()
      }));

      // Optimistic upate
      const updatedMatches = [...matches, ...newMatches];
      const updatedPlayers = calculatePlayerStats(players, updatedMatches);
      setMatches(updatedMatches);
      setPlayers(updatedPlayers);
      saveMatches(updatedMatches);
      savePlayers(updatedPlayers);

      await saveBatchMatchesToCloud(newMatches);
  };

  // Called whenever tournament state changes (new schedule, score update, finished)
  const handleUpdateTournamentState = async (newState: TournamentState | null) => {
      setTournamentState(newState);
      saveTournamentState(newState);
      await updateTournamentInCloud(newState);
  };

  const handleDeleteMatch = async (id: string) => {
     const updatedMatches = matches.filter(m => m.id !== id);
     if (matches.length === updatedMatches.length) return;

     // Optimistic update
     const updatedPlayers = calculatePlayerStats(players, updatedMatches);
     setMatches(updatedMatches);
     setPlayers(updatedPlayers);
     saveMatches(updatedMatches);
     savePlayers(updatedPlayers);

     await deleteMatchFromCloud(id);
  };

  const handleAddPlayer = async (name: string, initialPoints: number) => {
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
    
    // Optimistic
    const updatedPlayers = [...players, newPlayer];
    setPlayers(updatedPlayers);
    savePlayers(updatedPlayers);
    
    await addPlayerToCloud(newPlayer);
  };

  const handleDeletePlayer = async (id: string) => {
    const updatedPlayers = players.filter(p => p.id !== id);
    if(updatedPlayers.length === players.length) return;

    // Optimistic
    setPlayers(updatedPlayers);
    savePlayers(updatedPlayers);
    
    await deletePlayerFromCloud(id);
  };

  const handleTogglePlayerStatus = async (id: string) => {
      const playerToToggle = players.find(p => p.id === id);
      if (!playerToToggle) return;
      
      const newPlayer = { ...playerToToggle, isActive: !playerToToggle.isActive };
      
      const updatedPlayers = players.map(p => 
          p.id === id ? newPlayer : p
      );
      setPlayers(updatedPlayers);
      savePlayers(updatedPlayers);
      
      await addPlayerToCloud(newPlayer);
  };

  // --- COMPONENTS ---
  
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

  const SyncStatusIndicator = () => {
    return (
        <button 
           onClick={() => setIsSyncOpen(true)}
           className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-800 transition-colors"
           title="Trạng thái đồng bộ"
        >
            {syncStatus === 'syncing' ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> :
             syncStatus === 'error' ? <AlertCircle className="w-4 h-4 text-red-400" /> :
             <Cloud className="w-4 h-4 text-green-400" />}
            <span className="text-[10px] uppercase font-bold text-slate-400">
                {syncStatus === 'syncing' ? 'Đang tải' : syncStatus === 'error' ? 'Mất MX' : 'Online'}
            </span>
        </button>
    );
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
             <SyncStatusIndicator />
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

             {/* Banner Settings Button */}
             <button
                onClick={() => setIsEditingBanner(!isEditingBanner)}
                className={`p-2 rounded-full transition-colors ${isEditingBanner ? 'bg-pickle-500 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                title="Cập nhật Banner"
             >
                <ImageIcon size={20} />
             </button>

             <div className="w-px h-6 bg-slate-700 mx-1"></div>

             {/* Auth Button */}
             {user ? (
                 <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm font-medium"
                    title="Đăng xuất"
                 >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
                 </button>
             ) : (
                 <button 
                    onClick={handleLogin}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-pickle-600 hover:bg-pickle-500 text-white transition-colors text-sm font-bold shadow-md"
                    title="Đăng nhập"
                 >
                    <LogIn size={16} />
                    <span className="hidden sm:inline">Đăng nhập</span>
                 </button>
             )}
          </div>
        </div>
      </header>

      {/* Banner */}
      <Banner 
          isEditing={isEditingBanner} 
          onCloseEdit={() => setIsEditingBanner(false)} 
          externalBannerUrl={bannerUrl}
          onBannerChange={(url) => setBannerUrl(url)}
      />

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
                    matches={matches} 
                    tournamentData={tournamentState}
                    onUpdateTournament={handleUpdateTournamentState}
                    onSaveMatches={handleTournamentSaveMatch} 
                    onDeleteMatch={handleDeleteMatch}
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

    </div>
  );
};

export default App;