import React, { useState, useEffect } from 'react';
import { X, Activity, Database, Radio, RefreshCw, AlertTriangle, Layers } from 'lucide-react';
import { tracker, FirebaseTrackerStats } from '../services/firebaseTracker';

interface FirebaseTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseTrackerModal: React.FC<FirebaseTrackerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [stats, setStats] = useState<FirebaseTrackerStats>(tracker.getStats());
  const [filterType, setFilterType] = useState<'all' | 'read' | 'write' | 'listener'>('all');

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setStats(tracker.getStats());
    }, 600);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const activeListenerList = Object.values(stats.activeListeners);
  const filteredLogs = stats.recentLogs.filter((log) => {
    if (filterType === 'all') return true;
    return log.category === filterType;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150 select-none text-left">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-3xl bg-[#141519] border border-[#2b2d39] rounded-md shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#24252f] bg-[#171820]">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-neutral-100 uppercase tracking-wide">
              Firebase Quota & Activity Inspector
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Admin: null@gmail.com
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                tracker.reset();
                setStats(tracker.getStats());
              }}
              title="Reset Stats"
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer text-xs flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-4 gap-2.5 p-4 bg-[#111216] border-b border-[#24252f]">
          <div className="p-3 bg-[#191b22] border border-[#262833] rounded flex flex-col">
            <span className="text-[11px] text-neutral-400 uppercase font-mono tracking-wider">
              Firestore Reads
            </span>
            <span className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {stats.totalReads}
            </span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Documents queried</span>
          </div>

          <div className="p-3 bg-[#191b22] border border-[#262833] rounded flex flex-col">
            <span className="text-[11px] text-neutral-400 uppercase font-mono tracking-wider">
              Firestore Writes
            </span>
            <span className="text-xl font-bold text-blue-400 font-mono mt-1">
              {stats.totalWrites}
            </span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Set, update, delete</span>
          </div>

          <div className="p-3 bg-[#191b22] border border-[#262833] rounded flex flex-col">
            <span className="text-[11px] text-neutral-400 uppercase font-mono tracking-wider">
              Active Listeners
            </span>
            <span className="text-xl font-bold text-amber-400 font-mono mt-1">
              {stats.activeListenersCount}
            </span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Realtime onSnapshot</span>
          </div>

          <div className="p-3 bg-[#191b22] border border-[#262833] rounded flex flex-col">
            <span className="text-[11px] text-neutral-400 uppercase font-mono tracking-wider">
              Duplicate Alerts
            </span>
            <span
              className={`text-xl font-bold font-mono mt-1 ${
                stats.duplicateListenersDetected + stats.duplicateOperationsDetected > 0
                  ? 'text-red-400'
                  : 'text-neutral-400'
              }`}
            >
              {stats.duplicateListenersDetected + stats.duplicateOperationsDetected}
            </span>
            <span className="text-[10px] text-neutral-500 mt-0.5">Duplicates detected</span>
          </div>
        </div>

        {/* Content Tabs / Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Active Realtime Listeners Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Currently Active Realtime Listeners ({activeListenerList.length})</span>
            </div>

            {activeListenerList.length === 0 ? (
              <div className="p-3 rounded bg-[#181920] border border-[#252630] text-xs text-neutral-500 font-mono">
                No active realtime listeners currently registered.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {activeListenerList.map((listener) => {
                  const uptimeSeconds = Math.round((Date.now() - listener.startedAt) / 1000);
                  return (
                    <div
                      key={listener.key}
                      className="p-2.5 bg-[#171920] border border-[#282a36] rounded flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.2 font-mono text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                            {listener.collection}
                          </span>
                          <span className="font-semibold text-neutral-200">{listener.key}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">Caller: {listener.caller}</span>
                        </div>
                        <span className="text-[11px] text-neutral-400">{listener.detail}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                        {uptimeSeconds}s active
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity Event Stream with Filtering */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-neutral-400" />
                <span>Detailed Audit Log ({filteredLogs.length})</span>
              </div>
              <div className="flex items-center gap-1 bg-[#181922] p-0.5 rounded border border-[#262834]">
                {(['all', 'read', 'write', 'listener'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterType(t)}
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-colors cursor-pointer ${
                      filterType === t
                        ? 'bg-[#2b2d3d] text-neutral-100'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0f1013] border border-[#23242c] rounded max-h-64 overflow-y-auto font-mono text-[11px] p-2 flex flex-col gap-1">
              {filteredLogs.length === 0 ? (
                <span className="text-neutral-600 p-2">No operations logged yet...</span>
              ) : (
                filteredLogs.map((log) => {
                  let badge = 'bg-neutral-800 text-neutral-300';
                  if (log.category === 'read') badge = 'bg-emerald-950 text-emerald-400 border border-emerald-800/50';
                  if (log.category === 'write') badge = 'bg-blue-950 text-blue-400 border border-blue-800/50';
                  if (log.category === 'listener') badge = 'bg-purple-950 text-purple-400 border border-purple-800/50';

                  return (
                    <div
                      key={log.id}
                      className="flex flex-col py-1 px-1.5 rounded hover:bg-[#181922] transition-colors border-b border-[#1b1c24] last:border-none gap-0.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 text-[10px]">{log.formattedTime}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold shrink-0 ${badge}`}>
                          {log.category.toUpperCase()}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#1b1d28] text-neutral-300 border border-[#2b2d3e]">
                          {log.operationType}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-bold">
                          {log.collectionPath}
                        </span>
                        {log.docCount > 0 && (
                          <span className="text-[10px] text-emerald-400">
                            (+{log.docCount} docs)
                          </span>
                        )}
                        {log.fromSnapshot && (
                          <span className="px-1 py-0.1 text-[9px] bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                            onSnapshot
                          </span>
                        )}
                        {log.isDuplicate && (
                          <span className="px-1 py-0.1 text-[9px] bg-red-500/20 text-red-300 rounded border border-red-500/30">
                            Duplicate
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-500 ml-auto truncate max-w-[140px]">
                          Caller: {log.caller}
                        </span>
                      </div>
                      <span className="text-neutral-300 text-[11px] truncate">
                        {log.detail}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-[#121317] border-t border-[#24252f] flex items-center justify-between text-[11px] text-neutral-500 font-mono">
          <span>Target Firebase: chatlaxy-49038</span>
          <span>Press Esc or click backdrop to close</span>
        </div>
      </div>
    </div>
  );
};
