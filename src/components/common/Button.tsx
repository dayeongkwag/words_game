import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
}

/** 공통 버튼. 색상/크기는 CSS 토큰에서만 온다. */
export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, block ? 'btn--block' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
