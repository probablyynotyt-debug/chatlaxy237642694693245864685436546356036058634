import React, { useState } from 'react';
import { Flag, X, CheckCircle2 } from 'lucide-react';
import { ChatMessage } from '../types/chat';

interface ReportModalProps {
  isOpen: boolean;
  targetMessage: ChatMessage | null;
  targetUsername?: string | null;
  onClose: () => void;
  onSubmitReport: (reason: string, details: string) => void;
}

const REPORT_REASONS = [
  'Spam or unsolicited advertising',
  'Harassment or hate speech',
  'Inappropriate or explicit content',
  'Impersonation or fraud',
  'Other policy violation',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  targetMessage,
  targetUsername,
  onClose,
  onSubmitReport,
}) => {
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitReport(selectedReason, details);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#161720] border border-[#282b3d] rounded-xl shadow-2xl overflow-hidden text-left animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#252838] bg-[#181a23]">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-neutral-100">
              {targetMessage ? 'Report Message' : `Report User @${targetUsername}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
            <h4 className="text-sm font-bold text-neutral-100">Report Submitted</h4>
            <p className="text-xs text-neutral-400">Thank you for helping keep Chatlaxy safe and respectful.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-neutral-300">Select Reason:</label>
              <div className="flex flex-col gap-1.5">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-colors cursor-pointer ${
                      selectedReason === reason
                        ? 'bg-amber-950/40 border-amber-500/80 text-amber-200 font-bold'
                        : 'bg-[#111219] border-[#272a3b] text-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-neutral-300">Additional Details (Optional):</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe why you are submitting this report..."
                rows={3}
                className="w-full p-2.5 bg-[#0e0f15] border border-[#2a2c3d] focus:border-amber-500 rounded-lg text-xs text-neutral-100 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252838]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white rounded-lg bg-[#202230] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-zinc-950 rounded-lg bg-amber-400 hover:bg-amber-300 shadow cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
