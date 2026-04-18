import { Player, Match, TournamentState } from '../types';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';

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
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const syncToCloud = async (players: Player[], matches: Match[], tournament: TournamentState | null = null): Promise<boolean> => {
    console.log("Starting Firebase Sync (Upload)...");
    try {
        let batch = writeBatch(db);
        let count = 0;

        // Fetch existing IDs to find what to delete
        const existingPlayersSnap = await getDocs(collection(db, 'players'));
        const existingPlayerIds = new Set(existingPlayersSnap.docs.map(doc => doc.id));
        
        const existingMatchesSnap = await getDocs(collection(db, 'matches'));
        const existingMatchIds = new Set(existingMatchesSnap.docs.map(doc => doc.id));

        const newPlayerIds = new Set(players.map(p => p.id));
        const newMatchIds = new Set(matches.map(m => m.id));

        // Delete removed players
        for (const id of existingPlayerIds) {
            if (!newPlayerIds.has(id)) {
                batch.delete(doc(db, 'players', id));
                count++;
                if (count === 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
        }

        // Delete removed matches
        for (const id of existingMatchIds) {
            if (!newMatchIds.has(id)) {
                batch.delete(doc(db, 'matches', id));
                count++;
                if (count === 400) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            }
        }

        // Helper to remove undefined and null values to pass Firestore rules
        const cleanData = (obj: any) => {
            const result = {} as any;
            for (const [key, value] of Object.entries(obj)) {
                // Keep values that are defined, not null, and not NaN.
                if (value !== undefined && value !== null) {
                    if (typeof value === 'number' && Number.isNaN(value)) {
                        result[key] = 0; // Fallback NaN to 0 to pass rules
                    } else {
                        result[key] = value;
                    }
                }
            }
            return result;
        };

        // Upload Players
        for (const player of players) {
            const ref = doc(db, 'players', player.id);
            batch.set(ref, cleanData(player));
            count++;
            if (count === 400) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }

        // Upload Matches
        for (const match of matches) {
            const ref = doc(db, 'matches', match.id);
            batch.set(ref, cleanData(match));
            count++;
            if (count === 400) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }

        if (count > 0) await batch.commit();

        // Upload Tournament
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
            // If tournament is null, we might want to clear it, but for now we just don't update it
        }

        return true;
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'multiple');
        return false;
    }
};

export const saveBannerToCloud = async (url: string): Promise<boolean> => {
    console.log("Starting Banner Sync (Upload)...");
    try {
        await setDoc(doc(db, 'config', 'app'), { bannerUrl: url }, { merge: true });
        return true;
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'config/app');
        return false;
    }
};

export const syncFromCloud = async (): Promise<{ players: Player[], matches: Match[], tournament: TournamentState | null, bannerUrl?: string | null }> => {
    console.log("Starting Firebase Sync (Download)...");
    try {
        const playersSnap = await getDocs(collection(db, 'players'));
        const players: Player[] = playersSnap.docs.map(doc => doc.data() as Player);

        const matchesSnap = await getDocs(collection(db, 'matches'));
        const matches: Match[] = matchesSnap.docs.map(doc => doc.data() as Match);

        const tournamentSnap = await getDoc(doc(db, 'config', 'tournament'));
        let tournament: TournamentState | null = null;
        if (tournamentSnap.exists()) {
            const data = tournamentSnap.data();
            tournament = {
                isActive: data.isActive,
                mode: data.mode,
                tournamentDate: data.tournamentDate,
                teams: data.teams ? JSON.parse(data.teams) : undefined,
                schedule: data.schedule ? JSON.parse(data.schedule) : undefined,
                groups: data.groups ? JSON.parse(data.groups) : undefined,
                groupSchedule: data.groupSchedule ? JSON.parse(data.groupSchedule) : undefined
            };
        }

        const appSnap = await getDoc(doc(db, 'config', 'app'));
        let bannerUrl = null;
        if (appSnap.exists()) {
            bannerUrl = appSnap.data().bannerUrl;
        }

        return { players, matches, tournament, bannerUrl };
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'multiple');
        throw error;
    }
};
