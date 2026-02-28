import { useState } from 'react';
import { Check, Pencil, X, Sparkles } from 'lucide-react';
import AIConfidenceBadge from './AIConfidenceBadge';
import type { AIAssessmentSuggestion } from '../../types';

interface SuggestionCardProps {
  suggestion: AIAssessmentSuggestion;
  questionText: string;
  currentAnswer?: unknown;
  onAccept: (questionId: string, value: string | string[]) => void;
  onDismiss: (questionId: string) => void;
}

export default function SuggestionCard({
  suggestion,
  questionText,
  currentAnswer,
  onAccept,
  onDismiss,
}: SuggestionCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isAccepted =
    currentAnswer !== undefined &&
    JSON.stringify(currentAnswer) === JSON.stringify(suggestion.suggested_value);

  const displayValue = Array.isArray(suggestion.suggested_value)
    ? suggestion.suggested_value.join(', ')
    : suggestion.suggested_value;

  // Extract just the question number for compact display
  const qNum = questionText.match(/^(Q\d+[a-z]?)/)?.[1] || '';

  return (
    <div
      className={`border rounded-lg p-3 transition-all ${
        isAccepted
          ? 'border-green-300 bg-green-50'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-700 truncate">{qNum}</span>
        </div>
        <AIConfidenceBadge confidence={suggestion.confidence} compact />
      </div>

      <p className="text-sm font-medium text-slate-800 mb-1 line-clamp-2">{displayValue}</p>
      <p className="text-xs text-slate-500 mb-2 line-clamp-2">{suggestion.reasoning}</p>

      {isAccepted ? (
        <div className="flex items-center gap-1 text-xs text-green-700">
          <Check className="w-3.5 h-3.5" />
          <span>Accepted</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAccept(suggestion.question_id, suggestion.suggested_value)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
          >
            <Check className="w-3 h-3" />
            Accept
          </button>
          <button
            onClick={() => {
              setDismissed(true);
              onDismiss(suggestion.question_id);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-3 h-3" />
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
