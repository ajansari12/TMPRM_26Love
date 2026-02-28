import { CheckCircle, Circle, ArrowRight, AlertCircle, XCircle, Clock } from 'lucide-react';
import { OnboardingStatus, ONBOARDING_STATUS_LABELS } from '../types/workflow';

interface ProgressStep {
  status: OnboardingStatus;
  label: string;
  description: string;
}

const WORKFLOW_STEPS: ProgressStep[] = [
  {
    status: 'draft',
    label: 'Draft',
    description: 'Request created',
  },
  {
    status: 'submitted',
    label: 'Submitted',
    description: '1st Line submits',
  },
  {
    status: '1b_review',
    label: '1B Review',
    description: 'Coordinator validates',
  },
  {
    status: '2nd_review',
    label: '2nd Line Review',
    description: 'Risk Management reviews',
  },
  {
    status: 'approved',
    label: 'Approved',
    description: 'Request approved',
  },
  {
    status: 'vendor_created',
    label: 'Complete',
    description: 'Vendor created',
  },
];

const RETURN_STATUSES: OnboardingStatus[] = ['1b_returned', '2nd_returned'];
const REJECTION_STATUSES: OnboardingStatus[] = ['rejected', 'withdrawn'];
const CONDITIONAL_STATUSES: OnboardingStatus[] = ['conditionally_approved', 'pending_senior_approval'];

interface OnboardingProgressTrackerProps {
  currentStatus: OnboardingStatus;
  className?: string;
}

export default function OnboardingProgressTracker({
  currentStatus,
  className = '',
}: OnboardingProgressTrackerProps) {
  const isReturned = RETURN_STATUSES.includes(currentStatus);
  const isRejected = REJECTION_STATUSES.includes(currentStatus);
  const isConditional = CONDITIONAL_STATUSES.includes(currentStatus);

  const getCurrentStepIndex = () => {
    const index = WORKFLOW_STEPS.findIndex((step) => step.status === currentStatus);
    if (index !== -1) return index;

    if (currentStatus === '1b_returned') return 2;
    if (currentStatus === '2nd_returned') return 3;
    if (currentStatus === 'conditionally_approved' || currentStatus === 'pending_senior_approval')
      return 4;
    if (currentStatus === 'rejected' || currentStatus === 'withdrawn') return 3;

    return 0;
  };

  const currentStepIndex = getCurrentStepIndex();

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'upcoming' | 'warning' => {
    if (isRejected && stepIndex === currentStepIndex) return 'warning';
    if (isReturned && stepIndex === currentStepIndex) return 'warning';
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'upcoming';
  };

  const getStepIcon = (stepIndex: number) => {
    const status = getStepStatus(stepIndex);

    if (status === 'completed') {
      return <CheckCircle className="w-6 h-6 text-green-600" />;
    }
    if (status === 'current') {
      if (isReturned) return <AlertCircle className="w-6 h-6 text-amber-600 animate-pulse" />;
      if (isRejected) return <XCircle className="w-6 h-6 text-red-600" />;
      if (isConditional) return <Clock className="w-6 h-6 text-yellow-600 animate-pulse" />;
      return <Circle className="w-6 h-6 text-blue-600 animate-pulse fill-blue-600" />;
    }
    if (status === 'warning') {
      return <AlertCircle className="w-6 h-6 text-amber-600" />;
    }
    return <Circle className="w-6 h-6 text-slate-300" />;
  };

  const getStepColor = (stepIndex: number) => {
    const status = getStepStatus(stepIndex);

    if (status === 'completed') return 'text-green-700 border-green-200 bg-green-50';
    if (status === 'current') {
      if (isReturned) return 'text-amber-700 border-amber-200 bg-amber-50';
      if (isRejected) return 'text-red-700 border-red-200 bg-red-50';
      if (isConditional) return 'text-yellow-700 border-yellow-200 bg-yellow-50';
      return 'text-blue-700 border-blue-200 bg-blue-50';
    }
    return 'text-slate-500 border-slate-200 bg-white';
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Workflow Progress</h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isRejected
              ? 'bg-red-100 text-red-700'
              : isReturned
              ? 'bg-amber-100 text-amber-700'
              : isConditional
              ? 'bg-yellow-100 text-yellow-700'
              : currentStatus === 'vendor_created'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {ONBOARDING_STATUS_LABELS[currentStatus]}
        </span>
      </div>

      <div className="space-y-4">
        {WORKFLOW_STEPS.map((step, index) => (
          <div key={step.status}>
            <div className="flex items-center">
              <div className="flex-shrink-0">{getStepIcon(index)}</div>

              <div className="ml-4 flex-1">
                <div
                  className={`inline-flex items-center px-3 py-1 rounded-lg border ${getStepColor(
                    index
                  )}`}
                >
                  <span className="font-medium text-sm">{step.label}</span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{step.description}</p>
              </div>
            </div>

            {index < WORKFLOW_STEPS.length - 1 && (
              <div className="ml-3 mt-2 mb-2">
                <div
                  className={`w-0.5 h-6 ${
                    getStepStatus(index) === 'completed' ? 'bg-green-300' : 'bg-slate-200'
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {isReturned && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Request Returned for Revisions</p>
              <p className="text-sm text-amber-700 mt-1">
                This request has been returned by the reviewer for additional information or
                corrections. Please review the feedback and resubmit.
              </p>
            </div>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">
                Request {currentStatus === 'rejected' ? 'Rejected' : 'Withdrawn'}
              </p>
              <p className="text-sm text-red-700 mt-1">
                {currentStatus === 'rejected'
                  ? 'This onboarding request has been rejected and will not proceed further.'
                  : 'This onboarding request has been withdrawn by the requester.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {isConditional && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Clock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-900">
                {currentStatus === 'pending_senior_approval'
                  ? 'Pending Senior Management Approval'
                  : 'Conditionally Approved'}
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                {currentStatus === 'pending_senior_approval'
                  ? 'This request requires senior management approval before proceeding.'
                  : 'This request has been conditionally approved. Additional requirements must be fulfilled before vendor activation.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
