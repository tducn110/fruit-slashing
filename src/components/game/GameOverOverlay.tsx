import { Clapperboard } from "lucide-react";
import { AdDoubleScoreButton } from "./AdDoubleScoreButton";

interface GameOverOverlayProps {
  finalScore: number | null;
  displayScore: number | null;
  running: boolean;
  countdown: number | null;
  mode: "continue" | "summary";
  canContinue: boolean;
  canDoubleScore: boolean;
  onContinue: () => void;
  onDeclineContinue: () => void;
  onDoubleScore: () => void;
  onEndGame: () => void;
}

export function GameOverOverlay({
  finalScore,
  displayScore,
  running,
  countdown,
  mode,
  canContinue,
  canDoubleScore,
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
          <div className="scoreCard scoreCard-continue">
            <div className="scoreLabel">Tiếp tục?</div>
            <div className="scoreMeta">Bạn muốn hồi lại 3 máu để chơi tiếp hay chốt điểm hiện tại?</div>
          </div>

          <div className="gameOverChoiceRow">
            <button type="button" className="continueChoiceButton is-primary" onClick={onContinue}>
              <Clapperboard size={18} strokeWidth={2.6} />
              Tiếp tục chơi
            </button>
            <button type="button" className="continueChoiceButton" onClick={onDeclineContinue}>
              Không
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gameOverOverlay">
      <div className="gameOverCard">
        <div className="scoreCard">
          <div className="scoreLabel">Điểm số</div>
          <div className="scoreValue">{displayScore.toLocaleString("vi-VN")} điểm</div>
          <div className="scoreMeta">
            {canDoubleScore ? "Chọn nhân đôi điểm hoặc kết thúc game." : "Điểm đã được nhân đôi. Chọn kết thúc game."}
          </div>
        </div>

        <AdDoubleScoreButton score={finalScore} onClick={onDoubleScore} disabled={!canDoubleScore} />

        <button type="button" onClick={onEndGame} className="endGameButton">
          Kết thúc game
        </button>
      </div>
    </div>
  );
}
