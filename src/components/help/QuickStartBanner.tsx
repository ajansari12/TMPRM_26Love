import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { DefenseLine } from '../../types/organization';
import { QUICK_START } from './helpData';

interface QuickStartBannerProps {
  defenseLine: DefenseLine | null;
}

const BANNER_STYLES: Record<DefenseLine, { bg: string; border: string; badge: string; badgeText: string; primaryBtn: string }> = {
  '1a': {
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100/60',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    badgeText: '1st Line Business',
    primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  '1b': {
    bg: 'bg-gradient-to-br from-sky-50 to-sky-100/60',
    border: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-700 border border-sky-200',
    badgeText: '1st Line Coordinator',
    primaryBtn: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  '2nd': {
    bg: 'bg-gradient-to-br from-cyan-50 to-cyan-100/60',
    border: 'border-cyan-200',
    badge: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
    badgeText: '2nd Line Risk & Compliance',
    primaryBtn: 'bg-cyan-600 hover:bg-cyan-700 text-white',
  },
  '3rd': {
    bg: 'bg-gradient-to-br from-orange-50 to-orange-100/60',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-700 border border-orange-200',
    badgeText: '3rd Line Audit',
    primaryBtn: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  'senior_management': {
    bg: 'bg-gradient-to-br from-rose-50 to-rose-100/60',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-700 border border-rose-200',
    badgeText: 'Senior Management',
    primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  'admin': {
    bg: 'bg-gradient-to-br from-slate-50 to-slate-100/60',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700 border border-slate-200',
    badgeText: 'Administrator',
    primaryBtn: 'bg-slate-700 hover:bg-slate-800 text-white',
  },
};

export default function QuickStartBanner({ defenseLine }: QuickStartBannerProps) {
  if (!defenseLine) return null;

  const content = QUICK_START[defenseLine];
  const styles = BANNER_STYLES[defenseLine];

  return (
    <div className={`rounded-2xl border ${styles.bg} ${styles.border} p-6 mb-8`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/70 border border-white/90 flex items-center justify-center shadow-sm">
          <Sparkles className="w-5 h-5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${styles.badge}`}>
              {styles.badgeText}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{content.title}</h2>
          <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">{content.subtitle}</p>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {content.actions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  action.primary
                    ? styles.primaryBtn
                    : 'bg-white/80 hover:bg-white text-gray-700 border border-gray-200'
                }`}
              >
                {action.label}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
