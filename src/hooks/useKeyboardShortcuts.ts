import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutHandlers {
  onToggleSearch?: () => void;
  onToggleHelp?: () => void;
}

export function useKeyboardShortcuts({ onToggleSearch, onToggleHelp }: ShortcutHandlers) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onToggleSearch?.();
        return;
      }

      if (isInput) return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }

      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        navigate('/onboarding/new');
        return;
      }

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        navigate('/');
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onToggleSearch, onToggleHelp]);
}
