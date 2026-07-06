import { Clapperboard } from "lucide-react";

interface AdDoubleScoreButtonProps {
  score: number;
  onClick: () => void;
  disabled?: boolean;
}

export function AdDoubleScoreButton({ score, onClick, disabled = false }: AdDoubleScoreButtonProps) {
  return (
    <button
      type="button"
      className="adDoubleScoreButton adDoubleScoreButton-compact"
      aria-label={`Nhan x2 diem`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="adDoubleScoreIcon" aria-hidden="true">
        <Clapperboard size={18} strokeWidth={2.6} />
      </span>
      <span className="adDoubleScoreLabel">x2</span>
    </button>
  );
}
