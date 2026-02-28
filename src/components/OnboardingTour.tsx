import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';

export interface TourStep {
  title: string;
  description: string;
  targetSelector?: string;
  route?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to TMPRM',
    description:
      'This is your Third-Party Risk Management dashboard. It gives you an at-a-glance view of vendor health, pending approvals, and upcoming reviews.',
    route: '/',
  },
  {
    title: 'Start an Onboarding Request',
    description:
      'Begin your vendor lifecycle here. Submit a new onboarding request to kick off the approval workflow through all three lines of defense.',
    route: '/onboarding',
  },
  {
    title: 'Manage Your Vendors',
    description:
      'View all approved third parties, their risk tiers, contract status, and compliance scores. Click any vendor for a detailed profile.',
    route: '/vendors',
  },
  {
    title: 'Risk Assessments',
    description:
      'Review tiering assessments that determine each vendor\'s risk level. The assessment wizard walks you through all 53 questions across 8 risk domains.',
    route: '/assessments',
  },
  {
    title: 'Regulatory Reports',
    description:
      'Generate OSFI B-10 compliance reports, board-ready summaries, and inventory exports. Stay audit-ready with one-click report generation.',
    route: '/reports/board',
  },
  {
    title: 'You\'re All Set!',
    description:
      'You now know the key areas of TMPRM. Explore at your own pace, or press ? anytime for keyboard shortcuts. Use Cmd+K to quickly search and navigate.',
  },
];

const TOUR_STORAGE_KEY = 'tmprm_tour_completed';

interface OnboardingTourProps {
  autoStart?: boolean;
}

export default function OnboardingTour({ autoStart = false }: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-start for first-time users
  useEffect(() => {
    if (autoStart && !localStorage.getItem(TOUR_STORAGE_KEY)) {
      const timer = setTimeout(() => setIsActive(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStart]);

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const closeTour = useCallback(() => {
    setIsActive(false);
    setCurrentStep(0);
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
  }, []);

  const goNext = useCallback(() => {
    if (isLastStep) {
      closeTour();
      return;
    }
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    const nextRoute = TOUR_STEPS[nextStep].route;
    if (nextRoute && location.pathname !== nextRoute) {
      navigate(nextRoute);
    }
  }, [currentStep, isLastStep, closeTour, navigate, location.pathname]);

  const goPrev = useCallback(() => {
    if (isFirstStep) return;
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    const prevRoute = TOUR_STEPS[prevStep].route;
    if (prevRoute && location.pathname !== prevRoute) {
      navigate(prevRoute);
    }
  }, [currentStep, isFirstStep, navigate, location.pathname]);

  // Navigate to step route when tour activates
  useEffect(() => {
    if (isActive && step.route && location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [isActive, step.route, location.pathname, navigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeTour();
      if (e.key === 'ArrowRight' || e.key === 'Enter') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, closeTour, goNext, goPrev]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeTour} />

      {/* Tour card */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-slate-900 transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          {/* Close button */}
          <button
            onClick={closeTour}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            aria-label="Close tour"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="px-8 pt-8 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isLastStep ? 'bg-green-100' : 'bg-slate-100'
              }`}>
                {isLastStep ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Sparkles className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </p>
                <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>

            {step.route && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-500 font-mono">
                {step.route}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 flex items-center justify-between">
            <button
              onClick={closeTour}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip tour
            </button>

            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <button
                  onClick={goPrev}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              <button
                onClick={goNext}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                {isLastStep ? 'Get Started' : 'Next'}
                {!isLastStep && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 pb-4">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentStep ? 'bg-slate-900' : i < currentStep ? 'bg-slate-400' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hook to trigger the tour programmatically */
export function useTourTrigger() {
  const resetTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    window.location.reload();
  };
  const hasCompleted = () => localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
  return { resetTour, hasCompleted };
}
