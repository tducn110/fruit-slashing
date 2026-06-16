export interface Run {
  id: string;
  player: string;
  score: number;
  date: string;
  combo: number;
}

export const MOCK_LEADERBOARD: Run[] = [
  { id: "1", player: "Lạc Lạc",   score: 482, date: "Hôm nay",  combo: 18 },
  { id: "2", player: "Mèo Phở",   score: 391, date: "Hôm nay",  combo: 14 },
  { id: "3", player: "Bống",       score: 357, date: "Hôm qua",  combo: 12 },
  { id: "4", player: "Cu Tí",      score: 304, date: "2 ngày",   combo: 11 },
  { id: "5", player: "Hạt Dẻ",     score: 261, date: "3 ngày",   combo: 9  },
];

export const DASHBOARD_CONTENT = {
  tag: "DASHBOARD",
  title: "Bảng điểm & Thành tích",
  desc: "Theo dõi điểm cao nhất, lịch sử lượt chơi và xếp hạng cùng cả Bộ Lạc.",
  emptyHistoryUser: "Chưa có lượt chơi nào. Bấm Chơi ngay để bắt đầu!",
  emptyHistoryGuest: "Đăng nhập để lưu điểm và xem lại lịch sử chơi.",
};
