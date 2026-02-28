import { useState } from 'react';
import { Bookmark, ChevronDown, Plus, Trash2, Check } from 'lucide-react';
import type { SavedView } from '../hooks/useSavedViews';

interface SavedViewsDropdownProps {
  views: SavedView[];
  activeViewId: string | null;
  onApply: (viewId: string) => void;
  onSave: (name: string) => void;
  onDelete: (viewId: string) => void;
  onClear: () => void;
}

export default function SavedViewsDropdown({
  views,
  activeViewId,
  onApply,
  onSave,
  onDelete,
  onClear,
}: SavedViewsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const handleSave = () => {
    if (newViewName.trim()) {
      onSave(newViewName.trim());
      setNewViewName('');
      setShowSaveInput(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
          activeViewId
            ? 'border-slate-400 bg-slate-50 text-slate-900'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
        aria-label="Saved views"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bookmark className="w-4 h-4" />
        <span className="hidden sm:inline">{activeViewId ? 'Saved View' : 'Views'}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          {/* Saved views list */}
          {views.length > 0 ? (
            <div className="max-h-48 overflow-y-auto">
              {views.map((view) => (
                <div
                  key={view.id}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 ${
                    view.id === activeViewId ? 'bg-slate-50' : ''
                  }`}
                >
                  <button
                    onClick={() => {
                      onApply(view.id);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-2 text-sm text-slate-700 flex-1 text-left min-w-0"
                  >
                    {view.id === activeViewId && <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                    <span className="truncate">{view.name}</span>
                  </button>
                  <button
                    onClick={() => onDelete(view.id)}
                    className="p-1 text-slate-400 hover:text-red-500 shrink-0"
                    aria-label={`Delete view ${view.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-3 py-2 text-xs text-slate-400">No saved views yet</p>
          )}

          {/* Clear active */}
          {activeViewId && (
            <button
              onClick={() => {
                onClear();
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 border-t border-slate-100"
            >
              Clear active view
            </button>
          )}

          {/* Save current */}
          <div className="border-t border-slate-100">
            {showSaveInput ? (
              <div className="p-2 flex gap-2">
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="View name..."
                  aria-label="Name for saved view"
                  className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={!newViewName.trim()}
                  className="px-2 py-1 text-sm bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Save current filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
