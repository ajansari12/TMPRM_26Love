import { useState } from 'react';
import {
  HelpCircle,
  BookOpen,
  GraduationCap,
  MessageCircle,
  LifeBuoy,
} from 'lucide-react';
import { useDefenseLineAccess } from '../hooks/useDefenseLineAccess';
import QuickStartBanner from '../components/help/QuickStartBanner';
import FAQSection from '../components/help/FAQSection';
import HowToGuides from '../components/help/HowToGuides';
import TrainingDocuments from '../components/help/TrainingDocuments';

type TabId = 'faq' | 'guides' | 'training';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'faq', label: 'FAQs', icon: MessageCircle },
  { id: 'guides', label: 'How-To Guides', icon: BookOpen },
  { id: 'training', label: 'Training Documents', icon: GraduationCap },
];

export default function HelpCenter() {
  const { defenseLine } = useDefenseLineAccess();
  const [activeTab, setActiveTab] = useState<TabId>('faq');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Help Center</h1>
              <p className="text-sm text-gray-500">
                Guides, FAQs, and training resources for all platform roles
              </p>
            </div>
          </div>
        </div>

        <QuickStartBanner defenseLine={defenseLine} />

        <div className="flex items-center gap-1 mb-8 border-b border-gray-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                  isActive
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'faq' && <FAQSection activeLine={defenseLine} />}
        {activeTab === 'guides' && <HowToGuides defenseLine={defenseLine} />}
        {activeTab === 'training' && <TrainingDocuments defenseLine={defenseLine} />}

        <div className="mt-12 rounded-2xl bg-gray-900 p-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-base font-bold text-white">Need more help?</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Contact your Organization Administrator or refer to your organization's internal support resources for platform access and configuration questions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
