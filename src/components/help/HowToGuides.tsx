import { useState } from 'react';
import {
  FileText,
  Calculator,
  ClipboardCheck,
  FileSearch,
  FolderOpen,
  LogOut,
  BarChart2,
  UserPlus,
  CheckCircle,
  Clock,
  ChevronRight,
  BookOpen,
  X,
} from 'lucide-react';
import { DefenseLine } from '../../types/organization';
import { HOW_TO_GUIDES, GuideItem } from './helpData';

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  Calculator,
  ClipboardCheck,
  FileSearch,
  FolderOpen,
  LogOut,
  BarChart2,
  UserPlus,
};

interface HowToGuidesProps {
  defenseLine: DefenseLine | null;
}

function GuideModal({ guide, onClose }: { guide: GuideItem; onClose: () => void }) {
  const Icon = ICON_MAP[guide.icon] ?? BookOpen;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 p-6 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 leading-tight">{guide.title}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {guide.duration} read
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <CheckCircle className="w-3 h-3" />
                {guide.steps.length} steps
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">{guide.description}</p>
          <ol className="space-y-3">
            {guide.steps.map((step, idx) => (
              <li key={idx} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function HowToGuides({ defenseLine }: HowToGuidesProps) {
  const [selectedGuide, setSelectedGuide] = useState<GuideItem | null>(null);
  const [showAll, setShowAll] = useState(false);

  const relevantGuides = HOW_TO_GUIDES.filter(
    (g) =>
      !defenseLine ||
      g.audience.includes(defenseLine) ||
      defenseLine === 'admin'
  );

  const visibleGuides = showAll ? relevantGuides : relevantGuides.slice(0, 6);

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900">How-To Guides</h2>
        </div>
        {relevantGuides.length > 6 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showAll ? 'Show less' : `Show all ${relevantGuides.length}`}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Step-by-step walkthroughs for the most common tasks.
        {defenseLine && ' Showing guides relevant to your role.'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleGuides.map((guide) => {
          const Icon = ICON_MAP[guide.icon] ?? BookOpen;
          return (
            <button
              key={guide.title}
              onClick={() => setSelectedGuide(guide)}
              className="group text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-1.5">
                {guide.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
                {guide.description}
              </p>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {guide.duration}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <CheckCircle className="w-3 h-3" />
                  {guide.steps.length} steps
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedGuide && (
        <GuideModal guide={selectedGuide} onClose={() => setSelectedGuide(null)} />
      )}
    </section>
  );
}
