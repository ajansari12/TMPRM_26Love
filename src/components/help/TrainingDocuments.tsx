import { useState } from 'react';
import { GraduationCap, FileText, Download, Search, Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DefenseLine } from '../../types/organization';
import { TRAINING_DOCS, TrainingDoc } from './helpData';
import { useOrganization } from '../../contexts/OrganizationContext';
import { TRAINING_DOC_GENERATORS, DocGenerator } from '../../lib/trainingDocs/index';

const CATEGORY_COLORS: Record<string, string> = {
  Orientation: 'bg-blue-50 text-blue-700 border-blue-200',
  'User Guide': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Compliance: 'bg-amber-50 text-amber-700 border-amber-200',
  'Risk Management': 'bg-red-50 text-red-700 border-red-200',
  Workflow: 'bg-sky-50 text-sky-700 border-sky-200',
  Contracts: 'bg-teal-50 text-teal-700 border-teal-200',
  Reference: 'bg-gray-50 text-gray-700 border-gray-200',
};

const AUDIENCE_LABELS: Record<DefenseLine, string> = {
  '1a': '1A',
  '1b': '1B',
  '2nd': '2nd',
  '3rd': '3rd',
  senior_management: 'Senior Mgmt',
  admin: 'Admin',
};

const AUDIENCE_COLORS: Record<DefenseLine, string> = {
  '1a': 'bg-blue-50 text-blue-600',
  '1b': 'bg-sky-50 text-sky-600',
  '2nd': 'bg-cyan-50 text-cyan-700',
  '3rd': 'bg-orange-50 text-orange-600',
  senior_management: 'bg-rose-50 text-rose-700',
  admin: 'bg-slate-50 text-slate-700',
};

interface TrainingDocumentsProps {
  defenseLine: DefenseLine | null;
}

interface DocCardProps {
  doc: TrainingDoc;
  orgName: string;
  generator: DocGenerator | undefined;
}

function DocCard({ doc, orgName, generator }: DocCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const catColor = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS.Reference;

  async function handleDownload() {
    if (!generator || isGenerating) return;
    setIsGenerating(true);
    try {
      generator({ orgName });
      toast.success(`${doc.title} downloaded successfully.`);
    } catch {
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-md transition-all flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-gray-500" />
        </div>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${catColor} flex-shrink-0`}
        >
          {doc.category}
        </span>
      </div>

      <div className="flex-1">
        <h3 className="text-sm font-bold text-gray-900 leading-snug mb-1.5">{doc.title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{doc.description}</p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex flex-wrap gap-1">
          {doc.audience.map((line) => (
            <span
              key={line}
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${AUDIENCE_COLORS[line]}`}
            >
              {AUDIENCE_LABELS[line]}
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-400">{doc.pages}p</span>
      </div>

      <button
        onClick={handleDownload}
        disabled={isGenerating || !generator}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-medium text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating PDF...
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </>
        )}
      </button>
    </div>
  );
}

export default function TrainingDocuments({ defenseLine }: TrainingDocumentsProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();

  const orgName = currentOrganization?.name || 'TPRM Platform';
  const categories = Array.from(new Set(TRAINING_DOCS.map((d) => d.category)));

  const filtered = TRAINING_DOCS.filter((doc) => {
    const matchesRole = !defenseLine || doc.audience.includes(defenseLine);
    const matchesSearch =
      !search ||
      doc.title.toLowerCase().includes(search.toLowerCase()) ||
      doc.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !activeCategory || doc.category === activeCategory;
    return matchesRole && matchesSearch && matchesCat;
  });

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <GraduationCap className="w-5 h-5 text-gray-400" />
        <h2 className="text-xl font-bold text-gray-900">Training Documents</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Reference guides, compliance documentation, and platform training materials.
        {defenseLine && ' Showing documents relevant to your role.'}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent bg-white"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          {categories.map((cat) => {
            const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Reference;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-all ${
                  isActive ? catColor + ' shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
          No documents match your search or filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <DocCard
              key={doc.title}
              doc={doc}
              orgName={orgName}
              generator={TRAINING_DOC_GENERATORS[doc.title]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
