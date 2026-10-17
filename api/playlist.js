export default async function handler(req, res) {
  const url1 = "https://tinyurl.com/vietxiaomi";
  const url2 = "https://thtt.pages.dev/tttt.m3u";

  try {
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

    let xoichePlaylist = "";

    if (xoicheRes && xoicheRes.ok) {
      const html = await xoicheRes.text();
      
      const blvStreamMap = {
        "KaKa": "https://luong.phaohoa.live/live/phaohoa7/index.m3u8",
        "Tiểu Mây": "https://luong.phaohoa.live/live/phaohoa9/index.m3u8",
        "Văn Minh": "https://luong.phaohoa.live/live/phaohoa3/index.m3u8",
        "Người Kiến": "https://luong.phaohoa.live/live/phaohoa1/index.m3u8",
        "Famy": "https://luong.phaohoa.live/live/phaohoa6/index.m3u8",
        "Pháo Thủ": "https://luong.phaohoa.live/live/phaohoa4/index.m3u8",
        "Pháo": "https://luong.phaohoa.live/live/phaohoa4/index.m3u8",
        "Chim Nhỏ": "https://luong.phaohoa.live/live/phaohoa5/index.m3u8",
        "Văn Tài": "https://live.xoiche.tv/hls/vantai/index.m3u8",
        "Lee Sin": "https://luong.phaohoa.live/live/phaohoa10/index.m3u8",
        "Gà Rừng": "https://livecdn.cdnfastter.xyz/live/livehub4/index.m3u8",
        "Gà": "https://livecdn.cdnfastter.xyz/live/livehub4/index.m3u8",
        "Enzo": "https://luong.phaohoa.live/live/phaohoa2/index.m3u8",
        "Kền Kền": "https://luong.phaohoa.live/live/phaohoa6/index.m3u8",
        "Táo Dai": "https://livecdn.cdnfastter.xyz/live/livehub1/index.m3u8",
        "Xôi Gấc": "https://live.khoga.space/live/livehub11/index.m3u8",
        "Tam Mao": "https://live.khoga.space/live/livehub8/index.m3u8",
        "Khô Cay": "https://live.khoga.space/live/livehub9/index.m3u8",
        "Xôi Bắp": "https://live.khoga.space/live/livehub6/index.m3u8",
        "Tày": "https://live.khoga.space/live/livehub10/index.m3u8",
        "Khô Mật": "https://live.khoga.space/live/livehub13/index.m3u8",
        "Khô Chè": "https://live.khoga.space/live/livehub5/index.m3u8",
        "Khô Bò": "https://live.khoga.space/live/livehub12/index.m3u8",
        "Xôi Gà": "https://live.khoga.space/live/livehub2/index.m3u8",
        "Xôi Xoài": "https://live.khoga.space/live/livehub3/index.m3u8"
      };

      const KNOWN_LEAGUES = [
        "ELITE", "ACL ELITE", "UEFA", "AFC", "J1 LEAGUE", "SV.LEAGUE NHẬT BẢN", "SV.LEAGUE", 
        "SULTANLAR LIGI NỮ", "SULTANLAR LIGI", "SERIE A1 Ý", "SERIE A1", 
        "AFRICA CUP OF NATIONS QUALIFICATION", "AFRICA CUP OF NATIONS QUALIFIERS", 
        "AFRICA CUP OF NATIONS", "AFCON QUALIFICATION", "AFCON QUALIFIERS", "AFCON",
        "WORLD CUP QUALIFICATION", "WORLD CUP QUALIFIERS", "WC QUALIFICATION", "WC QUALIFIERS",
        "UEFA EURO QUALIFICATION", "EURO QUALIFICATION", "UEFA NATIONS LEAGUE", "NATIONS LEAGUE",
        "CÚP VÙNG VỊNH", "CUP VÙNG VỊNH", "GULF CUP", "CÚP QUỐC GIA", "CUP QUỐC GIA", "NATIONAL CUP",
        "ASIAD WOMEN", "ASIAD U23", "ASIAD", "ASIAN GAMES", "FF ASEAN CUP", "ASEAN CUP", "AFF CUP",
        "GIAO HỮU QT", "GIAO HỮU QUỐC TẾ", "GIAO HỮU CLB", "GIAO HỮU", "CLUB FRIENDLIES", "FRIENDLY",
        "V-LEAGUE 1", "V-LEAGUE 2", "V-LEAGUE", "V.LEAGUE 1", "V.LEAGUE 2", "V.LEAGUE",
        "PREMIER LEAGUE", "NGOẠI HẠNG ANH", "LA LIGA", "SERIE A", "BUNDESLIGA", "LIGUE 1", 
        "CHAMPIONS LEAGUE", "CÚP C1", "EUROPA LEAGUE", "CÚP C2", "CONFERENCE LEAGUE", "CÚP C3", 
        "CÚP C4", "AFC CHAMPIONS LEAGUE", "AFC CUP", "FA CUP", "CARABAO CUP", "CÚP NHÀ VUA", 
        "COPPA ITALIA", "MLS", "SAUDI PRO LEAGUE", "WORLD CUP", "FIFA WORLD CUP", "COPPA AMERICA", 
        "EURO", "SIÊU CÚP", "SUPER CUP", "CÚP LIÊN ĐOÀN", "CUP LIÊN ĐOÀN", "HẠNG NHẤT ANH", 
        "CHAMPIONSHIP", "LIGUE 2", "SERIE B", "BUNDESLIGA 2", "LA LIGA 2", "J-LEAGUE", "K-LEAGUE", 
        "THAI LEAGUE", "EFELER LIGI THỔ NHĨ KỲ", "EFELER LIGI"
      ];

      // Lấy logo chuẩn của xoiche làm logo group
      let mainSiteLogo = "https://xoiche.live/favicon.ico";
      const logoMatch = html.match(/<img[^>]+src=["']([^"']+\.(png|ico|jpg|webp))["'][^>]*>/i);
      if (logoMatch && logoMatch[1]) {
        let src = logoMatch[1];
        mainSiteLogo = src.startsWith('http') ? src : "https://xoiche.live" + (src.startsWith('/') ? '' : '/') + src;
      }

      const linkRegex = /<a\s+[^>]*href=["']([^"']*(?:\/tran-dau\/|\/truc-tiep\/|\/live\/|\/xem\/)[^"']*)["'][^>]*>(.*?)<\/a>/gis;
      let match;
      const matchDict = {};

      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        let innerHtml = match[2];
        let rawText = innerHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!rawText || rawText.length < 5) continue;

        const isMatch = /VS|vs|Trực tiếp|Sắp diễn ra|\b\d{1,3}'|\b\d{1,2}\s*[:\-]\s*\d{1,2}\b/i.test(rawText);
        if (!isMatch) continue;

        // Xóa mã HTML entities thừa như &#39;
        rawText = rawText.replace(/&#39;/g, "'").replace(/&amp;/g, "&");

        let timeStr = "", dateStr = "";
        const timeMatch = rawText.match(/\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/);
        if (timeMatch) {
          timeStr = timeMatch[0];
          rawText = rawText.replace(timeStr, ' ');
        }
        const dateMatch = rawText.match(/\b(\d{1,2})[/-\s](\d{1,2})\b/);
        if (dateMatch) {
          dateStr = `${dateMatch[1]}/${dateMatch[2]}`;
          rawText = rawText.replace(dateMatch[0], ' ');
        }
        rawText = rawText.replace(/\b202\d\b/g, ' ');
        rawText = rawText.replace(/\b\d{1,2}\s*[:\-]\s*\d{1,2}\b/g, ' VS ');
        rawText = rawText.replace(/\s+-\s+/g, ' VS ').replace(/\bvs\b/gi, ' VS ');
        
        // Xóa các ký tự phút trận đấu kiểu như "82'" hoặc số phút linh tinh
        rawText = rawText.replace(/\b\d{1,3}'/g, ' ');
        rawText = rawText.replace(/Trực tiếp|Trực Tiếp|Đang đá|Đang live|\bLIVE\b|Sắp diễn ra/ig, ' ');

        // Xóa tên các giải đấu ra khỏi chuỗi text
        const sortedLeagues = KNOWN_LEAGUES.sort((x, y) => y.length - x.length);
        for (let lg of sortedLeagues) {
          let regexLg = new RegExp(`\\b${lg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "ig");
          rawText = rawText.replace(regexLg, ' ');
        }

        if (!rawText.includes("VS")) continue;

        let foundBlvs = [];
        for (let blv in blvStreamMap) {
          let escapeBlv = blv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          let regex = new RegExp(`(BLV\\s*\\-\\s*)?(${escapeBlv})`, "gi");
          if (regex.test(rawText)) {
            let stdName = (blv === "Gà") ? "Gà Rừng" : (blv === "Pháo") ? "Pháo Thủ" : blv;
            if (!foundBlvs.includes(stdName)) foundBlvs.push(stdName);
            rawText = rawText.replace(regex, ' ');
          }
        }

        const garbageWords = ["Nghỉ giữa hiệp", "Nghỉ giữa trận", "Đang diễn ra", "Đang đá", "Hiệp 1", "Hiệp 2", "HT", "FT", "CƯỢC", "FB88", "8Xbet", "SV368", "Nhà đài", "Tất cả", "Trận hot", "BLV"];
        for (let g of garbageWords) {
          rawText = rawText.replace(new RegExp(`(^|\\s)${g}(\\s|$)`, "ig"), ' ');
        }

        rawText = rawText.replace(/\s+/g, ' ').trim();
        let parts = rawText.split('VS').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length < 2) continue;

        let team1 = parts[0];
        let team2 = parts[1];
        if (!team1 || !team2) continue;

        let timeDateDisplay = timeStr;
        if (timeStr && dateStr) timeDateDisplay = `${timeStr} - ${dateStr}`;
        else if (!timeStr && dateStr) timeDateDisplay = dateStr;

        const formattedTeams = `${team1} VS ${team2}`;
        const dictKey = `${team1} VS ${team2} - ${timeDateDisplay}`;
        const fullUrl = href.startsWith('http') ? href : "https://xoiche.live" + (href.startsWith('/') ? '' : '/') + href;

        if (!matchDict[dictKey]) {
          matchDict[dictKey] = {
            timeDate: timeDateDisplay,
            teams: formattedTeams,
            blvs: foundBlvs,
            fallbackUrl: fullUrl
          };
        } else {
          for (let b of foundBlvs) {
            if (!matchDict[dictKey].blvs.includes(b)) matchDict[dictKey].blvs.push(b);
          }
        }
      }

      const results = [];
      const vlcOpt = "#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
      
      // Gộp chung tất cả vào 1 group duy nhất tên là "Xôi Chè"
      const groupTitle = "Xôi Chè";

      for (let key in matchDict) {
        const data = matchDict[key];
        const timeStr = data.timeDate ? `[${data.timeDate}] ` : "";

        if (data.blvs.length > 0) {
          data.blvs.forEach(blv => {
            const streamUrl = blvStreamMap[blv] || data.fallbackUrl;
            results.push(`#EXTINF:-1 group-title="${groupTitle}" tvg-logo="${mainSiteLogo}", ${timeStr}${data.teams} (BLV ${blv})\n${vlcOpt}\n${streamUrl}`);
          });
        } else {
          results.push(`#EXTINF:-1 group-title="${groupTitle}" tvg-logo="${mainSiteLogo}", ${timeStr}${data.teams}\n${vlcOpt}\n${data.fallbackUrl}`);
        }
      }

      if (results.length > 0) {
        xoichePlaylist = "#EXTM3U\n\n" + results.join("\n\n") + "\n\n";
      }
    }

    const combined = xoichePlaylist.trim() + "\n\n" + text1.trim() + "\n\n" + text2.trim();

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(combined);

  } catch (err) {
    res.status(500).send("Lỗi hệ thống: " + err.message);
  }
}
