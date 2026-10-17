export default async function handler(req, res) {
  const url1 = "https://tinyurl.com/vietxiaomi";
  const url2 = "https://thtt.pages.dev/tttt.m3u";

  try {
    // 1. Kéo dữ liệu đồng thời cả 3 nguồn
    const [res1, res2, xoicheRes] = await Promise.all([
      fetch(url1),
      fetch(url2),
      fetch("https://xoiche.live", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      }).catch(() => null)
    ]);

    const text1 = await res1.text();
    const text2 = await res2.text();

    const hotMatchesArray = []; // Mảng chứa các item trận hot để sắp xếp thời gian
    const normalChannelsList = [];

    // Danh sách từ khóa các Giải đấu lớn & Đội bóng lớn để lọc trận HOT
    const HOT_LEAGUES_AND_TEAMS = [
      "PREMIER LEAGUE", "NGOẠI HẠNG ANH", "CHAMPIONS LEAGUE", "CÚP C1", 
      "EUROPA LEAGUE", "CÚP C2", "LA LIGA", "SERIE A", "BUNDESLIGA", "LIGUE 1", 
      "V-LEAGUE", "V.LEAGUE", "WORLD CUP", "EURO", "ASIAN CUP", "AFF CUP", "ASEAN CUP",
      "MANCHESTER UNITED", "MAN UTD", "MU", "MANCHESTER CITY", "MAN CITY", "LIVERPOOL", 
      "ARSENAL", "CHELSEA", "REAL MADRID", "BARCELONA", "BARCA", "BAYERN", "PSG", 
      "JUVENTUS", "INTER", "AC MILAN", "ROMA", "ATLETICO", "DORTMUND"
    ];

    // Danh sách tên nhóm hot ở Nguồn 2 (THTT)
    const HOT_THTT_GROUPS = ["Vua Sân Cỏ TV", "Vua Sân Cỏ", "Giờ Vàng TV", "Giờ Vàng", "Gio Vang", "S8 TV", "S8"];

    function isMatchHot(text) {
      if (!text) return false;
      const upperText = text.toUpperCase();
      return HOT_LEAGUES_AND_TEAMS.some(keyword => {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
        return regex.test(upperText);
      });
    }

    // Helper trích xuất thời gian để sắp xếp
    function extractTimeString(text) {
      const timeMatch = text.match(/\[(\d{1,2}:\d{2})\s*-\s*(\d{1,2})\/(\d{1,2})\]/) || 
                        text.match(/\[(\d{1,2}:\d{2})\s*-\s*(\d{1,2})\/(\d{1,2})\/\d{2,4}\]/) ||
                        text.match(/\[(\d{1,2}:\d{2})\]/);
      if (timeMatch) {
        return timeMatch[1];
      }
      return "00:00";
    }

    // NGUỒN 1 (Vietxiaomi)
    if (text1) {
      const lines = text1.split('\n');
      let currentInf = "";
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith('#EXTINF:')) {
          currentInf = line;
        } else if (line && !line.startsWith('#') && currentInf) {
          normalChannelsList.push(`${currentInf}\n${line}`);
          currentInf = "";
        }
      }
    }

    // NGUỒN 2 (THTT)
    if (text2) {
      const lines = text2.split('\n');
      let currentInf = "";
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith('#EXTINF:')) {
          currentInf = line;
        } else if (line && !line.startsWith('#') && currentInf) {
          let streamUrl = line;
          normalChannelsList.push(`${currentInf}\n${streamUrl}`);

          // Kiểm tra điều kiện trận Hot từ THTT
          const isInHotGroup = HOT_THTT_GROUPS.some(grp => currentInf.toLowerCase().includes(grp.toLowerCase()));
          if (isInHotGroup && isMatchHot(currentInf)) {
            let modifiedInf = currentInf
              .replace(/group-title="[^"]*"/gi, 'group-title="🔥 TRẬN TÂM ĐIỂM"')
              .replace(/,\s*(.*)$/, ', 🔥 [TÂM ĐIỂM] $1');
            
            hotMatchesArray.push({
              timeSort: extractTimeString(currentInf),
              entry: `${modifiedInf}\n${streamUrl}`
            });
          }
          currentInf = "";
        }
      }
    }

    // NGUỒN XOICHE.LIVE
    if (xoicheRes && xoicheRes.ok) {
      const html = await xoicheRes.text();
      
      const blvStreamMap = {
        "Xôi Gà": "https://live.khoga.space/live/livehub2/index.m3u8",
        "Xôi Gấc": "https://live.khoga.space/live/livehub11/index.m3u8",
        "Xôi Bắp": "https://live.khoga.space/live/livehub6/index.m3u8",
        "Xôi Xoài": "https://live.khoga.space/live/livehub3/index.m3u8",
        "Khô Cay": "https://live.khoga.space/live/livehub9/index.m3u8",
        "Khô Mật": "https://live.khoga.space/live/livehub13/index.m3u8",
        "Khô Chè": "https://live.khoga.space/live/livehub5/index.m3u8",
        "Khô Bò": "https://live.khoga.space/live/livehub12/index.m3u8",
        "Tam Mao": "https://live.khoga.space/live/livehub8/index.m3u8",
        "Tày": "https://live.khoga.space/live/livehub10/index.m3u8",
        "Gà Rừng": "https://livecdn.cdnfastter.xyz/live/livehub4/index.m3u8",
        "Pháo Thủ": "https://luong.phaohoa.live/live/phaohoa4/index.m3u8",
        "KaKa": "https://luong.phaohoa.live/live/phaohoa7/index.m3u8",
        "Tiểu Mây": "https://luong.phaohoa.live/live/phaohoa9/index.m3u8",
        "Văn Minh": "https://luong.phaohoa.live/live/phaohoa3/index.m3u8",
        "Người Kiến": "https://luong.phaohoa.live/live/phaohoa1/index.m3u8",
        "Famy": "https://luong.phaohoa.live/live/phaohoa6/index.m3u8",
        "Chim Nhỏ": "https://luong.phaohoa.live/live/phaohoa5/index.m3u8",
        "Văn Tài": "https://live.xoiche.tv/hls/vantai/index.m3u8",
        "Lee Sin": "https://luong.phaohoa.live/live/phaohoa10/index.m3u8",
        "Enzo": "https://luong.phaohoa.live/live/phaohoa2/index.m3u8",
        "Kền Kền": "https://luong.phaohoa.live/live/phaohoa6/index.m3u8",
        "Táo Dai": "https://livecdn.cdnfastter.xyz/live/livehub1/index.m3u8",
        "Gà": "https://livecdn.cdnfastter.xyz/live/livehub4/index.m3u8",
        "Pháo": "https://luong.phaohoa.live/live/phaohoa4/index.m3u8"
      };

      const leagueLogoMap = {
        "PREMIER LEAGUE": "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg",
        "NGOẠI HẠNG ANH": "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg",
        "LA LIGA": "https://upload.wikimedia.org/wikipedia/commons/5/54/LaLiga_logo_2023.svg",
        "SERIE A": "https://upload.wikimedia.org/wikipedia/commons/e/e1/Serie_A_logo_%282019%29.svg",
        "BUNDESLIGA": "https://upload.wikimedia.org/wikipedia/en/d/df/Bundesliga_logo_%282017%29.svg",
        "LIGUE 1": "https://upload.wikimedia.org/wikipedia/commons/1/1e/Ligue_1_%28logo%29.svg",
        "CHAMPIONS LEAGUE": "https://upload.wikimedia.org/wikipedia/en/f/f3/UEFA_Champions_League_logo_2.svg",
        "CÚP C1": "https://upload.wikimedia.org/wikipedia/en/f/f3/UEFA_Champions_League_logo_2.svg",
        "EUROPA LEAGUE": "https://upload.wikimedia.org/wikipedia/en/5/5f/UEFA_Europa_League_logo_2021.svg",
        "V-LEAGUE": "
