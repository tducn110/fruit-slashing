import React from "react";

interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function GameButton({ children, className = "", style, ...props }: GameButtonProps) {
  return (
    <button className={`game-btn ${className}`.trim()} style={style} {...props}>
      {children}
    </button>
  );
}
