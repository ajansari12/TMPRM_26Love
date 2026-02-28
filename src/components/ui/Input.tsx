import { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full rounded-lg border transition-colors
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
              ${leftIcon ? 'pl-10' : 'pl-3'} pr-3 py-2 text-sm
              ${error
                ? 'border-red-300 focus:border-red-400 focus:ring-red-200'
                : 'border-slate-300 focus:border-slate-400 focus:ring-slate-200'
              }
              ${className}
            `.trim()}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
