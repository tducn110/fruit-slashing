import { ReactNode } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <DecisionCard>
      <div className="scoreLabel">{t('game.score')}</div>
      <div className="scoreValue">{displayScore.toLocaleString("vi-VN")} {t('game.points')}</div>
      <div className="scoreMeta">
        {canDoubleScore ? t('game.choose_double_or_end') : t('game.score_doubled_choose_end')}
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
  const { t } = useTranslation();

  if (running || countdown !== null || finalScore === null || displayScore === null) return null;

  if (mode === "continue" && canContinue) {
    return (
      <div className="gameOverOverlay" role="dialog" aria-modal="true" aria-label="Game Over">
        <div className="gameOverCard">
          <HeartHUD />
          <RewardAdButton 
            label={t('game.continue_playing')}
            onClick={onContinue} 
            disabled={adPending} 
          />
          <SecondaryButton onClick={onDeclineContinue} disabled={adPending}>
            {t('game.no')}
          </SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="gameOverOverlay" role="dialog" aria-modal="true" aria-label="Game Summary">
      <div className="gameOverCard">
        <ScoreCard 
          displayScore={displayScore} 
          canDoubleScore={canDoubleScore} 
        />
        <RewardAdButton 
          label={t('game.double_score')}
          onClick={onDoubleScore} 
          disabled={!canDoubleScore || adPending} 
        />
        <SecondaryButton onClick={onEndGame} disabled={adPending}>
          {t('game.end_game')}
        </SecondaryButton>
      </div>
    </div>
  );
}

