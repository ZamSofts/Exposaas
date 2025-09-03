import React from "react";

export const CustomButton = ({ 
  title, 
  children, 
  onClick, 
  className = "", 
  icon = null, 
  type = "button",
  variant = "primary",
  size = "md",
  disabled = false,
  ...props 
}) => {
  const baseClasses = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  
  const variantClasses = {
    primary: "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 focus:ring-[var(--primary)]",
    outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--muted)] text-[var(--foreground)] focus:ring-[var(--primary)]",
    ghost: "hover:bg-[var(--muted)] text-[var(--foreground)] focus:ring-[var(--primary)]"
  };
  
  const sizeClasses = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4",
    lg: "h-12 px-6 text-lg"
  };
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
  
  return (
    <button 
      type={type}
      onClick={onClick} 
      className={classes}
      disabled={disabled}
      {...props}
    >
      {icon}
      {children || title}
    </button>
  );
};
