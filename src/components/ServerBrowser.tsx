import React, { useState } from 'react';
import {
  Server as ServerIcon,
  Plus,
  Users,
  Radio,
  Hash,
  Crown,
  Search,
  Check,
  ArrowRight,
  Sparkles,
  Shield,
  LogOut,
} from 'lucide-react';
import { ServerData } from '../services/apiService';

interface ServerBrowserProps {
  servers: ServerData[];
  currentUsername: string;
  onOpenCreateServer: () => void;
  onSelectServer: (server: ServerData) => void;
  onJoinServer: (serverId: string) => Promise<void>;
  onLeaveServer: (serverId: string) => Promise<void>;
  onClose: () => void;
}

type TabMode = 'all' | 'joined' | 'owned';

export const ServerBrowser: React.FC<ServerBrowserProps> = ({
  servers,
  currentUsername,
  onOpenCreateServer,
  onSelectServer,
  onJoinServer,
  onLeaveServer,
  onClose,
}) => {
  const [tab, setTab] = useState<TabMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreviewServer, setSelectedPreviewServer] = useState<ServerData | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const cleanUser = currentUsername.toLowerCase().trim();

  // Filter servers based on tab & search query
  const filteredServers = servers.filter((srv) => {
    const matchesSearch =
      srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (srv.description && srv.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (tab === 'owned') {
      return srv.owner.toLowerCase().trim() === cleanUser;
    }

    if (tab === 'joined') {
      return srv.isJoined || srv.owner.toLowerCase().trim() === cleanUser;
    }

    return true;
  });

  const joinedCount = servers.filter(
    (s) => s.isJoined || s.owner.toLowerCase().trim() === cleanUser
  ).length;
  const ownedCount = servers.filter((s) => s.owner.toLowerCase().trim() === cleanUser).length;

  const handleJoinClick = async (srv: ServerData, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoadingId(srv.id);
    try {
      await onJoinServer(srv.id);
      onSelectServer(srv);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeaveClick = async (srv: ServerData, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Leave "${srv.name}"?`)) {
      setActionLoadingId(srv.id);
      try {
        await onLeaveServer(srv.id);
      } finally {
        setActionLoadingId(null);
      }
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#121318] overflow-y-auto selection:bg-purple-900 selection:text-white">
      {/* Top Banner Header */}
      <div className="relative p-6 sm:p-8 bg-gradient-to-b from-[#1c1d27] via-[#161720] to-[#121318] border-b border-[#242633] flex flex-col gap-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-violet-900/30 shrink-0">
              <ServerIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-100">Server Hub</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-950 text-violet-300 border border-violet-800">
                  {servers.length} Communities
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Join custom spaces or create your own with full Developer permissions & custom ranks!
              </p>
            </div>
          </div>

          {/* Action: Create Server */}
          <button
            type="button"
            onClick={onOpenCreateServer}
            className="self-start sm:self-auto py-2.5 px-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-violet-950/50 flex items-center gap-2 transition-all transform hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Server</span>
          </button>
        </div>

        {/* Search & Tabs Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-[#101115] border border-[#252733] rounded-lg gap-1">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'all'
                  ? 'bg-[#252836] text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All Servers ({servers.length})
            </button>

            <button
              type="button"
              onClick={() => setTab('joined')}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'joined'
                  ? 'bg-[#252836] text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Joined ({joinedCount})
            </button>

            <button
              type="button"
              onClick={() => setTab('owned')}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'owned'
                  ? 'bg-[#252836] text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              My Servers ({ownedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search servers by name..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-[#101115] border border-[#252733] focus:border-violet-500 rounded-lg text-neutral-100 placeholder-neutral-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Server Grid Content */}
      <div className="p-6 sm:p-8 flex-1">
        {filteredServers.length === 0 ? (
          <div className="w-full py-16 flex flex-col items-center justify-center text-center p-6 bg-[#161720]/60 border border-dashed border-[#282a38] rounded-xl">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-3">
              <ServerIcon className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-neutral-200">No servers found</h3>
            <p className="text-xs text-neutral-500 max-w-sm mt-1 mb-5">
              {tab === 'owned'
                ? "You haven't created any servers yet. Create your first server to get full Developer access!"
                : tab === 'joined'
                ? "You haven't joined any servers yet. Explore all servers and click Join!"
                : 'No communities matched your search query.'}
            </p>
            <button
              type="button"
              onClick={onOpenCreateServer}
              className="py-2 px-4 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg shadow transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create a Server</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredServers.map((srv) => {
              const isOwner = srv.owner.toLowerCase().trim() === cleanUser;
              const isMember = isOwner || Boolean(srv.isJoined);

              return (
                <div
                  key={srv.id}
                  onClick={() => {
                    if (isMember) {
                      onSelectServer(srv);
                    } else {
                      setSelectedPreviewServer(srv);
                    }
                  }}
                  className="group relative bg-[#171822] hover:bg-[#1a1c27] border border-[#262837] hover:border-violet-500/50 rounded-xl overflow-hidden shadow-lg transition-all duration-200 flex flex-col justify-between cursor-pointer transform hover:-translate-y-1"
                >
                  {/* Banner Image or Gradient Header (Layered Behind) */}
                  <div className="relative h-24 sm:h-28 w-full bg-gradient-to-r from-violet-950/60 via-purple-900/40 to-[#1b1c29] overflow-hidden z-0">
                    {srv.bannerUrl ? (
                      <img
                        src={srv.bannerUrl}
                        alt="Server banner"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-25">
                        <ServerIcon className="w-12 h-12 text-violet-300" />
                      </div>
                    )}

                    {/* Owner / Joined Badge */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                      {isOwner ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/90 text-zinc-950 flex items-center gap-1 shadow-sm backdrop-blur-xs">
                          <Crown className="w-3 h-3" />
                          <span>DEVELOPER (Owner)</span>
                        </span>
                      ) : isMember ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 flex items-center gap-1 shadow-sm backdrop-blur-xs">
                          <Check className="w-3 h-3" />
                          <span>Joined</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Icon & Info Body (Layered in Front) */}
                  <div className="px-4 pb-4 pt-0 flex-1 flex flex-col relative z-10">
                    {/* Floating Avatar Icon In Front */}
                    <div className="-mt-8 mb-2.5 flex items-end justify-between relative z-20">
                      <div className="w-14 h-14 rounded-xl bg-[#1d1f2b] border-2 border-[#2c2f40] ring-4 ring-[#171822] group-hover:border-violet-500 flex items-center justify-center overflow-hidden shadow-2xl shrink-0 transition-colors relative z-30">
                        {srv.iconUrl ? (
                          <img src={srv.iconUrl} alt="Icon" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-violet-300">
                            {srv.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Stat Counters */}
                      <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-medium">
                        <div className="flex items-center gap-1" title="Online members">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{srv.activeCount || 1} Online</span>
                        </div>
                        <div className="flex items-center gap-1" title="Total members">
                          <Users className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{srv.memberCount || 1} Members</span>
                        </div>
                      </div>
                    </div>

                    {/* Server Title & Tagline */}
                    <h2 className="text-sm font-bold text-neutral-100 group-hover:text-violet-300 transition-colors line-clamp-1">
                      {srv.name}
                    </h2>
                    <p className="text-xs text-neutral-400 line-clamp-2 mt-1 flex-1 leading-relaxed">
                      {srv.description || 'Welcome to this server! Join and start chatting with the community.'}
                    </p>

                    {/* Footer Channels Count & Button */}
                    <div className="mt-4 pt-3 border-t border-[#232534] flex items-center justify-between">
                      <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                        <Hash className="w-3.5 h-3.5" />
                        <span>{srv.channelCount || (srv.channels ? srv.channels.length : 1)} Channels</span>
                      </div>

                      {isMember ? (
                        <div className="flex items-center gap-2">
                          {!isOwner && (
                            <button
                              type="button"
                              onClick={(e) => handleLeaveClick(srv, e)}
                              className="p-1 text-neutral-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors text-[11px]"
                              title="Leave server"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectServer(srv);
                            }}
                            className="py-1.5 px-3 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-md flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                          >
                            <span>Enter</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoadingId === srv.id}
                          onClick={(e) => handleJoinClick(srv, e)}
                          className="py-1.5 px-3 bg-[#242637] hover:bg-violet-600 text-neutral-200 hover:text-white text-xs font-semibold rounded-md flex items-center gap-1 transition-all border border-[#32364c] hover:border-transparent cursor-pointer disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Join Server</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Server Preview Modal when clicking an unjoined server */}
      {selectedPreviewServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#161720] border border-[#272939] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Banner (Layered Behind) */}
            <div className="relative h-32 w-full bg-gradient-to-r from-violet-950 to-indigo-950 overflow-hidden z-0">
              {selectedPreviewServer.bannerUrl && (
                <img src={selectedPreviewServer.bannerUrl} alt="Banner" className="w-full h-full object-cover pointer-events-none" />
              )}
            </div>

            <div className="p-5 -mt-8 flex flex-col gap-3 relative z-10">
              <div className="flex items-end justify-between relative z-20">
                <div className="w-16 h-16 rounded-xl bg-[#1d1f2b] border-2 border-[#33364a] ring-4 ring-[#161720] flex items-center justify-center overflow-hidden shadow-2xl relative z-30">
                  {selectedPreviewServer.iconUrl ? (
                    <img src={selectedPreviewServer.iconUrl} alt="Icon" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-base font-bold text-violet-300">
                      {selectedPreviewServer.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{selectedPreviewServer.activeCount || 1} Online</span>
                  <span>&middot;</span>
                  <span>{selectedPreviewServer.memberCount || 1} Members</span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-neutral-100">{selectedPreviewServer.name}</h3>
                <span className="text-[11px] text-neutral-500">Created by @{selectedPreviewServer.owner}</span>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed bg-[#111218] p-3 rounded-lg border border-[#222432]">
                {selectedPreviewServer.description || 'Welcome to this server community! Click join to start chatting with members.'}
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPreviewServer(null)}
                  className="py-2 px-4 text-xs font-medium text-neutral-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onJoinServer(selectedPreviewServer.id);
                    onSelectServer(selectedPreviewServer);
                    setSelectedPreviewServer(null);
                  }}
                  className="py-2 px-5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg shadow-md transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Join & Enter Server</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
