import React from "react";

export interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
}

export function GameButton({ children, variant = "primary", className = "", style, ...props }: GameButtonProps) {
  return (
    <button className={`game-btn ${className}`.trim()} style={style} {...props}>
      {children}
    </button>
  );
}
