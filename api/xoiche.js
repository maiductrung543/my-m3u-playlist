export default async function handler(req, res) {
  // Luôn đặt Header trả về M3U chuẩn
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  async function fetchWithTimeout(resource, options = {}, timeoutMs = 6000) {
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
    // Thử fetch qua 2 domain dự phòng của Xôi Chè
    const domains = ["https://xoiche.tv", "https://xoiche1.live"];
    let xoicheRes = null;

    for (const domain of domains) {
      const resFetch = await fetchWithTimeout(domain, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      }, 5000);

      if (resFetch && resFetch.ok) {
        xoicheRes = resFetch;
        break;
      }
    }

    if (!xoicheRes) {
      // Trả về playlist thông báo thay vì ngắt kết nối
      const fallbackM3u = `#EXTM3U\n#EXTINF:-1 group-title="Xôi Chè", ⚠️ Nguồn Xôi Chè đang bảo trì / bị chặn IP\nhttps://live.khoga.space/live/livehub2/index.m3u8`;
      return res.status(200).send(fallbackM3u);
    }

    const html = await xoicheRes.text().catch(() => "");
    if (!html) {
      const fallbackM3u = `#EXTINF:-1 group-title="Xôi Chè", ⚠️ Không lấy được danh sách trận đấu\nhttps://live.khoga.space/live/livehub2/index.m3u8`;
      return res.status(200).send("#EXTM3U\n" + fallbackM3u);
    }

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
      "V-LEAGUE": "https://upload.wikimedia.org/wikipedia/vi/thumb/2/25/V.League_1_logo_%282023%29.svg/256px-V.League_1_logo_%282023%29.svg.png"
    };

    const KNOWN_LEAGUES = [
      "PREMIER LEAGUE", "NGOẠI HẠNG ANH", "LA LIGA", "SERIE A", "BUNDESLIGA", "LIGUE 1", 
      "CHAMPIONS LEAGUE", "CÚP C1", "EUROPA LEAGUE", "CÚP C2", "CONFERENCE LEAGUE", 
      "V-LEAGUE 1", "V-LEAGUE", "V.LEAGUE 1", "V.LEAGUE", "FA CUP", "CARABAO CUP", 
      "COPPA ITALIA", "CÚP NHÀ VUA", "SAUDI PRO LEAGUE", "MLS", "J-LEAGUE", "K-LEAGUE",
      "EFELER LIGI", "VOLLEYBALL", "BÓNG CHUYỀN", "BÓNG RỔ", "NBA"
    ];

    function ultraClean(str) {
      if (!str) return "";
      return str
        .replace(/&#39;/g, "'").replace(/&amp;/g, "&")
        .replace(/[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, ' ')
        .replace(/^[^a-zA-Z0-9À-ỹ]+/g, '')
        .replace(/[^a-zA-Z0-9À-ỹ]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function extractCleanTeam(teamStr) {
      if (!teamStr) return "";
      let clean = ultraClean(teamStr);

      const garbagePrefixes = [
        /^(W|M|Nam|Nữ)\s+/i,
        /^\d{1,2}[:\-]?\d{0,2}\s*/g,
        /^(VĐQG|Cúp|Cup|Giải|Bóng chuyền|Bóng rổ|Thổ Nhĩ Kỳ|Ý|Anh|Pháp|Đức|Tây Ban Nha)\s+/i
      ];
      
      garbagePrefixes.forEach(rgx => {
        clean = clean.replace(rgx, '');
      });

      const sortedLeagues = [...KNOWN_LEAGUES].sort((a, b) => b.length - a.length);
      for (let lg of sortedLeagues) {
        let regexLg = new RegExp(`^${lg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[/\\-]?\\s*`, "ig");
        clean = clean.replace(regexLg, '');
      }

      return ultraClean(clean);
    }

    const defaultSportLogo = "https://cdn-icons-png.flaticon.com/512/53/53283.png";
    const linkRegex = /<a\s+[^>]*href=["']([^"']*(?:\/tran-dau\/|\/truc-tiep\/|\/live\/|\/xem\/)[^"']*)["'][^>]*>(.*?)<\/a>/gis;
    let match;
    const matchDict = {};
    const sortedBlvKeys = Object.keys(blvStreamMap).sort((a, b) => b.length - a.length);

    while ((match = linkRegex.exec(html)) !== null) {
      let href = match[1];
      let innerHtml = match[2];
      let rawText = innerHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!rawText || rawText.length < 5) continue;

      const isMatch = /VS|vs|Trực tiếp|Sắp diễn ra|\b\d{1,3}'|\b\d{1,2}\s*[:\-]\s*\d{1,2}\b/i.test(rawText);
      if (!isMatch) continue;

      rawText = rawText.replace(/&#39;/g, "'").replace(/&amp;/g, "&");

      let detectedLeague = "";
      const sortedLeagues = [...KNOWN_LEAGUES].sort((a, b) => b.length - a.length);
      for (let lg of sortedLeagues) {
        let regexLg = new RegExp(`\\b${lg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "ig");
        if (regexLg.test(rawText)) {
          detectedLeague = lg.toUpperCase();
          break;
        }
      }

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
      rawText = rawText.replace(/\b\d{1,3}'/g, ' ');
      rawText = rawText.replace(/Trực tiếp|Trực Tiếp|Đang đá|Đang live|\bLIVE\b|Sắp diễn ra/ig, ' ');

      for (let lg of sortedLeagues) {
        let regexLg = new RegExp(`\\b${lg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "ig");
        rawText = rawText.replace(regexLg, ' ');
      }

      if (!rawText.includes("VS")) continue;

      let foundBlvs = [];
      for (let blv of sortedBlvKeys) {
        let escapeBlv = blv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let regex = new RegExp(`(?:BLV\\s*\\-\\s*|BLV\\s*)?(${escapeBlv})`, "gi");
        if (regex.test(rawText)) {
          let stdName = (blv === "Gà") ? "Gà Rừng" : (blv === "Pháo") ? "Pháo Thủ" : blv;
          if (!foundBlvs.includes(stdName)) foundBlvs.push(stdName);
          rawText = rawText.replace(regex, ' ');
        }
      }

      const garbageWords = ["Nghỉ giữa hiệp", "Nghỉ giữa trận", "Đang diễn ra", "Đang đá", "Hiệp 1", "Hiệp 2", "HT", "FT", "CƯỢC", "FB88", "8Xbet", "SV368", "Nhà đài", "Tất cả", "Trận hot", "BLV", "Nam", "Nữ"];
      for (let g of garbageWords) {
        rawText = rawText.replace(new RegExp(`(^|\\s)${g}(\\s|$)`, "ig"), ' ');
      }

      rawText = rawText.replace(/\s+/g, ' ').trim();
      let parts = rawText.split('VS').map(p => p.trim()).filter(p => p.length > 0);
      if (parts.length < 2) continue;

      let team1 = extractCleanTeam(parts[0]);
      let team2 = extractCleanTeam(parts[1]);
      if (!team1 || !team2) continue;

      let timeDateDisplay = timeStr;
      if (timeStr && dateStr) timeDateDisplay = `${timeStr} ${dateStr}`;
      else if (timeStr && !dateStr) timeDateDisplay = `${timeStr} 18/10`;
      else if (!timeStr && dateStr) timeDateDisplay = `00:00 ${dateStr}`;
      else timeDateDisplay = "00:00 18/10";

      const formattedTeams = `${team1} vs ${team2}`;
      const dictKey = `${formattedTeams}_${timeDateDisplay}`;
      const fullUrl = href.startsWith('http') ? href : "https://xoiche.tv" + (href.startsWith('/') ? '' : '/') + href;

      let matchLogo = leagueLogoMap[detectedLeague] || defaultSportLogo;

      if (!matchDict[dictKey]) {
        matchDict[dictKey] = {
          timeDate: timeDateDisplay,
          teams: formattedTeams,
          team1,
          team2,
          blvs: foundBlvs,
          fallbackUrl: fullUrl,
          logo: matchLogo
        };
      } else {
        for (let b of foundBlvs) {
          if (!matchDict[dictKey].blvs.includes(b)) matchDict[dictKey].blvs.push(b);
        }
      }
    }

    const vlcOpt = "#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    const xoicheList = [];
    const seenKeys = new Set();

    for (let key in matchDict) {
      const data = matchDict[key];

      if (data.blvs.length > 0) {
        data.blvs.forEach(blv => {
          const streamUrl = blvStreamMap[blv] || data.fallbackUrl;
          const uniqueKey = `${key}_${streamUrl}`;

          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            xoicheList.push(`#EXTINF:-1 group-title="Xôi Chè" tvg-logo="${data.logo}", ${data.timeDate} ⚽ ${data.teams} (${blv})\n${vlcOpt}\n${streamUrl}`);
          }
        });
      } else {
        const uniqueKey = `${key}_${data.fallbackUrl}`;
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          xoicheList.push(`#EXTINF:-1 group-title="Xôi Chè" tvg-logo="${data.logo}", ${data.timeDate} ⚽ ${data.teams}\n${vlcOpt}\n${data.fallbackUrl}`);
        }
      }
    }

    const combined = "#EXTM3U\n\n" + (xoicheList.length > 0 ? xoicheList.join("\n\n") : `#EXTINF:-1 group-title="Xôi Chè", Kênh Mẫu Dự Phòng\nhttps://live.khoga.space/live/livehub2/index.m3u8`);

    res.status(200).send(combined);

  } catch (err) {
    res.status(200).send("#EXTM3U\n#EXTINF:-1 group-title=\"Xôi Chè\", Lỗi Hệ Thống\nhttps://live.khoga.space/live/livehub2/index.m3u8");
  }
}
