import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  vi: {
    translation: {
      game: {
        play_now: "Chơi ngay",
        leaderboard: "Bảng điểm",
        best_score: "Điểm cao nhất",
        rank: "Cấp bậc",
        score: "Điểm số",
        points: "điểm",
        top_scores: "Top điểm",
        continue_playing: "Tiếp tục chơi",
        no: "Không",
        double_score: "x2",
        end_game: "Kết thúc game",
        choose_double_or_end: "Chọn nhân đôi điểm hoặc kết thúc game.",
        score_doubled_choose_end: "Điểm đã được nhân đôi. Chọn kết thúc game.",
        login_to_submit: "Không thể gửi điểm: hãy đăng nhập để tham gia bảng xếp hạng.",
        resume: "Tiếp tục",
        mini_game_subtitle: "MINI GAME · BỘ LẠC ĐẬU PHỘNG",
        title_main: "Chém Lạc",
        title_accent: "Vùng Cao",
        description: "Chém đậu phộng, dừa, chuối, thanh long và khế bay lên giữa cánh đồng làng quê. Coi chừng quả bom — một nhát thôi là Lạc Lạc giận đó!",
        player_stats: "Thống kê người chơi",
        records: "Kỷ lục",
        your_record: "Kỷ lục của bạn",
        title: "Danh hiệu:",
        ranking_1_10: "Ranking 1-10",
        your_ranking: "Bảng xếp hạng của bạn",
        go_back: "Quay lại",
        new: "Mới",
        none: "Chưa có",
        restart: "Chơi lại",
        unmute_bgm: "Bật nhạc nền",
        mute_bgm: "Tắt nhạc nền",
        unmute_sfx: "Bật hiệu ứng âm thanh",
        mute_sfx: "Tắt hiệu ứng âm thanh",
        toggle_language: "Chuyển ngôn ngữ",
        brand_name: "Bộ Lạc Đậu Phộng",
        super_rare: "SIÊU HIẾM!",
        combo: "COMBO",
        critical: "CRITICAL",
        ranks: {
          legend: "Huyền Thoại",
          king: "Vua Chém",
          master: "Cao Thủ",
          apprentice: "Tập Sự",
          newbie: "Mầm Non"
        }
      },
      errors: {
        bridge_ready_timeout: "Không thể khởi tạo kết nối với Wink.",
        protocol_mismatch: "Phiên bản giao thức Wink không tương thích.",
        runtime_config_invalid: "Cấu hình mini-game không hợp lệ.",
        session_create_failed: "Không thể tạo phiên chơi.",
        session_renewal_failed: "Không thể gia hạn phiên chơi.",
        capability_denied: "Thao tác này không được cấp quyền cho phiên hiện tại.",
        api_network_error: "Không thể kết nối dịch vụ Wink.",
        message_rejected: "Thông điệp từ Wink không hợp lệ.",
        invalid_score: "Điểm số cuối không hợp lệ.",
        invalid_round: "Mã vòng chơi không hợp lệ."
      }
    }
  },
  en: {
    translation: {
      game: {
        play_now: "Play Now",
        leaderboard: "Leaderboard",
        best_score: "Best Score",
        rank: "Rank",
        score: "Score",
        points: "pts",
        top_scores: "Top Scores",
        continue_playing: "Continue",
        no: "No",
        double_score: "x2",
        end_game: "End Game",
        choose_double_or_end: "Choose double score or end game.",
        score_doubled_choose_end: "Score has been doubled. Choose end game.",
        login_to_submit: "Cannot submit score: please login to join the leaderboard.",
        resume: "Resume",
        mini_game_subtitle: "MINI GAME · PEANUT TRIBE",
        title_main: "Slash Peanut",
        title_accent: "Highlands",
        description: "Slash peanuts, coconuts, bananas, dragon fruits and starfruits flying up in the countryside. Watch out for bombs — one slash and Lac Lac will get angry!",
        player_stats: "Player Stats",
        records: "Records",
        your_record: "Your Record",
        title: "Title:",
        ranking_1_10: "Ranking 1-10",
        your_ranking: "Your Ranking",
        go_back: "Go Back",
        new: "New",
        none: "None",
        restart: "Play again",
        unmute_bgm: "Unmute background music",
        mute_bgm: "Mute background music",
        unmute_sfx: "Unmute sound effects",
        mute_sfx: "Mute sound effects",
        toggle_language: "Toggle language",
        brand_name: "Peanut Tribe",
        super_rare: "SUPER RARE!",
        combo: "COMBO",
        critical: "CRITICAL",
        ranks: {
          legend: "Legend",
          king: "Slash King",
          master: "Master",
          apprentice: "Apprentice",
          newbie: "Newbie"
        }
      },
      errors: {
        bridge_ready_timeout: "Failed to initialize Wink connection.",
        protocol_mismatch: "Incompatible Wink protocol version.",
        runtime_config_invalid: "Invalid mini-game config.",
        session_create_failed: "Failed to create session.",
        session_renewal_failed: "Failed to renew session.",
        capability_denied: "Action not permitted for current session.",
        api_network_error: "Failed to connect to Wink service.",
        message_rejected: "Invalid message from Wink.",
        invalid_score: "Invalid final score.",
        invalid_round: "Invalid round ID."
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "vi", // Default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

export default i18n;
