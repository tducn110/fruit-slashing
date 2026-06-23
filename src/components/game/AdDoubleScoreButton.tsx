import { Clapperboard } from "lucide-react";

interface AdDoubleScoreButtonProps {
  score: number;
}

export function AdDoubleScoreButton({ score }: AdDoubleScoreButtonProps) {
  const doubledScore = score * 2;

  return (
    <button type="button" className="adDoubleScoreButton" aria-label={`Xem quảng cáo để nhận ${doubledScore} điểm`}>
      <span className="adDoubleScoreIcon" aria-hidden="true">
        <Clapperboard size={18} strokeWidth={2.6} />
      </span>
      <span className="adDoubleScoreText">
        <span className="adDoubleScoreLabel">x2 điểm hiện tại</span>
        <span className="adDoubleScoreValue">{doubledScore} điểm</span>
      </span>
    </button>
  );
}
