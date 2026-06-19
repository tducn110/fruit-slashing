import React from "react";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: React.ReactNode;
  variant?: "ghost" | "soft" | "solid";
}

export function IconButton({
  label,
  children,
  variant = "ghost",
  className = "",
  ...props
}: IconButtonProps) {
  const baseClassName = variant === "ghost" ? "game-btn-close" : "game-btn";
  const finalClassName = `${baseClassName} ${className}`.trim();
  
  return (
    <button aria-label={label} className={finalClassName} {...props}>
      {children}
    </button>
  );
}
