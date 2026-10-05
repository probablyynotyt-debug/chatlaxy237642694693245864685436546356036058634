import React from 'react';
import { CheckCircle2, BarChart2 } from 'lucide-react';
import { PollData } from '../types/chat';

interface PollCardProps {
  poll: PollData;
  currentUsername: string;
  onVote: (optionId: string) => void;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  currentUsername,
  onVote,
}) => {
  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);

  return (
    <div className="w-full max-w-sm sm:max-w-md my-2 bg-gradient-to-r from-[#161722] via-[#1a1b28] to-[#151620] border border-[#2c2f42] rounded-xl p-3.5 shadow-lg flex flex-col gap-3 text-left select-none">
      {/* Poll Header */}
      <div className="flex items-center justify-between border-b border-[#282a3c] pb-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-violet-400" />
          <h4 className="text-xs sm:text-sm font-bold text-neutral-100">{poll.question}</h4>
        </div>
        <span className="text-[11px] font-mono text-neutral-400 font-medium">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      {/* Options List */}
      <div className="flex flex-col gap-2">
        {poll.options.map((opt) => {
          const votesCount = opt.votes ? opt.votes.length : 0;
          const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
          const hasVotedThis = opt.votes ? opt.votes.includes(currentUsername) : false;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onVote(opt.id)}
              className={`relative overflow-hidden w-full p-2.5 rounded-lg border transition-all text-left flex items-center justify-between cursor-pointer ${
                hasVotedThis
                  ? 'border-violet-500 bg-violet-950/30 text-white'
                  : 'border-[#292b3a] hover:border-violet-500/50 bg-[#12131a] text-neutral-200'
              }`}
            >
              {/* Progress Percentage Fill */}
              <div
                style={{ width: `${percent}%` }}
                className={`absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none ${
                  hasVotedThis ? 'bg-violet-600/30' : 'bg-[#232638]'
                }`}
              />

              <div className="relative z-10 flex items-center gap-2 min-w-0">
                {hasVotedThis && <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                <span className="text-xs font-semibold truncate">{opt.text}</span>
              </div>

              <span className="relative z-10 text-[11px] font-mono font-bold text-neutral-400 ml-2">
                {percent}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
