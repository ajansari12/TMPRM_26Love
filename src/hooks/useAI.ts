import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';

type AIAction = 'assess-assist' | 'document-analyze' | 'risk-summarize' | 'risk-predict' | 'query';

interface UseAIOptions {
  action: AIAction;
  vendorId?: string;
}

interface AIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: { tokens_input: number; tokens_output: number };
  log_id?: string;
}

export function useAI<T = unknown>({ action, vendorId }: UseAIOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logId, setLogId] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const execute = useCallback(
    async (payload: Record<string, unknown>): Promise<AIResponse<T>> => {
      if (!currentOrganization?.id || !user?.id) {
        const err = 'Organization or user context not available';
        setError(err);
        return { success: false, error: err };
      }

      setLoading(true);
      setError(null);

      try {
        const { data: responseData, error: fnError } = await supabase.functions.invoke(
          'ai-gateway',
          {
            body: {
              action,
              payload,
              vendor_id: vendorId,
              organization_id: currentOrganization.id,
              user_id: user.id,
            },
          }
        );

        if (fnError) {
          const errMsg = fnError.message || 'AI request failed';
          setError(errMsg);
          return { success: false, error: errMsg };
        }

        const response = responseData as AIResponse<T>;

        if (!response.success) {
          setError(response.error || 'Unknown AI error');
          return response;
        }

        setData(response.data ?? null);
        setLogId(response.log_id ?? null);
        return response;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'AI request failed';
        setError(errMsg);
        return { success: false, error: errMsg };
      } finally {
        setLoading(false);
      }
    },
    [action, vendorId, currentOrganization?.id, user?.id]
  );

  const submitFeedback = useCallback(
    async (rating: 'thumbs_up' | 'thumbs_down', correctionText?: string) => {
      if (!logId || !user?.id) return;

      await supabase.from('ai_feedback').insert({
        ai_usage_log_id: logId,
        user_id: user.id,
        rating,
        correction_text: correctionText || null,
      });
    },
    [logId, user?.id]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLogId(null);
  }, []);

  return {
    data,
    loading,
    error,
    logId,
    execute,
    submitFeedback,
    reset,
  };
}
