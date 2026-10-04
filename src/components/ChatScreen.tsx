import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  X,
  User,
  Sparkles,
  AlertCircle,
  Info,
  Menu,
  Bell,
  Server as ServerIcon,
  Crown,
  Hash,
  ArrowLeft,
  Settings,
  Plus,
  Compass,
} from 'lucide-react';
import { ChatMessage, ReplyContext } from '../types/chat';
import { ProfileData } from '../types/bio';
import { ChatMessageItem } from './ChatMessageItem';
import { ProfileMenuDropdown } from './ProfileMenuDropdown';
import { OnlinePlayersPanel } from './OnlinePlayersPanel';
import { ProfileModal } from './ProfileModal';
import { ChatBackgroundModal } from './ChatBackgroundModal';
import { HamburgerMenuDrawer } from './HamburgerMenuDrawer';
import { DailyRewardsModal } from './DailyRewardsModal';
import { AvatarFrameStudioModal } from './AvatarFrameStudioModal';
import { ProfileDecorationsModal } from './ProfileDecorationsModal';
import { UserAvatar } from './UserAvatar';
import { NewsPanel } from './NewsPanel';
import { NewsComposer } from './NewsComposer';
import { ChatlaxyLogo } from './ChatlaxyLogo';
import { NotificationsDropdown } from './NotificationsDropdown';
import { ServerBrowser } from './ServerBrowser';
import { CreateServerModal } from './CreateServerModal';
import { ServerAdminPanel } from './ServerAdminPanel';
import { AppNotification } from '../types/notifications';
import { NewsPost, NewsReactionType } from '../types/news';
import { handleChatCommand } from '../utils/commandHandler';
import { isFounderOrAbove } from '../utils/permissions';
import { addAuditLog } from '../utils/auditLogger';
import {
  subscribeToMessages,
  loadOlderMessages,
  sendMessage,
  deleteMessage,
  clearAllMessages,
  subscribeToUsers,
  saveUser,
  recordMessageSentForDailyRewards,
  claimDailyReward,
  subscribeToNews,
  createNewsPost,
  deleteNewsPost,
  updateNewsPost,
  subscribeToUserNotifications,
  deleteNotification,
  clearAllNotificationsForUser,
  getServers,
  joinServer,
  leaveServer,
  getServerMembers,
  getServerChannels,
  getServerRoles,
  ServerRole,
  ServerChannel,
  ServerData,
  ServerMember,
} from '../services/apiService';

