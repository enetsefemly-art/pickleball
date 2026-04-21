import { Player, Match, TournamentState } from '../types';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to clean data before sending to Firestore
const cleanData = (obj: any) => {
    const result = {} as any;
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && value !== null) {
            if (typeof value === 'number' && Number.isNaN(value)) {
                result[key] = 0;
            } else {
                result[key] = value;
            }
        }
    }
    return result;
};

// --- REALTIME LISTENERS ---

export const activeListeners = {
    matches: 0,
    players: 0,
    config: 0
};

export const subscribeToPlayers = (callback: (players: Player[]) => void) => {
    activeListeners.players++;
    const unsubscribe = onSnapshot(collection(db, 'players'), (snapshot) => {
        const players = snapshot.docs.map(doc => doc.data() as Player);
        callback(players);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'players');
    });
    
    return () => {
        activeListeners.players--;
        unsubscribe();
    };
};

export const subscribeToMatches = (callback: (matches: Match[]) => void) => {
    activeListeners.matches++;
    const unsubscribe = onSnapshot(collection(db, 'matches'), (snapshot) => {
        const matches = snapshot.docs.map(doc => {
            const data = doc.data();
            // Ensure ID is set on read as backward compatibility for older match records
            return { ...data, id: doc.id } as Match;
        });
        callback(matches);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'matches');
    });

    return () => {
        activeListeners.matches--;
        unsubscribe();
    };
};

export const subscribeToConfig = (callback: (tournament: TournamentState | null, bannerUrl: string | null) => void) => {
    activeListeners.config++;
    const unsubscribe = onSnapshot(collection(db, 'config'), (snapshot) => {
        let tournament: TournamentState | null = null;
        let bannerUrl: string | null = null;
        
        snapshot.docs.forEach(doc => {
            if (doc.id === 'tournament') {
                const data = doc.data();
                tournament = {
                    isActive: data.isActive,
                    mode: data.mode,
                    tournamentDate: data.tournamentDate,
                    teams: typeof data.teams === 'string' ? JSON.parse(data.teams) : data.teams,
                    schedule: typeof data.schedule === 'string' ? JSON.parse(data.schedule) : data.schedule,
                    groups: typeof data.groups === 'string' ? JSON.parse(data.groups) : data.groups,
                    groupSchedule: typeof data.groupSchedule === 'string' ? JSON.parse(data.groupSchedule) : data.groupSchedule
                };
            }
            if (doc.id === 'app') {
                bannerUrl = doc.data()?.bannerUrl || null;
            }
        });
        
        callback(tournament, bannerUrl);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'config');
    });

    return () => {
        activeListeners.config--;
        unsubscribe();
    };
};

// --- GRANULAR WRITE OPERATIONS ---

export const addMatchToCloud = async (match: Match): Promise<void> => {
    try {
        await setDoc(doc(db, 'matches', match.id), cleanData(match));
    } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, 'matches');
    }
};

export const deleteMatchFromCloud = async (matchId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'matches', matchId));
    } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, 'matches');
    }
};

export const saveBatchMatchesToCloud = async (matches: Match[]): Promise<void> => {
    try {
        const batch = writeBatch(db);
        matches.forEach(match => {
            const ref = doc(db, 'matches', match.id);
            batch.set(ref, cleanData(match));
        });
        await batch.commit();
    } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'matches');
    }
}

export const saveBatchPlayersToCloud = async (players: Player[]): Promise<void> => {
    try {
        // Group players into chunks of 400 to respect Firestore batch limit (500)
        let batch = writeBatch(db);
        let count = 0;

        for (const player of players) {
            const ref = doc(db, 'players', player.id);
            batch.set(ref, cleanData(player), { merge: true });
            count++;

            if (count === 400) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }
        
        if (count > 0) {
            await batch.commit();
        }
    } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'players');
    }
}

export const addPlayerToCloud = async (player: Player): Promise<void> => {
    try {
        await setDoc(doc(db, 'players', player.id), cleanData(player));
    } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, 'players');
    }
};

export const deletePlayerFromCloud = async (playerId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'players', playerId));
    } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, 'players');
    }
};

export const updateTournamentInCloud = async (tournament: TournamentState | null): Promise<void> => {
    try {
        if (tournament) {
            const tDoc = {
                isActive: tournament.isActive,
                mode: tournament.mode || 'round-robin',
                tournamentDate: tournament.tournamentDate,
                teams: tournament.teams ? JSON.stringify(tournament.teams) : null,
                schedule: tournament.schedule ? JSON.stringify(tournament.schedule) : null,
                groups: tournament.groups ? JSON.stringify(tournament.groups) : null,
                groupSchedule: tournament.groupSchedule ? JSON.stringify(tournament.groupSchedule) : null
            };
            await setDoc(doc(db, 'config', 'tournament'), cleanData(tDoc));
        } else {
            await deleteDoc(doc(db, 'config', 'tournament'));
        }
    } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, 'config');
    }
};

export const saveBannerToCloud = async (url: string): Promise<boolean> => {
    try {
        await setDoc(doc(db, 'config', 'app'), { bannerUrl: url }, { merge: true });
        return true;
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'config/app');
        return false;
    }
};
