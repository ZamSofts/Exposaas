import React from "react";

export const CustomButton = ({ title, children, onClick, className = "", icon = null, type = "button", variant = "primary", size = "md", disabled = false, ...props }) => {
  const baseClasses = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-lg gap-2";

  const variantClasses = {
    primary: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] focus:ring-[var(--primary)]/50 shadow-sm",
    secondary: "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--border)] focus:ring-[var(--primary)]/50",
    outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--secondary)] text-[var(--foreground)] focus:ring-[var(--primary)]/50",
    ghost: "bg-transparent hover:bg-[var(--secondary)] text-[var(--foreground)] focus:ring-[var(--primary)]/50",
    success: "bg-[var(--success)] text-white hover:bg-[var(--success)]/90 focus:ring-[var(--success)]/50 shadow-sm",
    warning: "bg-[var(--warning)] text-white hover:bg-[var(--warning)]/90 focus:ring-[var(--warning)]/50 shadow-sm",
    error: "bg-[var(--error)] text-white hover:bg-[var(--error)]/90 focus:ring-[var(--error)]/50 shadow-sm",
    destructive: "bg-[var(--error)] text-white hover:bg-[var(--error)]/90 focus:ring-[var(--error)]/50 shadow-sm",
  };

  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
    xl: "h-14 px-8 text-lg",
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button type={type} onClick={onClick} className={classes} disabled={disabled} {...props}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children || title}</span>
    </button>
  );
};
