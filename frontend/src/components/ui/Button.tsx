import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/format';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger' | 'dark';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'icon';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary-container hover:bg-brand-primary-hover text-text-primary font-bold shadow-sm',
  secondary: 'bg-surface-card border border-border-strong text-text-primary font-semibold hover:bg-surface-canvas hover:border-slate-300',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas font-medium',
  ai: 'bg-ai-subtle border border-ai-border text-ai-accent font-semibold hover:bg-indigo-100',
  danger: 'bg-surface-card border border-border-strong text-error font-semibold hover:bg-red-50 hover:border-red-200',
  dark: 'bg-text-primary text-white font-semibold hover:bg-slate-800',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-[12px] gap-1',
  sm: 'h-8 px-3 text-label-md gap-1.5',
  md: 'h-9 px-4 text-label-md gap-2',
  icon: 'h-8 w-8 justify-center',
};

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'sm', className?: string) {
  return cn(
    'inline-flex items-center justify-center rounded-lg transition-colors duration-150 whitespace-nowrap select-none',
    'disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary',
    variants[variant],
    sizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'sm', icon, iconRight, loading, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Icon name="progress_activity" className="text-[16px] animate-spin" /> : icon && <Icon name={icon} className="text-[16px]" />}
      {children}
      {iconRight && <Icon name={iconRight} className="text-[16px]" />}
    </button>
  );
});

interface LinkButtonProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  className?: string;
  children?: ReactNode;
  state?: unknown;
}

export function LinkButton({ to, variant = 'secondary', size = 'sm', icon, iconRight, className, children, state }: LinkButtonProps) {
  return (
    <Link to={to} state={state} className={buttonClasses(variant, size, className)}>
      {icon && <Icon name={icon} className="text-[16px]" />}
      {children}
      {iconRight && <Icon name={iconRight} className="text-[16px]" />}
    </Link>
  );
}
