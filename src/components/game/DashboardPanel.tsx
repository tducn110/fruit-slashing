import { ArrowLeft, Clock3, Trophy } from "lucide-react";
import {
  BADGE_COLORS,
  buildLeaderboardModel,
  getRank,
  type LocalScore,
  type RankedLeaderboardEntry,
} from "../../lib/localScores";
import { PanelFrame } from "../ui/primitives";

interface Props {
  leaderboard: LocalScore[];
  bestScore: number;
  onClose: () => void;
}

export function DashboardPanel({
  leaderboard,
  bestScore,
  onClose,
}: Props) {
  const { topEntries, currentPlayer } = buildLeaderboardModel(leaderboard, "Người chơi");
  const playerInTopTen = topEntries.find((entry) => entry.isLocal) ?? null;
  const playerRow = playerInTopTen ?? currentPlayer;

  return (
    <PanelFrame
      title={(
        <span className="settingsPanelTitle">
          <Trophy size={20} />
          Kỷ lục
        </span>
      )}
      width={380}
      maxHeight="calc(100dvh - 86px)"
      onClose={onClose}
      className="settingsPanel dashboardPanel"
    >
      <div className="dashboardBestCard">
        <div className="dashboardBestLabel">Kỷ lục của bạn</div>
        <div className="dashboardBestScore">{bestScore.toLocaleString("vi-VN")}</div>
        <div className="dashboardBestRank">Danh hiệu: {getRank(bestScore)}</div>
      </div>

      <section className="dashboardRankSection">
        <div className="dashboardRankHeader">
          <span>
            <Trophy size={18} />
            Ranking 1-10
          </span>
          <b>Top điểm</b>
        </div>

        <div className="dashboardRankList">
          {topEntries.map((entry) => (
            <RankingRow key={`${entry.name}-${entry.rank}-${entry.score}`} entry={entry} highlight={entry.isLocal} />
          ))}
        </div>
      </section>

      {playerRow && (
        <section className="dashboardPlayerCard">
          <div className="dashboardPlayerLabel">Bảng xếp hạng của bạn</div>
          <RankingRow entry={playerRow} highlight />
        </section>
      )}
    </PanelFrame>
  );
}

export function LeaderboardScreen({
  leaderboard,
  bestScore,
  onBack,
}: {
  leaderboard: LocalScore[];
  bestScore: number;
  onBack: () => void;
}) {
  const { topEntries, currentPlayer } = buildLeaderboardModel(leaderboard, "Bạn");
  const playerInTopTen = topEntries.find((entry) => entry.isLocal) ?? null;
  const playerRow = playerInTopTen ?? currentPlayer;

  return (
    <main className="leaderboardScreen">
      <section className="leaderboardCard">
        <div className="leaderboardTitle">
          <Trophy size={22} />
          <span>Kỷ lục</span>
        </div>

        <div className="leaderboardBestCard">
          <p className="leaderboardEyebrow">Kỷ lục của bạn</p>
          <h1>{bestScore.toLocaleString("vi-VN")}</h1>
          <span>Danh hiệu: {getRank(bestScore)}</span>
        </div>

        <section className="leaderboardBoard">
          <div className="dashboardRankHeader">
            <span>
              <Trophy size={18} />
              Ranking 1-10
            </span>
            <b>Top điểm</b>
          </div>

          <div className="dashboardRankList leaderboardRankList">
            {topEntries.map((entry) => (
              <RankingRow key={`${entry.name}-${entry.rank}-${entry.score}`} entry={entry} highlight={entry.isLocal} />
            ))}
          </div>
        </section>

        {playerRow && (
          <div className="leaderboardPlayerRow">
            <RankingRow entry={playerRow} highlight />
          </div>
        )}

        <button className="game-btn leaderboardBackBtn" onClick={onBack}>
          <ArrowLeft size={16} />
          Quay lại
        </button>
      </section>
    </main>
  );
}

function RankingRow({
  entry,
  highlight = false,
}: {
  entry: RankedLeaderboardEntry;
  highlight?: boolean;
}) {
  const isTopThree = entry.rank != null && entry.rank <= 3;
  const medal = isTopThree ? BADGE_COLORS[entry.rank! - 1] : null;

  return (
    <div
      className="dashboardRankRow"
      data-highlight={highlight ? "true" : "false"}
      style={{
        background: highlight
          ? "rgba(232,116,50,0.16)"
          : medal
            ? `linear-gradient(90deg, ${medal.bg}30 0%, rgba(255,255,255,0.18) 100%)`
            : "rgba(138,125,101,0.08)",
        borderColor: highlight
          ? "rgba(232,116,50,0.45)"
          : medal
            ? `${medal.border}55`
            : "transparent",
        boxShadow: isTopThree ? "0 2px 0 rgba(255,255,255,0.52) inset" : "none",
      }}
    >
      <div
        className="dashboardRankBadge"
        style={{
          background: medal?.bg ?? "rgba(42,36,24,0.1)",
          borderColor: medal?.border ?? "rgba(42,36,24,0.08)",
          color: medal?.text ?? "var(--pencil-gray)",
        }}
      >
        {entry.rank ? `#${entry.rank}` : "Mới"}
      </div>

      <div className="dashboardRankName">
        <span>{entry.name}</span>
        <small>
          {entry.playTimeSec > 0 && (
            <em>
              <Clock3 size={11} />
              {entry.playTimeSec}s
            </em>
          )}
        </small>
      </div>

      <div className="dashboardRankScore">
        {entry.score > 0 ? entry.score.toLocaleString("vi-VN") : "Chưa có"}
      </div>
    </div>
  );
}
