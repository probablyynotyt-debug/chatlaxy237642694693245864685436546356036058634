/**
 * Firebase Activity & Quota Tracker (Development & Debug Tool)
 * Tracks all reads, writes, active realtime listeners, duplicate listeners, and queries
 * to ensure maximum Firestore quota efficiency.
 */

export interface FirebaseEventLog {
  id: string;
  type: 'read' | 'write' | 'listener_start' | 'listener_stop' | 'duplicate_warning';
  collection: string;
  detail: string;
  count: number;
  timestamp: number;
}

export interface FirebaseTrackerStats {
  totalReads: number;
  totalWrites: number;
  activeListenersCount: number;
  duplicateListenersDetected: number;
  activeListeners: Record<string, { key: string; collection: string; detail: string; startedAt: number }>;
  recentLogs: FirebaseEventLog[];
}

class FirebaseTracker {
  private totalReads = 0;
  private totalWrites = 0;
  private duplicateWarnings = 0;
  private activeListeners = new Map<string, { key: string; collection: string; detail: string; startedAt: number }>();
  private logs: FirebaseEventLog[] = [];
  private isDev = Boolean(import.meta.env.DEV);

  private addLog(entry: Omit<FirebaseEventLog, 'id' | 'timestamp'>) {
    const log: FirebaseEventLog = {
      ...entry,
      id: Math.random().toString(36).slice(2, 9),
      timestamp: Date.now(),
    };
    this.logs.unshift(log);
    if (this.logs.length > 200) {
      this.logs.pop();
    }

    if (this.isDev) {
      if (entry.type === 'duplicate_warning') {
        console.warn(`🔥 [FIRESTORE WARNING - DUPLICATE LISTENER] Collection: ${entry.collection} | Key: ${entry.detail}`);
      } else if (entry.type === 'write') {
        console.log(`🔥 [FIRESTORE WRITE] (${entry.collection}) ${entry.detail}`);
      } else if (entry.type === 'read') {
        console.log(`🔥 [FIRESTORE READ] (${entry.collection}) +${entry.count} doc(s) | ${entry.detail}`);
      }
    }
  }

  trackRead(collection: string, detail: string, docCount = 1) {
    this.totalReads += docCount;
    this.addLog({
      type: 'read',
      collection,
      detail,
      count: docCount,
    });
  }

  trackWrite(collection: string, action: 'set' | 'update' | 'delete' | 'add', docId: string) {
    this.totalWrites += 1;
    this.addLog({
      type: 'write',
      collection,
      detail: `${action.toUpperCase()} doc '${docId}'`,
      count: 1,
    });
  }

  trackListenerStart(key: string, collection: string, detail: string): () => void {
    if (this.activeListeners.has(key)) {
      this.duplicateWarnings += 1;
      this.addLog({
        type: 'duplicate_warning',
        collection,
        detail: `Duplicate listener started for key: ${key}`,
        count: 0,
      });
    }

    this.activeListeners.set(key, {
      key,
      collection,
      detail,
      startedAt: Date.now(),
    });

    this.addLog({
      type: 'listener_start',
      collection,
      detail: `Started listener: ${key} (${detail})`,
      count: 0,
    });

    // Return cleanup callback
    return () => {
      this.trackListenerStop(key, collection);
    };
  }

  trackListenerStop(key: string, collection: string) {
    if (this.activeListeners.has(key)) {
      this.activeListeners.delete(key);
      this.addLog({
        type: 'listener_stop',
        collection,
        detail: `Stopped listener: ${key}`,
        count: 0,
      });
    }
  }

  getStats(): FirebaseTrackerStats {
    const activeMap: Record<string, { key: string; collection: string; detail: string; startedAt: number }> = {};
    this.activeListeners.forEach((v, k) => {
      activeMap[k] = v;
    });

    return {
      totalReads: this.totalReads,
      totalWrites: this.totalWrites,
      activeListenersCount: this.activeListeners.size,
      duplicateListenersDetected: this.duplicateWarnings,
      activeListeners: activeMap,
      recentLogs: [...this.logs],
    };
  }

  reset() {
    this.totalReads = 0;
    this.totalWrites = 0;
    this.duplicateWarnings = 0;
    this.logs = [];
  }
}

export const tracker = new FirebaseTracker();

// Expose tracker on window in dev mode for quick console inspection: window.chatlaxyTracker.getStats()
if (typeof window !== 'undefined') {
  (window as any).chatlaxyTracker = tracker;
}
