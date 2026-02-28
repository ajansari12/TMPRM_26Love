import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp, RefreshCw, Brain } from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import SuggestionCard from './SuggestionCard';
import AIFeedback from './AIFeedback';
import type { AIAssessmentResponse, AIAssessmentSuggestion } from '../../types';

interface AssessmentQuestion {
  id: string;
  text: string;
  type: string;
  options?: { value: string; label: string }[];
}

interface AssessmentSection {
  id: string;
  title: string;
  questions: AssessmentQuestion[];
}

interface AssessmentAssistantProps {
  vendorId: string;
  vendorName: string;
  serviceCategory: string;
  providerType: string;
  country?: string;
  currentSection: number;
  sections: AssessmentSection[];
  answers: Record<string, unknown>;
  previousAnswers?: Record<string, unknown>;
  onAcceptSuggestion: (questionId: string, value: string | string[]) => void;
}

export default function AssessmentAssistant({
  vendorId,
  vendorName,
  serviceCategory,
  providerType,
  country,
  currentSection,
  sections,
  answers,
  previousAnswers,
  onAcceptSuggestion,
}: AssessmentAssistantProps) {
  const [suggestions, setSuggestions] = useState<AIAssessmentSuggestion[]>([]);
  const [vendorContext, setVendorContext] = useState<string>('');
  const [collapsed, setCollapsed] = useState(false);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { loading, error, execute, submitFeedback, logId } = useAI<AIAssessmentResponse>({
    action: 'assess-assist',
    vendorId,
  });

  const fetchSuggestions = useCallback(async () => {
    const section = sections[currentSection];
    if (!section) return;

    // Build question schema for current section
    const questionSchema = section.questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options?.map((o) => ({ value: o.value, label: o.label })),
    }));

    const payload: Record<string, unknown> = {
      vendor: {
        legal_name: vendorName,
        service_category: serviceCategory,
        provider_type: providerType,
        country: country || 'Canada',
      },
      section: {
        title: section.title,
        questions: questionSchema,
      },
      current_answers: answers,
    };

    if (previousAnswers && Object.keys(previousAnswers).length > 0) {
      payload.previous_assessment_answers = previousAnswers;
    }

    const result = await execute(payload);
    if (result.success && result.data) {
      const data = result.data as AIAssessmentResponse;
      setSuggestions(data.suggestions || []);
      setVendorContext(data.vendor_context || '');
      setDismissedIds(new Set());
    }
  }, [vendorName, serviceCategory, providerType, country, currentSection, sections, answers, previousAnswers, execute]);

  // Fetch suggestions when section changes
  useEffect(() => {
    if (vendorName && sections[currentSection]) {
      fetchSuggestions();
    }
  }, [currentSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccept = (questionId: string, value: string | string[]) => {
    onAcceptSuggestion(questionId, value);
    setAcceptedCount((prev) => prev + 1);
  };

  const handleDismiss = (questionId: string) => {
    setDismissedIds((prev) => new Set(prev).add(questionId));
  };

  const currentSectionQuestionIds = new Set(
    sections[currentSection]?.questions.map((q) => q.id) || []
  );

  const sectionSuggestions = suggestions.filter(
    (s) => currentSectionQuestionIds.has(s.question_id) && !dismissedIds.has(s.question_id)
  );

  return (
    <div className="bg-white border border-purple-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 rounded-lg">
            <Brain className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-900">AI Assistant</h3>
            <p className="text-xs text-slate-500">
              {acceptedCount > 0 ? `${acceptedCount} suggestions accepted` : 'Powered by Claude'}
            </p>
          </div>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {/* Vendor Context */}
          {vendorContext && (
            <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
              <span className="font-medium text-slate-700">Vendor Context: </span>
              {vendorContext}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-purple-500 animate-spin mr-2" />
              <span className="text-sm text-slate-500">Analyzing vendor profile...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p>{error}</p>
                <button
                  onClick={fetchSuggestions}
                  className="text-xs font-medium text-red-800 hover:underline mt-1"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {!loading && !error && sectionSuggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {sectionSuggestions.length} suggestion{sectionSuggestions.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={fetchSuggestions}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Refresh suggestions"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>
              {sectionSuggestions.map((suggestion) => {
                const question = sections[currentSection]?.questions.find(
                  (q) => q.id === suggestion.question_id
                );
                return (
                  <SuggestionCard
                    key={suggestion.question_id}
                    suggestion={suggestion}
                    questionText={question?.text || suggestion.question_id}
                    currentAnswer={answers[suggestion.question_id]}
                    onAccept={handleAccept}
                    onDismiss={handleDismiss}
                  />
                );
              })}
            </div>
          )}

          {/* No Suggestions */}
          {!loading && !error && sectionSuggestions.length === 0 && suggestions.length > 0 && (
            <p className="text-xs text-slate-400 text-center py-3">
              No suggestions for this section
            </p>
          )}

          {/* Empty - Not yet loaded */}
          {!loading && !error && suggestions.length === 0 && (
            <div className="text-center py-4">
              <Sparkles className="w-8 h-8 text-purple-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Click refresh to generate AI suggestions</p>
              <button
                onClick={fetchSuggestions}
                className="mt-2 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Generate Suggestions
              </button>
            </div>
          )}

          {/* Feedback */}
          {logId && !loading && suggestions.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <AIFeedback onSubmit={submitFeedback} compact />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
