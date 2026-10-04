import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Shield,
  Hash,
  Users,
  Settings,
  Sparkles,
  Check,
  Upload,
  RefreshCw,
  Loader2,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import {
  ServerData,
  ServerChannel,
  ServerRole,
  ServerMember,
  createChannel,
  deleteChannel,
  createServerRole,
  deleteServerRole,
  updateMemberRoles,
  kickServerMember,
  updateServer,
  deleteServer,
} from '../services/apiService';
import { uploadImageToCloudinary } from '../utils/cloudinary';

interface ServerAdminPanelProps {
  isOpen: boolean;
  server: ServerData;
  currentUser: string;
  channels: ServerChannel[];
  roles: ServerRole[];
  members: ServerMember[];
  onClose: () => void;
  onRefreshServer: () => void;
  onServerDeleted: () => void;
}

type TabType = 'channels' | 'roles' | 'members' | 'settings';

export const ServerAdminPanel: React.FC<ServerAdminPanelProps> = ({
  isOpen,
  server,
  currentUser,
  channels,
  roles,
  members,
  onClose,
  onRefreshServer,
  onServerDeleted,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('channels');
  const [newChannelName, setNewChannelName] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  // Role creation state
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColour, setNewRoleColour] = useState('#8b5cf6');
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  // Server Settings state
  const [serverName, setServerName] = useState(server.name);
  const [serverDesc, setServerDesc] = useState(server.description || '');
  const [serverIcon, setServerIcon] = useState<string | null>(server.iconUrl || null);
  const [serverBanner, setServerBanner] = useState<string | null>(server.bannerUrl || null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeletingServer, setIsDeletingServer] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isOwner = server.owner.toLowerCase() === currentUser.toLowerCase();

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setIsCreatingChannel(true);
    try {
      await createChannel(server.id, newChannelName.trim());
      setNewChannelName('');
      onRefreshServer();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (channels.length <= 1) {
      alert('A server must have at least one channel.');
      return;
    }
    if (confirm('Delete this channel and all its chat messages?')) {
      await deleteChannel(server.id, channelId);
      onRefreshServer();
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setIsCreatingRole(true);
    try {
      await createServerRole(server.id, {
        name: newRoleName.trim(),
        colour: newRoleColour,
        permissions: ['chat', 'send_media'],
      });
      setNewRoleName('');
      onRefreshServer();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (confirm('Delete this server role?')) {
      await deleteServerRole(server.id, roleId);
      onRefreshServer();
    }
  };

  const handleToggleMemberRole = async (username: string, roleName: string) => {
    const mem = members.find((m) => m.username.toLowerCase() === username.toLowerCase());
    if (!mem) return;

    const currentRoles = mem.roles || [];
    const nextRoles = currentRoles.includes(roleName)
      ? currentRoles.filter((r) => r !== roleName)
      : [...currentRoles, roleName];

    await updateMemberRoles(server.id, username, nextRoles);
    onRefreshServer();
  };

  const handleKickMember = async (username: string) => {
    if (username.toLowerCase() === server.owner.toLowerCase()) {
      alert('Cannot kick the server owner.');
      return;
    }
    if (confirm(`Kick @${username} from ${server.name}?`)) {
      await kickServerMember(server.id, username);
      onRefreshServer();
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateServer(server.id, {
        name: serverName.trim(),
        description: serverDesc.trim(),
        iconUrl: serverIcon,
        bannerUrl: serverBanner,
      });
      setSaveSuccessNotice('Server settings saved successfully!');
      setTimeout(() => setSaveSuccessNotice(null), 3000);
      onRefreshServer();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteServer = async () => {
    if (confirm(`Are you SURE you want to PERMANENTLY DELETE "${server.name}"? All channels, messages, and roles will be removed.`)) {
      setIsDeletingServer(true);
      try {
        await deleteServer(server.id);
        onServerDeleted();
        onClose();
      } catch (err) {
        console.error(err);
      } finally {
        setIsDeletingServer(false);
      }
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingIcon(true);
      try {
        const url = await uploadImageToCloudinary(file, { isBanner: false });
        setServerIcon(url);
      } catch {}
      setIsUploadingIcon(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingBanner(true);
      try {
        const url = await uploadImageToCloudinary(file, { isBanner: true });
        setServerBanner(url);
      } catch {}
      setIsUploadingBanner(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl bg-[#14161c] border border-[#262835] rounded-xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[700px] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232630] bg-[#181a22]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-100">{server.name}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  DEVELOPER / ADMIN
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Server Management & Permission Controls</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-4 border-b border-[#232630] bg-[#121318] overflow-x-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('channels')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'channels'
                ? 'border-violet-500 text-violet-300 bg-violet-500/10'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Channels ({channels.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'roles'
                ? 'border-violet-500 text-violet-300 bg-violet-500/10'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Ranks & Roles ({roles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-violet-500 text-violet-300 bg-violet-500/10'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members ({members.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-violet-500 text-violet-300 bg-violet-500/10'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Server Settings</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto flex-1 bg-[#14161c]">
          {/* 1. CHANNELS TAB */}
          {activeTab === 'channels' && (
            <div className="flex flex-col gap-5">
              {/* Add Channel */}
              <form onSubmit={handleAddChannel} className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="new-channel-name (e.g. gaming, memes, announcements)"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-[#101115] border border-[#2a2c38] focus:border-violet-400 rounded-md text-neutral-100 placeholder-neutral-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingChannel || !newChannelName.trim()}
                  className="py-2.5 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Channel</span>
                </button>
              </form>

              {/* Channels List */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Text Channels ({channels.length})
                </span>
                <div className="flex flex-col gap-1.5">
                  {channels.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between p-3 bg-[#181a22] border border-[#252834] rounded-lg hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-neutral-200 font-medium text-xs">
                        <Hash className="w-4 h-4 text-neutral-400" />
                        <span>{ch.name}</span>
                        {ch.name === 'general' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-neutral-800 text-neutral-400">
                            Default
                          </span>
                        )}
                      </div>
                      {channels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteChannel(ch.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                          title="Delete channel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. RANKS & ROLES TAB */}
          {activeTab === 'roles' && (
            <div className="flex flex-col gap-5">
              {/* Create Role */}
              <form onSubmit={handleAddRole} className="p-4 bg-[#181a22] border border-[#252834] rounded-lg flex flex-col gap-3">
                <span className="text-xs font-bold text-neutral-200">Create New Server Role</span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="Role Name (e.g. VIP, Moderator, Elite, Member)"
                      className="w-full px-3 py-2 text-xs bg-[#101115] border border-[#2a2c38] focus:border-violet-400 rounded-md text-neutral-100 placeholder-neutral-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3 flex items-center gap-2">
                    <input
                      type="color"
                      value={newRoleColour}
                      onChange={(e) => setNewRoleColour(e.target.value)}
                      className="w-8 h-8 rounded border border-[#303342] bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-neutral-400">{newRoleColour}</span>
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={isCreatingRole || !newRoleName.trim()}
                      className="w-full py-2 px-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Role</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Roles List */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Configured Roles ({roles.length})
                </span>
                <div className="flex flex-col gap-2">
                  {/* Default Owner Role */}
                  <div className="flex items-center justify-between p-3 bg-[#181a22] border border-[#252834] rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-amber-400" />
                      <span className="text-xs font-bold text-amber-300">👑 Server Owner</span>
                      <span className="text-[10px] text-neutral-500">Highest authority</span>
                    </div>
                  </div>

                  {roles.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 bg-[#181a22] border border-[#252834] rounded-lg"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.colour || '#8b5cf6' }} />
                        <span className="text-xs font-bold text-neutral-100">{r.name}</span>
                        <span className="text-[10px] font-mono text-neutral-400">{r.colour}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(r.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                        title="Delete role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. MEMBERS TAB */}
          {activeTab === 'members' && (
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Server Members ({members.length})
              </span>
              <div className="flex flex-col gap-2">
                {members.map((mem) => {
                  const isMemOwner = mem.username.toLowerCase() === server.owner.toLowerCase();
                  return (
                    <div
                      key={mem.username}
                      className="p-3 bg-[#181a22] border border-[#252834] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#20232e] border border-[#323646] flex items-center justify-center font-bold text-xs text-neutral-200">
                          {mem.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-neutral-100">{mem.username}</span>
                            {isMemOwner && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                OWNER
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mem.roles && mem.roles.map((rn) => (
                              <span
                                key={rn}
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700"
                              >
                                {rn}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Role Assignment & Kick */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {roles.map((r) => {
                          const hasRole = (mem.roles || []).includes(r.name);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => handleToggleMemberRole(mem.username, r.name)}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                                hasRole
                                  ? 'bg-violet-950 text-violet-200 border-violet-700'
                                  : 'bg-[#101115] text-neutral-400 hover:text-white border-[#2c2e3c]'
                              }`}
                            >
                              {hasRole && <Check className="w-2.5 h-2.5" />}
                              <span>{r.name}</span>
                            </button>
                          );
                        })}

                        {!isMemOwner && (
                          <button
                            type="button"
                            onClick={() => handleKickMember(mem.username)}
                            className="p-1 text-neutral-400 hover:text-red-400 hover:bg-red-950/40 rounded transition-colors text-xs font-semibold cursor-pointer"
                            title="Kick member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. SERVER SETTINGS TAB */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="flex flex-col gap-4 max-w-lg">
              {saveSuccessNotice && (
                <div className="p-2.5 rounded-md bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs">
                  {saveSuccessNotice}
                </div>
              )}

              {/* Server Name */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-neutral-200">Server Name</label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#101115] border border-[#2a2c38] focus:border-violet-400 rounded-md text-neutral-100 outline-none"
                />
              </div>

              {/* Server Description */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-neutral-200">Description</label>
                <textarea
                  rows={3}
                  value={serverDesc}
                  onChange={(e) => setServerDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#101115] border border-[#2a2c38] focus:border-violet-400 rounded-md text-neutral-100 outline-none resize-none"
                />
              </div>

              {/* Icon & Banner */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-200">Icon</label>
                  <button
                    type="button"
                    onClick={() => iconInputRef.current?.click()}
                    className="p-2.5 bg-[#181a22] border border-[#2a2c38] hover:border-zinc-500 rounded text-xs text-neutral-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isUploadingIcon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{serverIcon ? 'Change Icon' : 'Upload Icon'}</span>
                  </button>
                  <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-neutral-200">Banner</label>
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="p-2.5 bg-[#181a22] border border-[#2a2c38] hover:border-zinc-500 rounded text-xs text-neutral-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isUploadingBanner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{serverBanner ? 'Change Banner' : 'Upload Banner'}</span>
                  </button>
                  <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="self-start mt-2 py-2 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow transition-colors cursor-pointer"
              >
                {isSavingSettings ? 'Saving...' : 'Save Changes'}
              </button>

              {/* Delete Server Section */}
              {isOwner && (
                <div className="mt-8 pt-5 border-t border-red-950/80 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Danger Zone</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Deleting this server will permanently erase all its channels, roles, and message history.
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteServer}
                    disabled={isDeletingServer}
                    className="self-start py-2 px-4 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-100 text-xs font-bold rounded-md transition-colors cursor-pointer"
                  >
                    {isDeletingServer ? 'Deleting...' : 'Delete Server Permanently'}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
