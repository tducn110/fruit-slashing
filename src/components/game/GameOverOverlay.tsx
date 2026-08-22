import { ReactNode } from "react";
import { Heart } from "lucide-react";
import { RewardAdButton } from "./RewardAdButton";

interface GameOverOverlayProps {
  finalScore: number | null;
  displayScore: number | null;
  running: boolean;
  countdown: number | null;
  mode: "continue" | "summary";
  canContinue: boolean;
  canDoubleScore: boolean;
  adPending: boolean;
  onContinue: () => void;
  onDeclineContinue: () => void;
  onDoubleScore: () => void;
  onEndGame: () => void;
}

function DecisionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`decisionCard ${className}`}>{children}</div>;
}

function HeartHUD() {
  return (
    <DecisionCard className="heartHUD">
      <div className="heartHUD__hearts">
        <Heart fill="#ffffff" color="var(--pencil-gray)" size={42} strokeWidth={2} />
        <Heart fill="#ffffff" color="var(--pencil-gray)" size={42} strokeWidth={2} />
        <Heart fill="#ffffff" color="var(--pencil-gray)" size={42} strokeWidth={2} />
      </div>
    </DecisionCard>
  );
}

function ScoreCard({ displayScore, canDoubleScore }: { displayScore: number; canDoubleScore: boolean }) {
  return (
    <DecisionCard>
      <div className="scoreLabel">Điểm số</div>
      <div className="scoreValue">{displayScore.toLocaleString("vi-VN")} điểm</div>
      <div className="scoreMeta">
        {canDoubleScore ? "Chọn nhân đôi điểm hoặc kết thúc game." : "Điểm đã được nhân đôi. Chọn kết thúc game."}
      </div>
    </DecisionCard>
  );
}

function SecondaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="secondaryButton" disabled={disabled}>
      {children}
    </button>
  );
}

export function GameOverOverlay({
  finalScore,
  displayScore,
  running,
  countdown,
  mode,
  canContinue,
  canDoubleScore,
  adPending,
  onContinue,
  onDeclineContinue,
  onDoubleScore,
  onEndGame,
}: GameOverOverlayProps) {
  if (running || countdown !== null || finalScore === null || displayScore === null) return null;

  if (mode === "continue" && canContinue) {
    return (
      <div className="gameOverOverlay">
        <div className="gameOverCard">
          <HeartHUD />
          <RewardAdButton 
            label="Tiếp tục chơi" 
            onClick={onContinue} 
            disabled={adPending} 
          />
          <SecondaryButton onClick={onDeclineContinue} disabled={adPending}>
            Không
          </SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="gameOverOverlay">
      <div className="gameOverCard">
        <ScoreCard 
          displayScore={displayScore} 
          canDoubleScore={canDoubleScore} 
        />
        <RewardAdButton 
          label="x2" 
          onClick={onDoubleScore} 
          disabled={!canDoubleScore || adPending} 
        />
        <SecondaryButton onClick={onEndGame} disabled={adPending}>
          Kết thúc game
        </SecondaryButton>
      </div>
    </div>
  );
}
