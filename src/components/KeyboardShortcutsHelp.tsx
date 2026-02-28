import { useEffect, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ['Cmd', 'K'], description: 'Focus search bar' },
  { keys: ['N'], description: 'New onboarding request' },
  { keys: ['G'], description: 'Go to dashboard' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close modal / dialog' },
];

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-slate-600" />
            </div>
            <h2 id="shortcuts-title" className="text-lg font-semibold text-slate-900">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4">
          <ul className="space-y-3">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.description} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd
                      key={key}
                      className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-md shadow-sm"
                    >
                      {key === 'Cmd' ? (navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl') : key}
                    </kbd>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-400 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs">?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </div>
  );
}
