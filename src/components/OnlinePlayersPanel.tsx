import React from 'react';
import { Users, X } from 'lucide-react';
import { ProfileData } from '../types/bio';
import { SYSTEM_BOT } from '../constants/systemBot';
import { getRankConfig } from '../constants/ranks';
import { RankId } from '../types/ranks';
import { UserAvatar } from './UserAvatar';
import { getTextStyleCSS } from '../utils/textStylePresets';

interface OnlinePlayersPanelProps {
  currentUser: ProfileData;
  allUsers?: Record<string, ProfileData>;
  onOpenProfile: (userId: string) => void;
  isMobileDrawer?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export const OnlinePlayersPanel: React.FC<OnlinePlayersPanelProps> = ({
  currentUser,
  allUsers = {},
  onOpenProfile,
  isMobileDrawer = false,
  isOpen = false,
  onClose,
}) => {
  const myUsername = (currentUser?.username || '').toLowerCase().trim();

  // Global Main Chat Roster
  const otherUsersList = Object.values(allUsers || {}).filter(
    (u) => u && u.username && u.username.toLowerCase().trim() !== myUsername
  );

  const rawOnlineUsers: Array<{
    id: string;
    name: string;
    avatar: string | null;
    avatarFrame: string | null;
    isSystemBot: boolean;
    mood: string;
    rank: RankId;
    customRankName: string | null;
    usernameStyle: any;
  }> = [
    {
      id: 'system',
      name: SYSTEM_BOT.name,
      avatar: SYSTEM_BOT.avatar,
      avatarFrame: null,
      isSystemBot: true,
      mood: '',
      rank: SYSTEM_BOT.rank as RankId,
      customRankName: null,
      usernameStyle: null,
    },
    ...(currentUser?.username
      ? [
          {
            id: currentUser.username,
            name: currentUser.username,
            avatar:
              currentUser.profilePicture ||
              allUsers[myUsername]?.profilePicture ||
              null,
            avatarFrame:
              currentUser.avatarFrame ||
              currentUser.effects?.pfpBorder ||
              allUsers[myUsername]?.avatarFrame ||
              null,
            isSystemBot: false,
            mood: currentUser.mood?.trim() || '',
            rank: (currentUser.rank || (currentUser.username.toLowerCase() === 'null' ? 'DEV' : 'VIP')) as RankId,
            customRankName: currentUser.customRankName || null,
            usernameStyle:
              currentUser.usernameStyle ||
              allUsers[myUsername]?.usernameStyle ||
              null,
          },
        ]
      : []),
    ...otherUsersList.map((u) => ({
      id: u.username,
      name: u.username,
      avatar: u.profilePicture || null,
      avatarFrame: u.avatarFrame || u.effects?.pfpBorder || null,
      isSystemBot: false,
      mood: u.mood?.trim() || '',
      rank: (u.rank || (u.username.toLowerCase() === 'null' ? 'DEV' : 'VIP')) as RankId,
      customRankName: u.customRankName || null,
      usernameStyle: u.usernameStyle || null,
    })),
  ];

  // Sort by staff hierarchy (DEV -> FOUNDER -> ... -> MODERATOR -> BOT -> ELITE -> SUPER-VIP -> VIP)
  const onlineUsers = [...rawOnlineUsers].sort((a, b) => {
    const orderA = getRankConfig(a.rank)?.order ?? 99;
    const orderB = getRankConfig(b.rank)?.order ?? 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name);
  });

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#24252c]">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-bold tracking-wider text-neutral-200 uppercase">
            Online Users
          </span>
          <span className="px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-800 text-[10px] font-mono font-bold">
            {onlineUsers.length}
          </span>
        </div>
        {isMobileDrawer && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
        {onlineUsers.map((user) => {
          const rankConfig = getRankConfig(user.rank);
          const nameStyle = getTextStyleCSS(user.usernameStyle, true);

          return (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                onOpenProfile(user.id);
                if (isMobileDrawer && onClose) onClose();
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#1c1d23] active:bg-[#252732] transition-colors cursor-pointer text-left focus:outline-none gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <UserAvatar
                  src={user.avatar}
                  username={user.name}
                  frameId={user.avatarFrame}
                  size="sm"
                  shape="circle"
                />

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      style={nameStyle}
                      className={`text-xs font-semibold truncate tracking-normal ${
                        !user.usernameStyle?.colorValue ? 'text-neutral-200' : ''
                      }`}
                    >
                      {user.name}
                    </span>
                  </div>

                  {user.customRankName ? (
                    <span className="text-[10px] text-violet-300 font-medium truncate">
                      {user.customRankName}
                    </span>
                  ) : user.mood ? (
                    <span className="text-[11px] text-neutral-300 font-bold italic truncate">
                      {user.mood}
                    </span>
                  ) : null}
                </div>
              </div>

              {rankConfig && (
                <img
                  src={rankConfig.iconUrl}
                  alt={user.customRankName?.trim() || rankConfig.name}
                  title={user.customRankName?.trim() || rankConfig.name}
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 object-contain shrink-0"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (isMobileDrawer) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-150">
        <div className="absolute inset-0" onClick={onClose} />
        <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-[#141518] border-l border-[#24252c] p-4 shadow-2xl animate-in slide-in-from-right duration-200">
          {content}
        </aside>
      </div>
    );
  }

  return (
    <aside className="hidden lg:flex w-60 xl:w-64 bg-[#141518] border-l border-[#24252c] flex-col p-4 shrink-0 overflow-y-auto select-none text-left">
      {content}
    </aside>
  );
};
