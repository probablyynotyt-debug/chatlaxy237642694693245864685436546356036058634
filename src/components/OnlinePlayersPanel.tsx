import React from 'react';
import { User, Crown, Server as ServerIcon } from 'lucide-react';
import { ProfileData } from '../types/bio';
import { SYSTEM_BOT } from '../constants/systemBot';
import { getRankConfig } from '../constants/ranks';
import { RankId } from '../types/ranks';
import { UserAvatar } from './UserAvatar';
import { getTextStyleCSS } from '../utils/textStylePresets';
import { ServerData, ServerMember } from '../services/apiService';

interface OnlinePlayersPanelProps {
  currentUser: ProfileData;
  allUsers?: Record<string, ProfileData>;
  server?: ServerData | null;
  serverMembers?: ServerMember[];
  onOpenProfile: (userId: string) => void;
}

export const OnlinePlayersPanel: React.FC<OnlinePlayersPanelProps> = ({
  currentUser,
  allUsers = {},
  server,
  serverMembers = [],
  onOpenProfile,
}) => {
  const isInsideServer = Boolean(server);
  const myUsername = (currentUser?.username || '').toLowerCase().trim();

  // If inside a server, determine membership and server-specific roles
  let rawOnlineUsers: Array<{
    id: string;
    name: string;
    avatar: string | null;
    avatarFrame: string | null;
    isSystemBot: boolean;
    mood: string;
    rank: RankId;
    customRankName: string | null;
    usernameStyle: any;
  }> = [];

  if (isInsideServer && server) {
    const isOwner = server.owner.toLowerCase().trim() === myUsername;
    const myServerMember = serverMembers.find((m) => m.username.toLowerCase().trim() === myUsername);
    const myServerRole = myServerMember?.roles?.[0] || null;

    // Current user in server
    if (currentUser?.username) {
      rawOnlineUsers.push({
        id: currentUser.username,
        name: currentUser.username,
        avatar: currentUser.profilePicture || allUsers[myUsername]?.profilePicture || null,
        avatarFrame: currentUser.avatarFrame || currentUser.effects?.pfpBorder || allUsers[myUsername]?.avatarFrame || null,
        isSystemBot: false,
        mood: currentUser.mood?.trim() || '',
        rank: isOwner ? 'DEV' : (myServerRole ? 'VIP' : 'VIP'),
        customRankName: isOwner ? 'DEVELOPER (Owner)' : myServerRole,
        usernameStyle: currentUser.usernameStyle || allUsers[myUsername]?.usernameStyle || null,
      });
    }

    // Other members of this server
    const otherMemberNames = new Set(
      serverMembers
        .map((m) => m.username.toLowerCase().trim())
        .filter((name) => name !== myUsername)
    );

    // Also include owner if not current user
    if (server.owner.toLowerCase().trim() !== myUsername) {
      otherMemberNames.add(server.owner.toLowerCase().trim());
    }

    otherMemberNames.forEach((uName) => {
      const uProfile = allUsers[uName];
      const memObj = serverMembers.find((m) => m.username.toLowerCase().trim() === uName);
      const isMemOwner = server.owner.toLowerCase().trim() === uName;
      const memRole = memObj?.roles?.[0] || null;

      rawOnlineUsers.push({
        id: uProfile?.username || uName,
        name: uProfile?.username || uName,
        avatar: uProfile?.profilePicture || null,
        avatarFrame: uProfile?.avatarFrame || uProfile?.effects?.pfpBorder || null,
        isSystemBot: false,
        mood: uProfile?.mood?.trim() || '',
        rank: isMemOwner ? 'DEV' : 'VIP',
        customRankName: isMemOwner ? 'DEVELOPER (Owner)' : memRole,
        usernameStyle: uProfile?.usernameStyle || null,
      });
    });
  } else {
    // Global Main Chat Roster
    const otherUsersList = Object.values(allUsers || {}).filter(
      (u) => u && u.username && u.username.toLowerCase().trim() !== myUsername
    );

    rawOnlineUsers = [
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
  }

  // Sort by staff hierarchy (DEV -> FOUNDER -> ... -> MODERATOR -> BOT -> ELITE -> SUPER-VIP -> VIP)
  const onlineUsers = [...rawOnlineUsers].sort((a, b) => {
    const orderA = getRankConfig(a.rank)?.order ?? 99;
    const orderB = getRankConfig(b.rank)?.order ?? 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <aside className="w-56 sm:w-60 md:w-64 bg-[#141518] border-l border-[#24252c] flex flex-col p-4 shrink-0 overflow-y-auto select-none text-left">
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {isInsideServer ? (
              <span className="text-[11px] font-bold tracking-wider text-violet-300 uppercase truncate">
                Server Members
              </span>
            ) : (
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                Online
              </span>
            )}
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">
            {onlineUsers.length}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          {onlineUsers.map((user) => {
            const rankConfig = getRankConfig(user.rank);
            const nameStyle = getTextStyleCSS(user.usernameStyle, true);

            return (
              <button
                key={user.id}
                type="button"
                onClick={() => onOpenProfile(user.id)}
                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-[#1c1d23] transition-colors cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-zinc-600 gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Profile Picture with Avatar Frame */}
                  <UserAvatar
                    src={user.avatar}
                    username={user.name}
                    frameId={user.avatarFrame}
                    size="sm"
                    shape="circle"
                  />

                  {/* Name & Mood */}
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

                {/* Rank icon at the FAR RIGHT END */}
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
    </aside>
  );
};
