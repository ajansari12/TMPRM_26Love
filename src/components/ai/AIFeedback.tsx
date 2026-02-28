import { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Check } from 'lucide-react';

interface AIFeedbackProps {
  onSubmit: (rating: 'thumbs_up' | 'thumbs_down', correction?: string) => Promise<void>;
  compact?: boolean;
}

export default function AIFeedback({ onSubmit, compact = false }: AIFeedbackProps) {
  const [submitted, setSubmitted] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRating = async (rating: 'thumbs_up' | 'thumbs_down') => {
    if (submitted) return;
    setSubmitting(true);
    try {
      if (rating === 'thumbs_down') {
        setShowCorrection(true);
        setSubmitted(rating);
      } else {
        await onSubmit(rating);
        setSubmitted(rating);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCorrectionSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit('thumbs_down', correction);
      setShowCorrection(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && !showCorrection) {
    return (
      <div className={`flex items-center gap-1.5 text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>
        <Check className="w-3.5 h-3.5 text-green-500" />
        <span>Feedback recorded</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center gap-2 ${compact ? '' : 'mt-2'}`}>
        <span className={`text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>Was this helpful?</span>
        <button
          onClick={() => handleRating('thumbs_up')}
          disabled={submitting || !!submitted}
          className={`p-1 rounded transition-colors ${
            submitted === 'thumbs_up'
              ? 'text-green-600 bg-green-50'
              : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
          }`}
          aria-label="Helpful"
        >
          <ThumbsUp className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>
        <button
          onClick={() => handleRating('thumbs_down')}
          disabled={submitting || !!submitted}
          className={`p-1 rounded transition-colors ${
            submitted === 'thumbs_down'
              ? 'text-red-600 bg-red-50'
              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
          }`}
          aria-label="Not helpful"
        >
          <ThumbsDown className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        </button>
      </div>

      {showCorrection && (
        <div className="flex gap-2 items-start">
          <div className="relative flex-1">
            <MessageSquare className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              placeholder="What would be more accurate?"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-slate-400"
              rows={2}
              aria-label="Correction feedback"
            />
          </div>
          <button
            onClick={handleCorrectionSubmit}
            disabled={submitting}
            className="px-3 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