interface ChatScreenProps {
  currentUser: ProfileData;
  onLogout: () => void;
  onUpdateCurrentUser: (profile: ProfileData) => void;
  onEditProfile?: () => void;
  onOpenAdminPanel?: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  currentUser,
  onLogout,
  onUpdateCurrentUser,
  onOpenAdminPanel,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, ProfileData>>({});
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState('');
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isDailyRewardsOpen, setIsDailyRewardsOpen] = useState(false);
  const [isAvatarFramesOpen, setIsAvatarFramesOpen] = useState(false);
  const [isProfileDecorationsOpen, setIsProfileDecorationsOpen] = useState(false);
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  const [hasUnreadNews, setHasUnreadNews] = useState(false);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [isComposerModalOpen, setIsComposerModalOpen] = useState(false);
  const [activeProfileTarget, setActiveProfileTarget] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [isChatBgModalOpen, setIsChatBgModalOpen] = useState(false);
  const [previewChatBackground, setPreviewChatBackground] = useState<string | null>(
    currentUser.chatBackground || null
  );
  const [privateNotice, setPrivateNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Server Hub & Server Space State
  const [servers, setServers] = useState<ServerData[]>([]);
  const [isServerHubOpen, setIsServerHubOpen] = useState(false);
  const [activeServer, setActiveServer] = useState<ServerData | null>(null);
  const [channels, setChannels] = useState<ServerChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ServerChannel | null>(null);
  const [serverRoles, setServerRoles] = useState<ServerRole[]>([]);
  const [serverMembers, setServerMembers] = useState<ServerMember[]>([]);
  const [isCreateServerModalOpen, setIsCreateServerModalOpen] = useState(false);
  const [isServerAdminOpen, setIsServerAdminOpen] = useState(false);

  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadServerConfig = async () => {
    try {
      const list = await getServers();
      setServers(list);
    } catch (err) {
      console.warn('Failed to load servers:', err);
    }
  };

  useEffect(() => {
    loadServerConfig();
  }, []);

  // Sync channels & roles when activeServer changes
  const refreshActiveServer = async () => {
    if (!activeServer) {
      setChannels([]);
      setActiveChannel(null);
      setServerRoles([]);
      setServerMembers([]);
      return;
    }
    try {
      const chList = await getServerChannels(activeServer.id);
      setChannels(chList);
      if (chList && chList.length > 0) {
        setActiveChannel((prev) => (prev && chList.some((c) => c.id === prev.id) ? prev : chList[0]));
      } else {
        setActiveChannel(null);
      }
      const rList = await getServerRoles(activeServer.id);
      setServerRoles(rList);
      const mList = await getServerMembers(activeServer.id);
      setServerMembers(mList);
      loadServerConfig();
    } catch (err) {
      console.warn('Error refreshing server data:', err);
    }
  };

  useEffect(() => {
    setHasMoreOlder(true);
    refreshActiveServer();
  }, [activeServer?.id]);

  const handleJoinServer = async (serverId: string) => {
    const success = await joinServer(serverId, currentUser.username);
    if (success) {
      await loadServerConfig();
    }
  };

  const handleLeaveServer = async (serverId: string) => {
    const success = await leaveServer(serverId, currentUser.username);
    if (success) {
      if (activeServer?.id === serverId) {
        setActiveServer(null);
      }
      await loadServerConfig();
    }
  };

  const handleSelectServerFromHub = (server: ServerData) => {
    setActiveServer(server);
    setIsServerHubOpen(false);
  };

  const handleServerCreated = (server: ServerData) => {
    setServers((prev) => [...prev, server]);
    setActiveServer(server);
    setIsServerHubOpen(false);
  };

  const handleServerDeleted = () => {
    setActiveServer(null);
    loadServerConfig();
  };

  const isNewsOpenRef = useRef(isNewsOpen);
  isNewsOpenRef.current = isNewsOpen;

  const isNotificationsOpenRef = useRef(isNotificationsOpen);
  isNotificationsOpenRef.current = isNotificationsOpen;

  // 1. Subscribe to Live Messages (Main Chat or Server Channel)
  useEffect(() => {
    const unsubscribe = subscribeToMessages((liveMessages) => {
      setMessages(liveMessages);
    }, activeServer?.id || null, activeChannel?.id || null);
    return () => unsubscribe();
  }, [activeServer?.id, activeChannel?.id]);

  // 2. Subscribe to Live Registered Users
  useEffect(() => {
    const unsubscribe = subscribeToUsers((usersMap) => {
      setAllUsers(usersMap);
    });
    return () => unsubscribe();
  }, []);

  // 2b. Automatically merge active chatters from incoming messages
  useEffect(() => {
    if (messages.length === 0) return;
    setAllUsers((prev) => {
      let changed = false;
      const next = { ...prev };
      messages.forEach((msg) => {
        if (msg.senderName && !msg.isSystemBot) {
          const key = msg.senderName.toLowerCase().trim();
          if (!next[key]) {
            next[key] = {
              username: msg.senderName,
              profilePicture: msg.senderAvatar || null,
              banner: null,
              avatarFrame: msg.senderAvatarFrame || null,
              mood: '',
              bioSegments: [],
              rank: (msg as any).senderRank || 'VIP',
            };
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [messages]);

  // 3. Subscribe to News posts
  useEffect(() => {
    const unsubscribe = subscribeToNews((posts) => {
      setNewsPosts(posts);
      if (posts.length > 0 && !isNewsOpenRef.current) {
        const lastSeen = Number(localStorage.getItem('chatlaxy_last_seen_news') || 0);
        if (posts[0].timestamp > lastSeen) {
          setHasUnreadNews(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 4. Subscribe to Real-Time Notifications
  useEffect(() => {
    const unsubscribe = subscribeToUserNotifications(currentUser.username, (notifs) => {
      setNotifications(notifs);
      const unreadCount = notifs.filter((n) => !n.read).length;
      if (unreadCount > 0 && !isNotificationsOpenRef.current) {
        setHasUnreadNotifications(true);
      }
    });
    return () => unsubscribe();
  }, [currentUser.username]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && !isLoadingOlder) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isLoadingOlder]);

  // Load older messages on demand
  const handleLoadOlderMessages = async () => {
    if (messages.length === 0 || isLoadingOlder || !hasMoreOlder) return;
    setIsLoadingOlder(true);
    try {
      const oldest = messages[0].timestamp;
      const older = await loadOlderMessages(
        oldest,
        activeServer?.id || null,
        activeChannel?.id || null,
        30
      );
      if (older.length < 30) {
        setHasMoreOlder(false);
      }
      if (older.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueOlder = older.filter((m) => !existingIds.has(m.id));
          return [...uniqueOlder, ...prev];
        });
      }
    } catch (err) {
      console.warn('Failed to load older messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleOpenNews = () => {
    setIsNewsOpen(true);
    setHasUnreadNews(false);
    if (newsPosts.length > 0) {
      localStorage.setItem('chatlaxy_last_seen_news', newsPosts[0].timestamp.toString());
    }
  };

  const handleToggleNotifications = () => {
    setIsNotificationsOpen((prev) => !prev);
    setHasUnreadNotifications(false);
  };

  const handleClearAllNotifications = async () => {
    await clearAllNotificationsForUser(currentUser.username);
    setNotifications([]);
  };

  const handleDeleteNotification = async (id: string) => {
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handlePublishNews = async (content: string, mediaUrl?: string | null, mediaType?: 'image' | 'video' | 'gif' | null) => {
    const newPost: NewsPost = {
      id: `news-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      authorUsername: currentUser.username,
      authorAvatar: currentUser.profilePicture || null,
      authorAvatarFrame: currentUser.avatarFrame || null,
      authorRank: currentUser.rank || 'VIP',
      content,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      timestamp: Date.now(),
      reactions: { like: [], dislike: [], heart: [], laugh: [] },
      comments: [],
    };
    await createNewsPost(newPost);
  };

  const handleDeleteNewsPost = async (postId: string) => {
    await deleteNewsPost(postId);
  };

  const handleToggleNewsReaction = async (postId: string, reaction: NewsReactionType) => {
    const post = newsPosts.find((p) => p.id === postId);
    if (!post) return;
    const currentList = post.reactions[reaction] || [];
    const hasReacted = currentList.includes(currentUser.username);
    const updatedList = hasReacted
      ? currentList.filter((u) => u !== currentUser.username)
      : [...currentList, currentUser.username];
    const updatedReactions = { ...post.reactions, [reaction]: updatedList };
    const updatedPost = { ...post, reactions: updatedReactions };
    setNewsPosts((prev) => prev.map((p) => (p.id === postId ? updatedPost : p)));
    await updateNewsPost(updatedPost);
  };

  const handleAddNewsComment = async (postId: string, commentText: string) => {
    const post = newsPosts.find((p) => p.id === postId);
    if (!post) return;
    const newComment = {
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      authorUsername: currentUser.username,
      authorAvatar: currentUser.profilePicture || null,
      authorAvatarFrame: currentUser.avatarFrame || null,
      content: commentText,
      timestamp: Date.now(),
    };
    const updatedComments = [...(post.comments || []), newComment];
    const updatedPost = { ...post, comments: updatedComments };
    setNewsPosts((prev) => prev.map((p) => (p.id === postId ? updatedPost : p)));
    await updateNewsPost(updatedPost);
  };

  const handleDeleteNewsComment = async (postId: string, commentId: string) => {
    const post = newsPosts.find((p) => p.id === postId);
    if (!post || !post.comments) return;
    const updatedComments = post.comments.filter((c) => c.id !== commentId);
    const updatedPost = { ...post, comments: updatedComments };
    setNewsPosts((prev) => prev.map((p) => (p.id === postId ? updatedPost : p)));
    await updateNewsPost(updatedPost);
  };

  // Determine server permissions & ranks
  const isServerOwner = activeServer
    ? activeServer.owner.toLowerCase().trim() === currentUser.username.toLowerCase().trim()
    : false;

  const currentMemberObj = activeServer
    ? serverMembers.find((m) => m.username.toLowerCase().trim() === currentUser.username.toLowerCase().trim())
    : null;

  const assignedServerRole = currentMemberObj?.roles?.[0] || null;

  // In a server: owner is DEVELOPER, member is assigned role or Member
  // In main chat: user's global rank
  const effectiveRank = activeServer
    ? isServerOwner
      ? 'DEV'
      : (assignedServerRole || 'VIP')
    : currentUser.rank;

  const effectiveCustomRankName = activeServer
    ? isServerOwner
      ? 'Server Developer'
      : (assignedServerRole || null)
    : currentUser.customRankName;

  // Handle sending message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    // Check slash commands (e.g. /dice, /allin, /daily, /flip, /clear)
    if (trimmed.startsWith('/')) {
      const commandResult = handleChatCommand(
        trimmed,
        currentUser
      );

      if (commandResult.isCommand) {
        setInputText('');
        setReplyContext(null);

        if (commandResult.updatedProfile) {
          onUpdateCurrentUser(commandResult.updatedProfile);
        }

        if (commandResult.clearChat) {
          setHiddenMessageIds(new Set());
          await clearAllMessages(
            commandResult.publicMessage,
            activeServer?.id || null,
            activeChannel?.id || null
          );
        } else if (commandResult.publicMessage) {
          await sendMessage(
            commandResult.publicMessage,
            activeServer?.id || null,
            activeChannel?.id || null
          );
        }

        if (commandResult.privateFeedback) {
          setPrivateNotice(commandResult.privateFeedback);
        }

        setTimeout(() => {
          inputRef.current?.focus();
        }, 10);
        return;
      }
    }

    // Daily rewards message tracker
    recordMessageSentForDailyRewards(currentUser.username).then(({ count, date }) => {
      onUpdateCurrentUser({
        ...currentUser,
        dailyMessagesCount: count,
        dailyMessagesDate: date,
      });
    }).catch(() => {});

    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

    const targetChannelId = activeChannel?.id || (channels.length > 0 ? channels[0].id : 'general');

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      senderId: 'user',
      senderName: currentUser.username,
      senderHandle: `@${currentUser.username.toLowerCase().replace(/\s+/g, '')}`,
      senderAvatar: currentUser.profilePicture,
      senderAvatarFrame: currentUser.avatarFrame || currentUser.effects?.pfpBorder || null,
      senderRank: effectiveRank as any,
      senderCustomRankName: effectiveCustomRankName,
      senderUsernameStyle: currentUser.usernameStyle || null,
      contentStyle: currentUser.chatTextStyle || null,
      isSystemBot: false,
      content: trimmed,
      timestamp: Date.now(),
      formattedTime,
      serverId: activeServer?.id || null,
      channelId: activeServer ? targetChannelId : null,
      replyTo: replyContext
        ? {
            id: replyContext.messageId,
            senderName: replyContext.senderName,
            content: replyContext.content,
          }
        : null,
    } as any;

    setInputText('');
    setReplyContext(null);

    try {
      await sendMessage(
        newMessage,
        activeServer?.id || null,
        activeServer ? targetChannelId : null
      );
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages((prev) => [...prev, newMessage]);
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyContext({
      messageId: msg.id,
      senderName: msg.senderName,
      content: msg.content,
    });
    inputRef.current?.focus();
  };

  const handleHide = (id: string) => {
    setHiddenMessageIds((prev) => new Set(prev).add(id));
  };

  const handleDelete = async (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (msg) {
      addAuditLog(
        currentUser.username,
        'Deleted Message',
        `${currentUser.username} deleted a message by ${msg.senderName}: "${msg.content.slice(0, 40)}"`,
        'chat'
      );
    }
    try {
      await deleteMessage(id, activeServer?.id || null, activeChannel?.id || null);
    } catch (err) {
      console.error('Error deleting message:', err);
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClaimDailyReward = async (milestoneCount: number, gold: number, rubies: number) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const currentClaimed =
      currentUser.dailyMessagesDate === todayKey
        ? currentUser.claimedDailyMilestones || []
        : [];
    if (currentClaimed.includes(milestoneCount)) return;

    const updated: ProfileData = {
      ...currentUser,
      dailyMessagesDate: todayKey,
      claimedDailyMilestones: [...currentClaimed, milestoneCount],
      wallet: {
        gold: (currentUser.wallet?.gold || 0) + gold,
        ruby: (currentUser.wallet?.ruby || 0) + rubies,
      },
    };
    onUpdateCurrentUser(updated);

    claimDailyReward(currentUser.username, milestoneCount, gold, rubies).then((fresh) => {
      if (fresh) onUpdateCurrentUser(fresh);
    }).catch((err) => {
      console.warn('Error claiming daily reward:', err);
    });
  };

  const handleSelectAvatarFrame = async (frameId: string | null) => {
    const updated: ProfileData = {
      ...currentUser,
      avatarFrame: frameId,
      effects: {
        ...currentUser.effects,
        pfpBorder: frameId || undefined,
      },
    };
    onUpdateCurrentUser(updated);
    await saveUser(updated);
  };

  const handleSelectProfileDecoration = async (decorationId: string | null) => {
    const updated: ProfileData = {
      ...currentUser,
      profileDecoration: decorationId,
    };
    onUpdateCurrentUser(updated);
    try {
      await saveUser(updated);
    } catch (err) {
      console.warn('Failed to save profile decoration:', err);
    }
  };

  const visibleMessages = messages.filter((m) => !hiddenMessageIds.has(m.id));

  return (
    <div className="flex flex-col h-screen w-full bg-[#121316] text-neutral-100 overflow-hidden select-none">
      {/* Top Bar Header */}
      <header className="h-14 sm:h-16 pl-2 sm:pl-3 pr-4 sm:pr-6 bg-[#16171b] border-b border-[#25262d] flex items-center justify-between shrink-0 z-20 relative">
        {/* Left: Hamburger Menu + Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setIsHamburgerOpen((prev) => !prev)}
            aria-label="Open navigation menu"
            className="relative p-1.5 sm:p-2 text-neutral-300 hover:text-white hover:bg-[#20222c] rounded-md transition-colors cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            {hasUnreadNews && (
              <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[#16171b] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
            )}
          </button>
          <ChatlaxyLogo size="md" />

          {/* Quick Server Switcher Button in Header */}
          <button
            type="button"
            onClick={() => setIsServerHubOpen((prev) => !prev)}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer ${
              isServerHubOpen
                ? 'bg-violet-600 text-white border-violet-400 shadow-xs'
                : 'bg-[#1b1c24] text-neutral-300 hover:text-white border-[#2b2e3c] hover:border-violet-500/50'
            }`}
          >
            <ServerIcon className="w-3.5 h-3.5 text-violet-400" />
            <span>Servers</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#282a38] text-neutral-300">
              {servers.length}
            </span>
          </button>
        </div>

        {/* Right: Notifications + Profile Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleToggleNotifications}
            aria-label="Open notifications"
            className="relative p-2 text-neutral-300 hover:text-white hover:bg-[#20222c] rounded-full transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5 fill-current/10" />
            {hasUnreadNotifications && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[#16171b] animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            aria-label="Open profile menu"
            className="focus:outline-none cursor-pointer transition-transform hover:scale-105"
          >
            <UserAvatar
              src={currentUser.profilePicture}
              username={currentUser.username}
              frameId={currentUser.avatarFrame || currentUser.effects?.pfpBorder}
              size="sm"
              shape="circle"
            />
          </button>
        </div>

        {/* Notifications Dropdown */}
        <NotificationsDropdown
          isOpen={isNotificationsOpen}
          notifications={notifications}
          onClose={() => setIsNotificationsOpen(false)}
          onClearAll={handleClearAllNotifications}
          onDeleteNotification={handleDeleteNotification}
          onOpenProfile={(username) => setActiveProfileTarget(username)}
        />

        {/* Profile Menu Dropdown */}
        <ProfileMenuDropdown
          profile={currentUser}
          isOpen={isProfileMenuOpen}
          onClose={() => setIsProfileMenuOpen(false)}
          onLogout={onLogout}
          onOpenProfile={() => setActiveProfileTarget('current_user')}
          onOpenChatBackground={() => setIsChatBgModalOpen(true)}
          onOpenAdminPanel={onOpenAdminPanel}
        />
      </header>

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Pinned News Panel */}
        {isNewsOpen && (
          <NewsPanel
            currentUser={currentUser}
            newsPosts={newsPosts}
            onClose={() => setIsNewsOpen(false)}
            onOpenProfile={(username) => setActiveProfileTarget(username)}
            onDeletePost={handleDeleteNewsPost}
            onToggleReaction={handleToggleNewsReaction}
            onAddComment={handleAddNewsComment}
            onDeleteComment={handleDeleteNewsComment}
            onOpenCreateNews={
              isFounderOrAbove(currentUser) ? () => setIsComposerModalOpen(true) : undefined
            }
          />
        )}

        {/* Middle Area: Either Server Hub OR Active Chat (Main Chat or Server Space) */}
        {isServerHubOpen ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <ServerBrowser
              servers={servers}
              currentUsername={currentUser.username}
              onOpenCreateServer={() => setIsCreateServerModalOpen(true)}
              onSelectServer={handleSelectServerFromHub}
              onJoinServer={handleJoinServer}
              onLeaveServer={handleLeaveServer}
              onClose={() => setIsServerHubOpen(false)}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#121316]">
            {/* Context Sub-Header: Active Server / Main Chat Details & Channels */}
            <div className="px-4 py-2 bg-[#171820] border-b border-[#232530] flex flex-wrap items-center justify-between gap-2 shrink-0 z-10">
              <div className="flex items-center gap-2.5 flex-wrap">
                {activeServer ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#222432] border border-[#34374a] flex items-center justify-center overflow-hidden shrink-0">
                        {activeServer.iconUrl ? (
                          <img src={activeServer.iconUrl} alt="Icon" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-violet-300">
                            {activeServer.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-neutral-100">{activeServer.name}</span>
                    </div>

                    {/* Channels List / Switcher */}
                    <div className="flex items-center gap-1 bg-[#121317] p-0.5 rounded-md border border-[#262835]">
                      {channels.map((ch) => {
                        const isCurrent = (activeChannel?.id || channels[0]?.id) === ch.id;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => setActiveChannel(ch)}
                            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-[#252837] text-white shadow-xs'
                                : 'text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            <Hash className="w-3 h-3 text-neutral-400" />
                            <span>{ch.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-neutral-200">Main Chat (Global Community)</span>
                  </div>
                )}
              </div>

              {/* Right actions: Server Admin (Dev only) & Switcher */}
              <div className="flex items-center gap-2">
                {activeServer && isServerOwner && (
                  <button
                    type="button"
                    onClick={() => setIsServerAdminOpen(true)}
                    className="py-1 px-2.5 bg-gradient-to-r from-purple-700 to-violet-600 hover:from-purple-600 hover:to-violet-500 text-white text-[11px] font-bold rounded-md shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Crown className="w-3 h-3 text-amber-300" />
                    <span>Server Settings (Dev)</span>
                  </button>
                )}

                {activeServer ? (
                  <button
                    type="button"
                    onClick={() => setActiveServer(null)}
                    className="py-1 px-2.5 bg-[#20222c] hover:bg-[#2a2c3a] text-neutral-300 hover:text-white text-[11px] font-medium rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back to Main Chat</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsServerHubOpen(true)}
                    className="py-1 px-2.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/30 text-[11px] font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Compass className="w-3 h-3 text-violet-400" />
                    <span>Explore Servers</span>
                  </button>
                )}
              </div>
            </div>

            {/* Custom Chat Background Image Layer */}
            {previewChatBackground && (
              <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <img
                  src={previewChatBackground}
                  alt="Chat background"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-[#121316]/40 backdrop-blur-[0.5px]" />
              </div>
            )}

            {/* Scrollable message list */}
            <main className="flex-1 overflow-y-auto flex flex-col w-full relative z-10">
              {visibleMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto select-none">
                  <span className="text-sm font-medium text-neutral-400 bg-[#121316]/75 px-3.5 py-2 rounded-md border border-[#23242c]">
                    {activeServer
                      ? `Welcome to #${activeChannel?.name || 'general'} in ${activeServer.name}! Be the first to say hi.`
                      : 'No messages yet. Send a message or roll the dice!'}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col w-full">
                  {/* Pagination: Load older messages */}
                  {hasMoreOlder && messages.length >= 30 && (
                    <div className="flex justify-center py-2.5">
                      <button
                        type="button"
                        onClick={handleLoadOlderMessages}
                        disabled={isLoadingOlder}
                        className="text-xs text-neutral-400 hover:text-neutral-100 bg-[#1a1b22] hover:bg-[#232530] border border-[#2d303e] px-4 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isLoadingOlder ? 'Loading older messages...' : '↑ Load earlier messages'}
                      </button>
                    </div>
                  )}
                  {visibleMessages.map((msg, index) => {
                    const isCurrentUser = msg.senderId === 'user' || msg.senderName === currentUser.username;
                    const isAlternateBg = index % 2 === 1;

                    const senderProfile =
                      allUsers[msg.senderName.toLowerCase().trim()] ||
                      (msg.senderName.toLowerCase().trim() === currentUser.username.toLowerCase().trim()
                        ? currentUser
                        : null);

                    return (
                      <ChatMessageItem
                        key={msg.id}
                        message={msg}
                        isCurrentUser={isCurrentUser}
                        isAlternateBg={isAlternateBg}
                        canModerate={isFounderOrAbove(currentUser) || isServerOwner}
                        senderProfile={senderProfile}
                        onReply={handleReply}
                        onHide={handleHide}
                        onDelete={handleDelete}
                        onOpenProfile={(target) => setActiveProfileTarget(target)}
                      />
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} className="h-2" />
            </main>

            {/* Fixed Message Input */}
            <footer className="w-full bg-[#16171b] border-t border-[#25262d] px-4 py-3 shrink-0 z-10">
              <div className="max-w-4xl mx-auto flex flex-col gap-1.5">
                {privateNotice && (
                  <div
                    className={`flex items-center justify-between px-3 py-1.5 rounded-md text-xs animate-in fade-in duration-150 border ${
                      privateNotice.type === 'success'
                        ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                        : privateNotice.type === 'error'
                        ? 'bg-red-950/80 border-red-500/40 text-red-200'
                        : 'bg-[#1e202b] border-[#34374a] text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {privateNotice.type === 'success' && (
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                      {privateNotice.type === 'error' && (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      )}
                      {privateNotice.type === 'info' && (
                        <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      )}
                      <span className="font-medium">{privateNotice.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrivateNotice(null)}
                      aria-label="Dismiss notice"
                      className="p-0.5 text-neutral-400 hover:text-white rounded transition-colors ml-2 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Reply indicator banner */}
                {replyContext && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#1f2129] border border-[#2e303c] rounded-md text-xs text-neutral-300 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-neutral-200">
                        Replying to {replyContext.senderName}:
                      </span>
                      <span className="text-neutral-400 truncate">
                        &ldquo;{replyContext.content}&rdquo;
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyContext(null)}
                      aria-label="Cancel reply"
                      className="p-0.5 text-neutral-400 hover:text-neutral-200 rounded transition-colors ml-2 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Input Form */}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      activeServer
                        ? `Message #${activeChannel?.name || 'general'} in ${activeServer.name}...`
                        : 'Type a message or command (/dice, /allin, /daily)...'
                    }
                    className="flex-1 px-4 py-2.5 bg-[#111215] border border-[#2c2d35] hover:border-zinc-600 focus:border-zinc-400 rounded-md text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="py-2.5 px-4 bg-zinc-200 hover:bg-white disabled:opacity-40 disabled:hover:bg-zinc-200 text-zinc-950 font-medium text-xs sm:text-sm rounded-md transition-colors flex items-center gap-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </footer>
          </div>
        )}

        {/* Right-Side Online Players Panel */}
        <OnlinePlayersPanel
          currentUser={currentUser}
          allUsers={allUsers}
          onOpenProfile={(userId) => setActiveProfileTarget(userId)}
        />
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={activeProfileTarget !== null}
        targetUserId={activeProfileTarget}
        currentUser={currentUser}
        allUsers={allUsers}
        onClose={() => setActiveProfileTarget(null)}
        onUpdateCurrentUser={onUpdateCurrentUser}
      />

      {/* Chat Background Modal */}
      <ChatBackgroundModal
        isOpen={isChatBgModalOpen}
        currentBackground={currentUser.chatBackground || null}
        onClose={() => {
          setIsChatBgModalOpen(false);
          setPreviewChatBackground(currentUser.chatBackground || null);
        }}
        onPreviewBackground={(bg) => setPreviewChatBackground(bg)}
        onSaveBackground={(bg) => {
          onUpdateCurrentUser({
            ...currentUser,
            chatBackground: bg,
          });
          setPreviewChatBackground(bg);
        }}
        onResetBackground={() => {
          onUpdateCurrentUser({
            ...currentUser,
            chatBackground: null,
          });
          setPreviewChatBackground(null);
        }}
      />

      {/* Hamburger Navigation Drawer */}
      <HamburgerMenuDrawer
        isOpen={isHamburgerOpen}
        hasUnreadNews={hasUnreadNews}
        onClose={() => setIsHamburgerOpen(false)}
        onOpenServers={() => {
          setIsServerHubOpen(true);
        }}
        onOpenDailyRewards={() => setIsDailyRewardsOpen(true)}
        onOpenAvatarFrames={() => setIsAvatarFramesOpen(true)}
        onOpenProfileDecorations={() => setIsProfileDecorationsOpen(true)}
        onOpenNews={handleOpenNews}
      />

      {/* Create News Modal */}
      {isComposerModalOpen && isFounderOrAbove(currentUser) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setIsComposerModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#161720] border border-[#2c2e3e] rounded-xs shadow-2xl p-4">
            <NewsComposer
              onPublish={async (content, mediaUrl, mediaType) => {
                await handlePublishNews(content, mediaUrl, mediaType);
                setIsComposerModalOpen(false);
              }}
              onCancel={() => setIsComposerModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Daily Rewards Modal */}
      <DailyRewardsModal
        isOpen={isDailyRewardsOpen}
        currentUser={currentUser}
        allUsers={allUsers}
        onClose={() => setIsDailyRewardsOpen(false)}
        onClaimReward={handleClaimDailyReward}
      />

      {/* Avatar Frame Studio Modal */}
      <AvatarFrameStudioModal
        isOpen={isAvatarFramesOpen}
        currentUser={currentUser}
        onClose={() => setIsAvatarFramesOpen(false)}
        onSelectFrame={handleSelectAvatarFrame}
      />

      {/* Profile Decorations Modal */}
      <ProfileDecorationsModal
        isOpen={isProfileDecorationsOpen}
        currentUser={currentUser}
        onClose={() => setIsProfileDecorationsOpen(false)}
        onSaveDecoration={handleSelectProfileDecoration}
      />

      {/* Create Server Modal */}
      <CreateServerModal
        isOpen={isCreateServerModalOpen}
        currentUsername={currentUser.username}
        onClose={() => setIsCreateServerModalOpen(false)}
        onServerCreated={handleServerCreated}
      />

      {/* Server Developer Admin Panel */}
      {activeServer && isServerAdminOpen && (
        <ServerAdminPanel
          isOpen={isServerAdminOpen}
          server={activeServer}
          currentUser={currentUser.username}
          channels={channels}
          roles={serverRoles}
          members={serverMembers}
          onClose={() => setIsServerAdminOpen(false)}
          onRefreshServer={refreshActiveServer}
          onServerDeleted={handleServerDeleted}
        />
      )}
    </div>
  );
};
