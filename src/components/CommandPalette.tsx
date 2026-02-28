import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Command, CornerDownLeft, Brain } from 'lucide-react';
import { buildNavigation, type NavItem, type NavGroup } from './layout/navigationConfig';
import RiskQueryChat from './ai/RiskQueryChat';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: NavGroup[];
}

interface SearchResult {
  name: string;
  path: string;
  icon: any;
  group: string;
  badge?: number;
}

export default function CommandPalette({ isOpen, onClose, navigation }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'search' | 'ai'>('search');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Flatten navigation into searchable items
  const allItems = useMemo(() => {
    const items: SearchResult[] = [];
    navigation.forEach((group) => {
      group.items.forEach((item) => {
        items.push({
          name: item.name,
          path: item.path,
          icon: item.icon,
          group: group.title,
          badge: item.badge,
        });
      });
    });
    return items;
  }, [navigation]);

  // Filter based on query
  const results = useMemo(() => {
    if (!query.trim()) return allItems;
    const lower = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.group.toLowerCase().includes(lower) ||
        item.path.toLowerCase().includes(lower),
    );
  }, [query, allItems]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActiveTab('search');
      // Focus input after modal renders
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            navigate(results[selectedIndex].path);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, navigate, onClose]);

  // Reset index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'search'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Search className="w-4 h-4" />
            Search
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'ai'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Brain className="w-4 h-4" />
            Ask AI
          </button>
        </div>

        {activeTab === 'ai' ? (
          <div className="h-[50vh]">
            <RiskQueryChat />
          </div>
        ) : (
        <>
        {/* Search input */}
        <div className="flex items-center border-b border-slate-200 px-4">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions..."
            aria-label="Search pages and actions"
            className="flex-1 px-3 py-4 text-base text-slate-900 placeholder-slate-400 bg-transparent border-none outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">
              <p className="text-sm">No results found for "{query}"</p>
            </div>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center px-4 py-3 text-left transition-colors ${
                    isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isSelected ? 'text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{item.group}</p>
                  </div>
                  {item.badge && item.badge > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {isSelected && (
                    <ArrowRight className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-medium">
                <span className="text-[10px]">↑↓</span>
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-medium">
                <CornerDownLeft className="w-3 h-3 inline" />
              </kbd>
              Open
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" />K to toggle
          </span>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
