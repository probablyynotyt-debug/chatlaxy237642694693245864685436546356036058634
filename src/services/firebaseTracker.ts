/**
 * Firebase Activity & Quota Tracker (Comprehensive Audit & Debug System)
 * Logs every Firestore operation with:
 * - operation type
 * - Firestore collection/path
 * - read/write
 * - timestamp
 * - component/function that triggered it (caller)
 * - whether it came from an onSnapshot listener
 * - whether it was a duplicate operation
 * - number of documents returned
 */

export type OperationType =
  | 'getDoc'
  | 'getDocs'
  | 'onSnapshot'
  | 'setDoc'
  | 'updateDoc'
  | 'deleteDoc'
  | 'batch'
  | 'listener_start'
  | 'listener_stop';

export interface FirebaseEventLog {
  id: string;
  operationType: OperationType;
  collectionPath: string;
  category: 'read' | 'write' | 'listener';
  timestamp: number;
  formattedTime: string;
  caller: string;
  fromSnapshot: boolean;
  isDuplicate: boolean;
  docCount: number;
  detail: string;
}

export interface FirebaseTrackerStats {
  totalReads: number;
  totalWrites: number;
  activeListenersCount: number;
  duplicateListenersDetected: number;
  duplicateOperationsDetected: number;
  activeListeners: Record<string, { key: string; collection: string; detail: string; startedAt: number; caller: string }>;
  recentLogs: FirebaseEventLog[];
}

class FirebaseTracker {
  private totalReads = 0;
  private totalWrites = 0;
  private duplicateListenerWarnings = 0;
  private duplicateOperations = 0;
  private activeListeners = new Map<
    string,
    { key: string; collection: string; detail: string; startedAt: number; caller: string }
  >();
  private logs: FirebaseEventLog[] = [];
  private recentOpsWindow = new Map<string, number>();
  private isDev = Boolean(import.meta.env.DEV);

  private checkDuplicate(key: string, windowMs = 800): boolean {
    const now = Date.now();
    const lastTime = this.recentOpsWindow.get(key);
    this.recentOpsWindow.set(key, now);

    // Prune old entries
    if (this.recentOpsWindow.size > 200) {
      for (const [k, t] of this.recentOpsWindow.entries()) {
        if (now - t > 5000) this.recentOpsWindow.delete(k);
      }
    }

    if (lastTime && now - lastTime < windowMs) {
      this.duplicateOperations++;
      return true;
    }
    return false;
  }

  private addLog(entry: Omit<FirebaseEventLog, 'id' | 'timestamp' | 'formattedTime'>) {
    const now = Date.now();
    const d = new Date(now);
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    const formattedTime = `${d.toTimeString().split(' ')[0]}.${ms}`;

    const log: FirebaseEventLog = {
      ...entry,
      id: Math.random().toString(36).slice(2, 9),
      timestamp: now,
      formattedTime,
    };

    this.logs.unshift(log);
    if (this.logs.length > 250) {
      this.logs.pop();
    }

    if (this.isDev) {
      const tag = log.category === 'write' ? '✍️ WRITE' : log.category === 'read' ? '📖 READ' : '⚡ LISTENER';
      const dupTag = log.isDuplicate ? ' [DUPLICATE]' : '';
      const snapTag = log.fromSnapshot ? ' [onSnapshot]' : '';
      console.log(
        `[FIREBASE] ${tag}${dupTag}${snapTag} (${log.operationType}) ${log.collectionPath} | Docs: ${log.docCount} | Caller: ${log.caller} | ${log.detail}`
      );
    }
  }

  trackRead(
    collectionPath: string,
    operationType: 'getDoc' | 'getDocs' | 'onSnapshot',
    caller: string,
    detail: string,
    docCount = 1,
    fromSnapshot = false
  ) {
    this.totalReads += docCount;
    const isDuplicate = this.checkDuplicate(`read:${collectionPath}:${operationType}:${detail}`, 600);

    this.addLog({
      operationType,
      collectionPath,
      category: 'read',
      caller,
      fromSnapshot,
      isDuplicate,
      docCount,
      detail,
    });
  }

  trackWrite(
    collectionPath: string,
    operationType: 'setDoc' | 'updateDoc' | 'deleteDoc' | 'batch',
    caller: string,
    docId: string,
    detail?: string
  ) {
    this.totalWrites += 1;
    const opDetail = detail || `${operationType.toUpperCase()} doc '${docId}'`;
    const isDuplicate = this.checkDuplicate(`write:${collectionPath}:${docId}`, 600);

    this.addLog({
      operationType,
      collectionPath,
      category: 'write',
      caller,
      fromSnapshot: false,
      isDuplicate,
      docCount: 1,
      detail: opDetail,
    });
  }

  trackListenerStart(key: string, collection: string, caller: string, detail: string): () => void {
    const isDuplicate = this.activeListeners.has(key);
    if (isDuplicate) {
      this.duplicateListenerWarnings += 1;
      console.warn(`🔥 [FIREBASE DUPLICATE LISTENER] Key: "${key}" was registered while an active listener already exists! Caller: ${caller}`);
    }

    this.activeListeners.set(key, {
      key,
      collection,
      detail,
      startedAt: Date.now(),
      caller,
    });

    this.addLog({
      operationType: 'listener_start',
      collectionPath: collection,
      category: 'listener',
      caller,
      fromSnapshot: true,
      isDuplicate,
      docCount: 0,
      detail: `Started listener: ${key} (${detail})`,
    });

    return () => {
      this.trackListenerStop(key, collection, caller);
    };
  }

  trackListenerStop(key: string, collection: string, caller: string) {
    if (this.activeListeners.has(key)) {
      this.activeListeners.delete(key);
      this.addLog({
        operationType: 'listener_stop',
        collectionPath: collection,
        category: 'listener',
        caller,
        fromSnapshot: true,
        isDuplicate: false,
        docCount: 0,
        detail: `Stopped listener: ${key}`,
      });
    }
  }

  getStats(): FirebaseTrackerStats {
    const activeMap: Record<string, { key: string; collection: string; detail: string; startedAt: number; caller: string }> = {};
    this.activeListeners.forEach((v, k) => {
      activeMap[k] = v;
    });

    return {
      totalReads: this.totalReads,
      totalWrites: this.totalWrites,
      activeListenersCount: this.activeListeners.size,
      duplicateListenersDetected: this.duplicateListenerWarnings,
      duplicateOperationsDetected: this.duplicateOperations,
      activeListeners: activeMap,
      recentLogs: [...this.logs],
    };
  }

  reset() {
    this.totalReads = 0;
    this.totalWrites = 0;
    this.duplicateListenerWarnings = 0;
    this.duplicateOperations = 0;
    this.logs = [];
    this.recentOpsWindow.clear();
  }
}

export const tracker = new FirebaseTracker();

if (typeof window !== 'undefined') {
  (window as any).chatlaxyTracker = tracker;
}
