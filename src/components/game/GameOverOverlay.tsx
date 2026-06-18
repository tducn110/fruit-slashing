interface GameOverOverlayProps {
  finalScore: number | null;
  running: boolean;
  countdown: number | null;
  onReplay: () => void;
}

export function GameOverOverlay({
  finalScore,
  running,
  countdown,
  onReplay,
}: GameOverOverlayProps) {
  if (running || countdown !== null || finalScore === null) return null;

  return (
    <div className="gameOverOverlay">
      <div style={{ textAlign: "center" }}>
        <div className="scoreCard">
          <div className="scoreLabel">Kết thúc</div>
          <div className="scoreValue">{finalScore} điểm</div>
          <div className="scoreMeta">Điểm sẽ được gửi nếu bạn đã đăng nhập.</div>
        </div>
        <button onClick={onReplay} className="replayButton">
          Chơi lại
        </button>
      </div>
    </div>
  );
}
