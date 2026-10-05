import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react';
import { PollData } from '../types/chat';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePoll: (poll: PollData) => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  onCreatePoll,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuestion = question.trim();
    const validOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!cleanQuestion || validOptions.length < 2) return;

    const poll: PollData = {
      question: cleanQuestion,
      options: validOptions.map((opt, i) => ({
        id: `opt-${i + 1}-${Date.now()}`,
        text: opt,
        votes: [],
      })),
    };

    onCreatePoll(poll);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#161720] border border-[#272a3a] rounded-xl shadow-2xl p-5 flex flex-col gap-4 text-left animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between border-b border-[#252838] pb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-neutral-100">Create a Community Poll</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Question Input */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-neutral-300">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What game should we play tonight?"
              className="w-full px-3 py-2 text-xs bg-[#101117] border border-[#2a2c3a] focus:border-violet-500 rounded-md text-neutral-100 placeholder-neutral-500 outline-none transition-colors"
            />
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-neutral-300">Options</label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 px-3 py-1.5 text-xs bg-[#101117] border border-[#2a2c3a] focus:border-violet-500 rounded-md text-neutral-100 placeholder-neutral-500 outline-none transition-colors"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="p-1.5 text-neutral-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-1 self-start px-2.5 py-1 text-xs text-violet-300 hover:text-violet-200 bg-violet-950/40 hover:bg-violet-900/50 rounded border border-violet-800/40 flex items-center gap-1 transition-colors cursor-pointer font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Option</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252838]">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3 text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!question.trim() || options.map((o) => o.trim()).filter(Boolean).length < 2}
              className="py-1.5 px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Create Poll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
