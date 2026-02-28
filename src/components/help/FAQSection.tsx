import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { DefenseLine } from '../../types/organization';
import { FAQ_GROUPS, FAQItem } from './helpData';

interface FAQSectionProps {
  activeLine: DefenseLine | null;
}

const COLOR_MAP: Record<string, { tab: string; tabActive: string; chevron: string; border: string }> = {
  blue: {
    tab: 'text-blue-600 hover:bg-blue-50',
    tabActive: 'bg-blue-600 text-white',
    chevron: 'text-blue-500',
    border: 'border-blue-100',
  },
  sky: {
    tab: 'text-sky-600 hover:bg-sky-50',
    tabActive: 'bg-sky-600 text-white',
    chevron: 'text-sky-500',
    border: 'border-sky-100',
  },
  cyan: {
    tab: 'text-cyan-600 hover:bg-cyan-50',
    tabActive: 'bg-cyan-600 text-white',
    chevron: 'text-cyan-500',
    border: 'border-cyan-100',
  },
  orange: {
    tab: 'text-orange-600 hover:bg-orange-50',
    tabActive: 'bg-orange-500 text-white',
    chevron: 'text-orange-500',
    border: 'border-orange-100',
  },
  rose: {
    tab: 'text-rose-600 hover:bg-rose-50',
    tabActive: 'bg-rose-600 text-white',
    chevron: 'text-rose-500',
    border: 'border-rose-100',
  },
  slate: {
    tab: 'text-slate-600 hover:bg-slate-50',
    tabActive: 'bg-slate-700 text-white',
    chevron: 'text-slate-500',
    border: 'border-slate-100',
  },
};

function FAQAccordion({ faqs, color }: { faqs: FAQItem[]; color: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const colorStyle = COLOR_MAP[color] || COLOR_MAP.slate;

  return (
    <div className="space-y-2">
      {faqs.map((faq, idx) => (
        <div
          key={idx}
          className={`rounded-xl border ${colorStyle.border} bg-white overflow-hidden transition-shadow ${
            openIndex === idx ? 'shadow-md' : 'shadow-sm hover:shadow-md'
          }`}
        >
          <button
            onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
            className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left"
          >
            <span className="text-sm font-semibold text-gray-800 leading-snug pr-2">
              {faq.question}
            </span>
            {openIndex === idx ? (
              <ChevronUp className={`w-4 h-4 flex-shrink-0 mt-0.5 ${colorStyle.chevron}`} />
            ) : (
              <ChevronDown className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
            )}
          </button>
          {openIndex === idx && (
            <div className="px-5 pb-4">
              <div className="pt-1 border-t border-gray-100">
                <p className="text-sm text-gray-600 leading-relaxed mt-3">{faq.answer}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FAQSection({ activeLine }: FAQSectionProps) {
  const [selectedRole, setSelectedRole] = useState<DefenseLine>(
    activeLine ?? '1a'
  );

  const activeGroup = FAQ_GROUPS.find((g) => g.role === selectedRole);
  const colorStyle = activeGroup ? COLOR_MAP[activeGroup.color] || COLOR_MAP.slate : COLOR_MAP.slate;

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <MessageCircle className="w-5 h-5 text-gray-400" />
        <h2 className="text-xl font-bold text-gray-900">Frequently Asked Questions</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Select your role to see the most relevant questions and answers.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {FAQ_GROUPS.map((group) => {
          const gStyle = COLOR_MAP[group.color] || COLOR_MAP.slate;
          const isActive = selectedRole === group.role;
          return (
            <button
              key={group.role}
              onClick={() => setSelectedRole(group.role)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                isActive
                  ? `${gStyle.tabActive} border-transparent shadow-sm`
                  : `bg-white ${gStyle.tab} border-gray-200`
              }`}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {activeGroup && (
        <FAQAccordion faqs={activeGroup.faqs} color={activeGroup.color} />
      )}

      <div className={`mt-6 rounded-xl border ${colorStyle.border} bg-white p-4 flex items-start gap-3`}>
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-4 h-4 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">Still have questions?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Contact your Organization Administrator or reach out through your organization's internal support channel.
          </p>
        </div>
      </div>
    </section>
  );
}
