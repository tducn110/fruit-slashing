import { ReactNode } from "react";
import { Clapperboard } from "lucide-react";

export interface RewardAdButtonProps {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function RewardAdButton({ 
  label, 
  icon = <Clapperboard size={18} strokeWidth={2.6} />, 
  onClick, 
  disabled = false 
}: RewardAdButtonProps) {
  return (
    <button
      type="button"
      className="rewardAdButton rewardAdButton-compact"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="rewardAdIcon" aria-hidden="true">
        {icon}
      </span>
      <span className="rewardAdLabel">{label}</span>
    </button>
  );
}

export interface AdDoubleScoreButtonProps {
  score: number;
  onClick: () => void;
  disabled?: boolean;
}

// Thin wrapper for backward compatibility if needed, though we can just use RewardAdButton directly
export function AdDoubleScoreButton({ score, onClick, disabled = false }: AdDoubleScoreButtonProps) {
  return (
    <RewardAdButton 
      label="x2"
      onClick={onClick}
      disabled={disabled}
    />
  );
}
