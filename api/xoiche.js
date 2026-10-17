export default async function handler(req, res) {
  // Tối ưu Cache: Phản hồi tức thì trong 1 giờ, tự động cập nhật ngầm để app IPTV không bị timeout
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const xoicheDomains = ["https://xoiche.tv", "https://xoiche1.live", "https://xoiche.live"];

  async function fetchWithTimeout(resource, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(resource, {
        redirect: 'follow',
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      return null;
    }
  }

  try {
    let xoicheRes = null;
    let activeDomain = "https://xoiche.tv";
    
    // Tự động quét qua các domain dự phòng của Xôi Chè
    for (const domain of xoicheDomains) {
      const resFetch = await fetchWithTimeout(domain, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      }, 5000);

      if (resFetch && resFetch.ok) {
        xoicheRes = resFetch;
        activeDomain = domain;
        break;
      }
    }

    if (!xoicheRes || !xoicheRes.ok) {
      return res.status(200).send("#EXTM3U\n#EXTINF:-1 group-title=\"Xôi Chè\", ⚠️ Không thể kết nối đến nguồn Xôi Chè\nhttps://live.khoga.space/live/livehub2/index.m3u8");
    }

    const html = await xoicheRes.text().catch(() => "");
    if (!html) {
      return res.status(200).send("#EXTM3U\n#EXTINF:-1 group-title=\"Xôi Chè\", ⚠️ Nội dung HTML trả về trống\nhttps://live.khoga.space/live/livehub2/index.m3u8");
    }

    // Tự động lấy logo trang web từ HTML
    let mainSiteLogo = "https://cdn-icons-png.flaticon.com/512/8112/8112602.png";
    const logoMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*logo/i) || html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (logoMatch && logoMatch[1] && !logoMatch[1].includes('svg')) {
      const src = logoMatch[1];
      mainSiteLogo = src.startsWith('http') ? src : activeDomain + (src.startsWith('/') ? '' : '/') + src;
    }

    // Từ điển BLV cập nhật mới nhất của bạn
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
      "PREMIER LEAGUE", "NGOẠI HẠNG ANH", 
      "LA LIGA", "SERIE A", "BUNDESLIGA", "LIGUE 1", "CHAMPIONS LEAGUE", "CÚP C1", 
      "EUROPA LEAGUE", "CÚP C2", "CONFERENCE LEAGUE", "CÚP C3", "CÚP C4", "AFC CHAMPIONS LEAGUE", 
      "AFC CUP", "FA CUP", "CARABAO CUP", "CÚP NHÀ VUA", "COPPA ITALIA", "MLS", "SAUDI PRO LEAGUE", 
      "WORLD CUP", "FIFA WORLD CUP", "COPPA AMERICA", "EURO", "SIÊU CÚP", "SUPER CUP",
      "CÚP LIÊN ĐOÀN", "CUP LIÊN ĐOÀN", "HẠNG NHẤT ANH", "CHAMPIONSHIP", "LIGUE 2", "SERIE B",
      "BUNDESLIGA 2", "LA LIGA 2", "J-LEAGUE", "K-LEAGUE", "THAI LEAGUE",
      "SPA D1", "SPA D2", "SPA D3", "ENG PR", "ENG CH", "ENG D1", "ENG D2", "ITA A", "ITA B", "GER 1", "GER 2", "FRA 1", "FRA 2"
    ];

    function ultraClean(str) {
      if (!str) return "";
      return str
        .replace(/[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, ' ')
        .replace(/^[^a-zA-Z0-9À-ỹ]+/g, '')
        .replace(/[^a-zA-Z0-9À-ỹ]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function extractCleanTeam(teamStr) {
      if (!teamStr) return "";
      let clean = ultraClean(teamStr);
      clean = clean.replace(/^[W|M]\s+/i, '');
      clean = clean.replace(/^(two|one|three|four|five|six|seven|eight|nine|ten)\b/gi, '');
      clean = clean.replace(/^\d{1,2}[:\-]?\d{0,2}\s*/g, '');
      clean = clean.replace(/\b(SPA\s*D[1-3]|ENG\s*(D[1-4]|Ch|PR)|ITA\s*[A-C]|GER\s*[1-3]|FRA\s*[1-3]|POR\s*[1-2]|ARG\s*D[1-2]|BRA\s*D[1-2]|MEX\s*D[1-2]|USA\s*MLS)\b/gi, ' ');
      clean = clean.replace(/\b(Elite|UEFA|AFC|V[\.\-]League\s*\d*|J\d\s*League|SV\.League(\s+Nhật\s+Bản)?|Sultanlar\s+Ligi(\s+Nữ)?|Serie\s+A1(\s+Ý)?|Africa Cup of Nations(\s+Qualification|\s+Qualifiers)?|AFCON(\s+Qualification|\s+Qualifiers)?|World Cup(\s+Qualification|\s+Qualifiers)?|WC\s+(Qualifiers|Qualification)|UEFA Euro(\s+Qualification|\s+Qualifiers)?|Euro\s+Qualification|UEFA Nations League|Nations League|Asian Cup(\s+Qualification)?|Cúp Vùng Vịnh|Cup Vùng Vịnh|Gulf Cup|Cúp Quốc Gia|Cup Quốc Gia)\b/gi, ' ');
      
      const sortedLeagues = [...KNOWN_LEAGUES].sort((x, y) => y.length - x.length);
      for (let lg of sortedLeagues) {
        let regexLg = new RegExp(`^${lg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, "ig");
        clean = clean.replace(regexLg, '');
      }
      return ultraClean(clean);
    }

    const matchDict = {};
    const linkRegex = /<a\s+[^>]*href=["']([^"']*(?:\/tran-dau\/|\/truc-tiep\/|\/live\/|\/xem\/)[^"']*)["'][^>]*>(.*?)<\/a>/gis;
    let match;
    const sortedBlvs = Object.keys(blvStreamMap).sort((x, y) => y.length - x.length);
    const sortedLeagues = [...KNOWN_LEAGUES].sort((x, y) => y.length - x.length);

    while ((match = linkRegex.exec(html)) !== null) {
      let href = match[1];
      let innerHtml = match[2];
      let rawText = innerHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!rawText || rawText.length < 5) continue;

      const isMatch = /VS|vs|Trực tiếp|Sắp diễn ra|\b\d{1,3}'|\b\d{1,2}\s*[:\-]\s*\d{1,2}\b/i.test(rawText);
      if (!isMatch) continue;

      let text = rawText.replace(/&#39;/g, "'").replace(/&amp;/g, "&");

      let timeStr = "", dateStr = "";
      const timeMatch = text.match(/\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/);
      if (timeMatch) { 
        timeStr = timeMatch[0]; 
        text = text.replace(timeStr, ' '); 
      }
      const dateMatch = text.match(/\b(\d{1,2})[/-\s](\d{1,2})\b/);
      if (dateMatch) { 
        dateStr = `${dateMatch[1]}/${dateMatch[2]}`; 
        text = text.replace(dateMatch[0], ' '); 
      }
      text = text.replace(/\b202\d\b/g, ' '); 

      if (text.includes('/')) {
        let partsSlash = text.split('/');
        let lastPart = partsSlash[partsSlash.length - 1];
        if (/VS|vs/i.test(lastPart)) {
          text = lastPart;
        }
      }

      text = text.replace(/\b\d{1,2}\s*[:\-]\s*\d{1,2}\b/g, ' VS ');
      text = text.replace(/\s+-\s+/g, ' VS ').replace(/\bvs\b/gi, ' VS ');
      text = text.replace(/\b\d{1,3}(\+\d+)?'/g, ' ');
      text = text.replace(/Trực tiếp|Trực Tiếp|Đang đá|Đang live|\bLIVE\b|Sắp diễn ra/ig, ' ');

      if (!text.includes("VS")) continue;

      for (let lg of sortedLeagues) {
        let regexLg = new RegExp(`\\b${lg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "ig");
        text = text.replace(regexLg, ' ');
      }

      let foundBlvs = [];
      for (let blv of sortedBlvs) {
        let escapeBlv = blv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let regex = new RegExp(`(BLV\\s*\\-\\s*)?(${escapeBlv})`, "gi");
        if (regex.test(text)) {
          let stdName = (blv === "Gà") ? "Gà Rừng" : (blv === "Pháo") ? "Pháo Thủ" : blv;
          if (!foundBlvs.includes(stdName)) foundBlvs.push(stdName);
          text = text.replace(regex, ' '); 
        }
      }

      const garbageWords = [
        "Nghỉ giữa hiệp", "Nghỉ giữa trận", "Đang diễn ra", "Đang đá", 
        "Hiệp 1", "Hiệp 2", "HT", "FT", "CƯỢC", "FB88", "8Xbet", 
        "SV368", "Nhà đài", "Tất cả", "Trận hot", "BLV"
      ];
      for (let g of garbageWords) {
        text = text.replace(new RegExp(`(^|\\s)${g}(\\s|$)`, "ig"), ' ');
      }
      
      text = text.replace(/[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, ' ');
      text = text.replace(/\s+/g, ' ').trim();

      let parts = text.split('VS').map(p => ultraClean(p)).filter(p => p.length > 0);
      let team1 = "", team2 = "";

      if (parts.length >= 2) { 
        team1 = extractCleanTeam(parts[0]); 
        team2 = extractCleanTeam(parts[1]); 
      } else { 
        continue; 
      }
      if (!team1 || !team2) continue; 

      let timeDateDisplay = timeStr;
      if (timeStr && dateStr) timeDateDisplay = `${timeStr} - ${dateStr}`;
      else if (!timeStr && dateStr) timeDateDisplay = dateStr;

      const formattedTeams = `${team1} VS ${team2}`;
      const dictKey = `${team1} VS ${team2} - ${timeDateDisplay}`;
      const fullUrl = href.startsWith('http') ? href : (href.startsWith('/') ? activeDomain + href : activeDomain + '/' + href);

      if (!matchDict[dictKey]) {
        matchDict[dictKey] = { 
          timeDate: timeDateDisplay, teams: formattedTeams,
          blvs: foundBlvs, fallbackUrl: fullUrl 
        };
      } else {
        for (let b of foundBlvs) {
          if (!matchDict[dictKey].blvs.includes(b)) matchDict[dictKey].blvs.push(b);
        }
      }
    }

    const results = [];
    const seenKeys = new Set();
    const vlcOpt = "#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

    const now = new Date();
    const defaultDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (let key in matchDict) {
      const data = matchDict[key];
      const timeStr = data.timeDate ? `[${data.timeDate}] ` : "";
      
      const dateMatch = data.timeDate ? data.timeDate.match(/\b\d{1,2}\/\d{1,2}\b/) : null;
      const matchDate = dateMatch ? dateMatch[0] : defaultDate;
      const groupTitle = `🔥 Trận Tâm Điểm ${matchDate}`;

      if (data.blvs.length > 0) {
        data.blvs.forEach(blv => {
          const streamUrl = blvStreamMap[blv] || data.fallbackUrl;
          const uniqueKey = `${key}_${streamUrl}`;
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            results.push(`#EXTINF:-1 group-title="${groupTitle}" tvg-logo="${mainSiteLogo}", ${timeStr}${data.teams} (BLV ${blv})\n${vlcOpt}\n${streamUrl}`);
          }
        });
      } else {
        const uniqueKey = `${key}_${data.fallbackUrl}`;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          results.push(`#EXTINF:-1 group-title="${groupTitle}" tvg-logo="${mainSiteLogo}", ${timeStr}${data.teams}\n${vlcOpt}\n${data.fallbackUrl}`);
        }
      }
    }

    if (results.length === 0) {
      return res.status(200).send("#EXTM3U\n#EXTINF:-1 group-title=\"Xôi Chè\", ⚠️ Không tìm thấy trận đấu nào\nhttps://live.khoga.space/live/livehub2/index.m3u8");
    }

    res.status(200).send("#EXTM3U\n\n" + results.join("\n\n"));

  } catch (error) {
    res.status(200).send("#EXTM3U\n#EXTINF:-1 group-title=\"Xôi Chè\", ⚠️ Lỗi hệ thống: " + error.message + "\nhttps://live.khoga.space/live/livehub2/index.m3u8");
  }
}
