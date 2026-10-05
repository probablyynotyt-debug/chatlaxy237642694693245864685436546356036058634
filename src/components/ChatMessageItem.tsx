import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontal,
  CornerUpLeft,
  EyeOff,
  Trash2,
  User,
  Bot,
  AlertCircle,
  Smile,
  Pin,
  Bookmark,
  Edit3,
  Globe,
  MessageSquare,
  Flag,
  Check,
  X,
} from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { ProfileData } from '../types/bio';
import { UserAvatar } from './UserAvatar';
import { RubyIcon, GoldIcon } from './CurrencyIcons';
import { getTextStyleCSS } from '../utils/textStylePresets';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { FormattedMessageText } from './FormattedMessageText';
import { LinkPreviewCard } from './LinkPreviewCard';
import { extractLinks, translateText } from '../utils/chatFormatters';
import { PollCard } from './PollCard';
import { ReactionPicker } from './ReactionPicker';

interface ChatMessageItemProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  isAlternateBg: boolean;
  canModerate?: boolean;
  senderProfile?: ProfileData | null;
  bookmarkedIds?: string[];
  onReply: (message: ChatMessage) => void;
  onHide: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenProfile?: (username: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onPin?: (messageId: string) => void;
  onBookmark?: (messageId: string) => void;
  onOpenThread?: (message: ChatMessage) => void;
  onReport?: (message: ChatMessage) => void;
  onVotePoll?: (messageId: string, optionId: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isCurrentUser,
  isAlternateBg,
  canModerate,
  senderProfile,
  bookmarkedIds = [],
  onReply,
  onHide,
  onDelete,
  onOpenProfile,
  onReact,
  onEdit,
  onPin,
  onBookmark,
  onOpenThread,
  onReport,
  onVotePoll,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showMutedContent, setShowMutedContent] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const isBookmarked = bookmarkedIds.includes(message.id);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Determine styles
  const usernameStyleConfig = senderProfile?.usernameStyle || message.senderUsernameStyle;
  const usernameInlineStyle = getTextStyleCSS(usernameStyleConfig, true);

  const contentStyleConfig = senderProfile?.chatTextStyle || message.contentStyle;
  const contentInlineStyle = getTextStyleCSS(contentStyleConfig, false);

  const bgClass = isAlternateBg
    ? 'bg-[#101115]/50 border-b border-[#252631]/40'
    : 'bg-[#16171d]/50 border-b border-[#2a2c38]/40';

  const handleProfileClick = () => {
    if (onOpenProfile) {
      if (message.isSystemBot) {
        onOpenProfile('system');
      } else {
        onOpenProfile(message.senderName);
      }
    }
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onEdit) {
      onEdit(message.id, editContent.trim());
      setIsEditing(false);
    }
  };

  const handleToggleTranslate = () => {
    if (translatedText) {
      setTranslatedText(null);
    } else {
      setTranslatedText(translateText(message.content));
    }
    setMenuOpen(false);
  };

  const links = extractLinks(message.content);

  const isClearMessage =
    message.isClearChatMessage ||
    message.id.startsWith('bot-clear') ||
    message.content.startsWith('This room has been cleared by') ||
    message.content.startsWith('Chat cleared by');

  if (isClearMessage) {
    let clearedBy = message.clearedBy;
    if (!clearedBy) {
      const match = message.content.match(/(?:This room has been cleared by|Chat cleared by)\s+([^!]+)!?/i);
      clearedBy = match ? match[1].trim() : 'Developer';
    }

    return (
      <div className="w-full px-4 sm:px-6 py-2 transition-colors duration-100 flex items-center gap-2.5 select-none hover:bg-white/[0.02]">
        <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 bg-[#22242d] border border-neutral-600/50 flex items-center justify-center">
          {message.senderAvatar ? (
            <img src={message.senderAvatar} alt="Bot" className="w-full h-full object-cover" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-neutral-400" />
          )}
        </div>
        <div className="text-xs sm:text-[13px] text-[#8696a7] flex items-center gap-1.5 leading-none">
          <span>This room has been cleared by</span>
          <button
            type="button"
            onClick={() => onOpenProfile && onOpenProfile(clearedBy!)}
            className="font-bold text-neutral-100 hover:underline cursor-pointer focus:outline-none"
          >
            {clearedBy}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative w-full px-4 sm:px-6 py-3 sm:py-3.5 transition-colors duration-100 ${bgClass} hover:brightness-125 backdrop-blur-[1px]`}
    >
      {/* Quoted Reply Preview Header */}
      {(message as any).replyTo && (
        <div className="flex items-center gap-2 ml-11 mb-1.5 text-[11px] text-neutral-400 border-l-2 border-violet-500/60 pl-2">
          <CornerUpLeft className="w-3 h-3 text-violet-400 shrink-0" />
          <span className="font-bold text-violet-300">@{(message as any).replyTo.senderName}</span>
          <span className="truncate italic text-neutral-400">"{(message as any).replyTo.content}"</span>
        </div>
      )}

      <div className="flex items-start gap-3 w-full">
        {/* Avatar - Clickable to open Profile */}
        <button
          type="button"
          onClick={handleProfileClick}
          title={`View ${message.senderName}'s profile`}
          className="shrink-0 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 focus:outline-none"
        >
          {message.isSystemBot ? (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xs bg-[#242630] border border-[#343644] flex items-center justify-center">
              <Bot className="w-5 h-5 text-purple-400" />
            </div>
          ) : (
            <UserAvatar
              src={message.senderAvatar}
              username={message.senderName}
              frameId={message.senderAvatarFrame}
              size="md"
              shape="square"
            />
          )}
        </button>

        {/* Message Body */}
        <div className="flex-1 min-w-0 pr-8">
          {/* Header: Name, Rank, Timestamp, Pin tag */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button
              type="button"
              onClick={handleProfileClick}
              className="text-left focus:outline-none cursor-pointer group/name inline-flex items-center gap-1.5"
            >
              <span
                style={usernameInlineStyle}
                className={`text-xs sm:text-sm font-semibold truncate group-hover/name:underline tracking-normal ${
                  message.isSystemBot
                    ? 'text-purple-300'
                    : !usernameStyleConfig?.colorValue
                    ? 'text-neutral-100'
                    : ''
                }`}
              >
                {message.senderName}
              </span>

              {message.senderCustomRankName && (
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-violet-950/80 border border-violet-700/60 text-violet-300">
                  {message.senderCustomRankName}
                </span>
              )}
            </button>

            {/* Timestamp */}
            <span className="text-[11px] text-neutral-500 font-mono">
              {message.formattedTime}
            </span>

            {/* Edited Indicator */}
            {message.isEdited && (
              <span className="text-[10px] text-neutral-500 italic font-medium">(edited)</span>
            )}

            {/* Pinned Tag */}
            {message.isPinned && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-950/80 text-amber-300 border border-amber-700/60 font-bold">
                <Pin className="w-3 h-3 fill-current" />
                <span>Pinned</span>
              </span>
            )}
          </div>

          {/* Gambling Payload */}
          {message.gamblePayload ? (
            <div className="w-full flex justify-center my-2">
              <div className="relative w-full max-w-md bg-[#161720]/90 border border-[#2b2d3c] rounded-md p-4 shadow-xl text-center flex flex-col items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  {message.gamblePayload.command === 'dice' ? '🎲 Dice Roll' : '🎰 All-In Gamble'}
                </span>

                <div
                  className={`px-3 py-1 rounded-sm text-xs font-bold tracking-wide ${
                    message.gamblePayload.won
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60'
                      : 'bg-red-950/80 text-red-400 border border-red-700/60'
                  }`}
                >
                  {message.gamblePayload.won ? 'VICTORY' : 'DEFEAT'}
                </div>

                <div className="flex items-center justify-center gap-3 text-xs text-neutral-300">
                  {message.gamblePayload.rollNumber !== undefined && (
                    <span className="bg-[#20222e] px-2.5 py-1 rounded font-mono text-neutral-200">
                      Roll: {message.gamblePayload.rollNumber}
                    </span>
                  )}
                  {message.gamblePayload.multiplier && (
                    <span className="bg-[#20222e] px-2.5 py-1 rounded font-mono text-purple-300">
                      {message.gamblePayload.multiplier}x
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 mt-1 font-semibold text-xs sm:text-sm">
                  <span className="text-neutral-400">Outcome:</span>
                  <span
                    className={`flex items-center gap-1 font-bold ${
                      message.gamblePayload.won ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {message.gamblePayload.won ? '+' : '-'}
                    {(message.gamblePayload.won
                      ? message.gamblePayload.payoutAmount
                      : message.gamblePayload.betAmount
                    ).toLocaleString()}
                    {message.gamblePayload.currency === 'ruby' ? (
                      <RubyIcon className="w-3.5 h-3.5 inline" />
                    ) : (
                      <GoldIcon className="w-3.5 h-3.5 inline" />
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Standard text message & components */
            <div className="flex flex-col gap-2">
              {/* Poll Card */}
              {message.pollData && (
                <PollCard
                  poll={message.pollData}
                  currentUsername={senderProfile?.username || ''}
                  onVote={(optId) => onVotePoll && onVotePoll(message.id, optId)}
                />
              )}

              {/* Inline Message Edit Form */}
              {isEditing ? (
                <div className="flex flex-col gap-2 my-1">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 bg-[#0f1016] border border-violet-500 rounded-lg text-xs text-neutral-100 outline-none"
                  />
                  <div className="flex items-center gap-2 self-end">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-2.5 py-1 text-xs text-neutral-400 hover:text-white rounded bg-[#202230] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-500 text-white font-bold rounded cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                /* Message Text Content */
                message.content && (
                  <FormattedMessageText
                    content={message.content}
                    styleInline={contentInlineStyle}
                    colorClass={!contentStyleConfig?.colorValue ? 'text-neutral-200' : ''}
                    onOpenProfile={onOpenProfile}
                  />
                )
              )}

              {/* Inline Translated Text */}
              {translatedText && (
                <div className="p-2 bg-violet-950/40 border border-violet-700/50 rounded-lg text-xs text-violet-200 flex flex-col gap-1 my-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-400">
                    <Globe className="w-3 h-3" />
                    <span>Translation</span>
                  </div>
                  <p className="leading-relaxed">{translatedText}</p>
                </div>
              )}

              {/* Media Attachments */}
              {message.mediaUrl && (
                <div className="mt-1">
                  {message.mediaType === 'audio' || message.mediaUrl.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i) ? (
                    <VoiceMessagePlayer src={message.mediaUrl} duration={(message as any).audioDuration} />
                  ) : message.mediaType === 'video' || message.mediaUrl.match(/\.(mp4|webm|mov|ogg)(\?.*)?$/i) ? (
                    <div className="max-w-sm sm:max-w-md rounded-lg overflow-hidden border border-[#2b2d3c] bg-[#101115] shadow-md">
                      <video
                        src={message.mediaUrl}
                        controls
                        preload="metadata"
                        className="w-full max-h-72 object-contain bg-black rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="max-w-sm sm:max-w-md rounded-lg overflow-hidden border border-[#2b2d3c] bg-[#101115] shadow-md">
                      <a
                        href={message.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group/media relative overflow-hidden cursor-zoom-in"
                      >
                        <img
                          src={message.mediaUrl}
                          alt="Shared media"
                          className="w-full max-h-80 object-contain rounded-lg transition-transform duration-200 group-hover/media:scale-[1.01]"
                          loading="lazy"
                        />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Link Previews */}
              {links.length > 0 && <LinkPreviewCard links={links} />}

              {/* Reactions Bar */}
              {message.reactions && Object.keys(message.reactions).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {Object.entries(message.reactions).map(([emoji, users]) => {
                    const hasReacted = senderProfile && users.includes(senderProfile.username);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onReact && onReact(message.id, emoji)}
                        title={users.join(', ')}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all cursor-pointer border ${
                          hasReacted
                            ? 'bg-violet-950/80 border-violet-500 text-violet-200 font-bold'
                            : 'bg-[#181a24] border-[#2a2d3d] text-neutral-300 hover:border-neutral-500'
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="text-[11px] font-mono font-bold">{users.length}</span>
                      </button>
                    );
                  })}

                  {/* Reaction Picker Plus Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setPickerOpen(!pickerOpen)}
                      className="p-1 rounded-full text-neutral-400 hover:text-white bg-[#181a24] border border-[#2a2d3d] hover:border-violet-500 transition-colors cursor-pointer"
                      title="Add reaction"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>

                    {pickerOpen && (
                      <ReactionPicker
                        onSelectEmoji={(e) => onReact && onReact(message.id, e)}
                        onClose={() => setPickerOpen(false)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hover Action Menu */}
      <div className="absolute top-2.5 right-4 flex items-center gap-1 z-10">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Message options"
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-[#252733] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Action Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-8 w-44 bg-[#181921] border border-[#2b2d39] rounded-lg shadow-2xl shadow-black/80 py-1 z-50 text-left animate-in fade-in zoom-in-95 duration-100">
              {/* Reply */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReply(message);
                }}
                className="w-full px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-[#232532] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <CornerUpLeft className="w-3.5 h-3.5 text-neutral-400" />
                <span>Reply</span>
              </button>

              {/* Thread */}
              {onOpenThread && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenThread(message);
                  }}
                  className="w-full px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-[#232532] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Reply in Thread</span>
                </button>
              )}

              {/* Pin */}
              {onPin && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onPin(message.id);
                  }}
                  className="w-full px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-[#232532] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Pin className="w-3.5 h-3.5 text-amber-400" />
                  <span>{message.isPinned ? 'Unpin Message' : 'Pin Message'}</span>
                </button>
              )}

              {/* Bookmark */}
              {onBookmark && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onBookmark(message.id);
                  }}
                  className="w-full px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-[#232532] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'text-amber-400 fill-current' : 'text-neutral-400'}`} />
                  <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark'}</span>
                </button>
              )}

              {/* Translate */}
              <button
                type="button"
                onClick={handleToggleTranslate}
                className="w-full px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-[#232532] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-violet-400" />
                <span>{translatedText ? 'Hide Translation' : 'Translate'}</span>
              </button>

              {/* Edit (Own Message) */}
              {(isCurrentUser || senderProfile?.username === message.senderName) && onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setIsEditing(true);
                  }}
                  className="w-full px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-[#232532] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Edit Message</span>
                </button>
              )}

              {/* Hide Message (Local) */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onHide(message.id);
                }}
                className="w-full px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-[#232532] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
                <span>Hide Message</span>
              </button>

              {/* Report */}
              {onReport && !isCurrentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onReport(message);
                  }}
                  className="w-full px-3 py-2 text-xs text-amber-400 hover:bg-[#232532] flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Report</span>
                </button>
              )}

              {/* Delete Message (If author or Moderator/Dev) */}
              {(isCurrentUser || canModerate) && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(message.id);
                  }}
                  className="w-full px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 flex items-center gap-2 transition-colors border-t border-[#262834] mt-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
