import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({ className = '', children, ...props }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-slate-100 ${className}`} {...props}>
      {children}
    </div>
  );
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export function CardTitle({ className = '', children, ...props }: CardTitleProps) {
  return (
    <h3 className={`text-lg font-semibold text-slate-900 ${className}`} {...props}>
      {children}
    </h3>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({ className = '', children, ...props }: CardBodyProps) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}
