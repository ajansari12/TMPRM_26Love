import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useOrganization } from '../../contexts/OrganizationContext';
import { UserCheck, Brain, ChevronDown, ChevronUp, Check } from 'lucide-react';

interface ReviewerRecommendationProps {
  serviceCategory: string;
  vendorTier?: string;
  onSelectReviewer?: (reviewerName: string) => void;
  currentReviewer?: string;
}

interface Reviewer {
  id: string;
  full_name: string;
  email: string;
  defense_line?: string;
  role?: string;
}

interface ReviewerScore {
  reviewer: Reviewer;
  score: number;
  reasons: string[];
  pastAssessments: number;
  currentWorkload: number;
}

export default function ReviewerRecommendation({
  serviceCategory,
  vendorTier,
  onSelectReviewer,
  currentReviewer,
}: ReviewerRecommendationProps) {
  const { currentOrganization } = useOrganization();
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [assessmentCounts, setAssessmentCounts] = useState<Record<string, number>>({});
  const [workloadCounts, setWorkloadCounts] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (currentOrganization?.id) fetchReviewerData();
  }, [currentOrganization?.id]);

  async function fetchReviewerData() {
    if (!currentOrganization?.id) return;

    // Fetch organization members
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, defense_line, role, profiles(id, full_name, email)')
      .eq('organization_id', currentOrganization.id)
      .in('defense_line', ['2nd', '3rd']);

    if (!members) return;

    const reviewerList: Reviewer[] = members
      .filter((m: any) => m.profiles)
      .map((m: any) => ({
        id: m.profiles.id,
        full_name: m.profiles.full_name,
        email: m.profiles.email,
        defense_line: m.defense_line,
        role: m.role,
      }));
    setReviewers(reviewerList);

    // Count past assessments by reviewer for this category
    const { data: assessments } = await supabase
      .from('tiering_assessments')
      .select('reviewer_name, id')
      .eq('organization_id', currentOrganization.id)
      .eq('status', 'approved');

    const counts: Record<string, number> = {};
    assessments?.forEach((a: any) => {
      if (a.reviewer_name) {
        counts[a.reviewer_name] = (counts[a.reviewer_name] || 0) + 1;
      }
    });
    setAssessmentCounts(counts);

    // Count current open tasks (workload)
    const { data: openTasks } = await supabase
      .from('tiering_assessments')
      .select('reviewer_name, id')
      .eq('organization_id', currentOrganization.id)
      .in('status', ['in_progress', 'pending_review']);

    const workload: Record<string, number> = {};
    openTasks?.forEach((t: any) => {
      if (t.reviewer_name) {
        workload[t.reviewer_name] = (workload[t.reviewer_name] || 0) + 1;
      }
    });
    setWorkloadCounts(workload);
  }

  const recommendations = useMemo((): ReviewerScore[] => {
    if (reviewers.length === 0) return [];

    return reviewers
      .map((reviewer) => {
        let score = 50; // base
        const reasons: string[] = [];

        // Expertise — past assessment count
        const pastCount = assessmentCounts[reviewer.full_name] || 0;
        if (pastCount >= 10) {
          score += 30;
          reasons.push(`${pastCount} past assessments (experienced)`);
        } else if (pastCount >= 5) {
          score += 20;
          reasons.push(`${pastCount} past assessments`);
        } else if (pastCount >= 1) {
          score += 10;
          reasons.push(`${pastCount} past assessment${pastCount > 1 ? 's' : ''}`);
        }

        // Workload — lower is better
        const workload = workloadCounts[reviewer.full_name] || 0;
        if (workload === 0) {
          score += 20;
          reasons.push('No current workload');
        } else if (workload <= 2) {
          score += 10;
          reasons.push(`${workload} active review${workload > 1 ? 's' : ''}`);
        } else if (workload >= 5) {
          score -= 15;
          reasons.push(`Heavy workload (${workload} active)`);
        }

        // Defense line match for critical vendors
        if (vendorTier === 'tier_5_critical' && reviewer.defense_line === '2nd') {
          score += 10;
          reasons.push('2nd line — appropriate for critical vendors');
        }

        return {
          reviewer,
          score: Math.max(0, Math.min(100, score)),
          reasons,
          pastAssessments: pastCount,
          currentWorkload: workload,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [reviewers, assessmentCounts, workloadCounts, vendorTier]);

  if (reviewers.length === 0) return null;

  const topRecommendation = recommendations[0];

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Brain className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-slate-700">AI Reviewer Recommendation</p>
            {topRecommendation && (
              <p className="text-xs text-slate-500">
                Suggested: <span className="font-medium text-slate-700">{topRecommendation.reviewer.full_name}</span>
                <span className="text-slate-400 ml-1">({topRecommendation.score}% match)</span>
              </p>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-3 space-y-2">
          {recommendations.slice(0, 5).map((rec) => {
            const isSelected = currentReviewer === rec.reviewer.full_name;
            return (
              <button
                key={rec.reviewer.id}
                onClick={() => onSelectReviewer?.(rec.reviewer.full_name)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left ${
                  isSelected
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                  {rec.reviewer.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{rec.reviewer.full_name}</p>
                    {rec === topRecommendation && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 rounded">
                        TOP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {rec.reasons.slice(0, 2).join(' | ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {isSelected ? (
                    <Check className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <span className="text-xs font-medium text-slate-400">{rec.score}%</span>
                  )}
                </div>
              </button>
            );
          })}
          <p className="text-xs text-slate-400 italic pt-1">
            Based on expertise, current workload, and defense line requirements
          </p>
        </div>
      )}
    </div>
  );
}
