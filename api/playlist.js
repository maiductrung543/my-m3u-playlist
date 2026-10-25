// ============================================================
//  M3U Aggregator - OPTIMIZED (No Whitelist + 12H Filter + Smart Core Match)
// ============================================================

const SOURCES = {
  xiaomi: "https://tinyurl.com/vietxiaomi",
  thtt:   "https://thtt.pages.dev/tttt.m3u",
  xoiche: "https://tinyurl.com/xoiche1",
};

const BLOCKED_GROUP_KEYWORDS = [
  "chuoichien", "saoke", "xoilac", "sutbong", "phalangtv", 
  "xoigactv", "colatv", "gavang24htv", "gavang33tv"
];

const STATUS_STREAM_URL = "https://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const FETCH_TIMEOUT = 6000; 

const EXPIRE_PAST_HOURS = 2;   // Bỏ các trận đã đá quá 2 tiếng
const MAX_FUTURE_HOURS = 12;   // Chỉ lấy các trận diễn ra trong vòng 12 tiếng tới

// --- CACHE CONFIG ---
let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 90 * 1000; // Cache 90 giây

// --- PRE-COMPILE REGEX ---
const ALIASES = {
  "man city": "manchester city", "man utd": "manchester united", "man united": "manchester united",
  "wolves": "wolverhampton", "spurs": "tottenham", "newcastle utd": "newcastle",
  "west ham utd": "west ham", "nottm forest": "nottingham forest", "sheffield utd": "sheffield united",
  "psg": "paris saint germain", "bayern": "bayern munchen", "dortmund": "borussia dortmund",
  "monchengladbach": "gladbach", "inter": "inter milan", "ac milan": "milan", "juve": "juventus",
  "atletico": "atleti madrid", "atl madrid": "atleti madrid", "a madrid": "atleti madrid",
  "ath bilbao": "athletic bilbao", "ath": "athletic", "atl": "atletico",
  "real": "real madrid", "barca": "barcelona", "sociedad": "real sociedad", "betis": "real betis",
  "vallecano": "rayo vallecano", "ny red bulls": "new york red bulls", "paris fc": "paris fc",
  "eintracht": "eintracht frankfurt", "dep a coruna": "deportivo la coruna"
};

const COMPILED_ALIASES = Object.entries(ALIASES).map(([k, v]) => ({
  regex: new RegExp(`\\b${k}\\b`, 'g'),
  val: v
}));

const LEAGUE_CLEANER_REGEX = /\b(a league|a-league|ngoai hang|cup c1|c1|champions league|europa league|v league|v-league)\b/g;
const TEAM_SUFFIX_REGEX = /\b(afc|fc|cf|sc|ac|club|calcio|sporting|cd|u19|u20|u21|u23|nu|women|sco)\b/g;

// Các từ chung chung không được dùng làm từ khóa cốt lõi đơn độc để tránh gộp nhầm
const GENERIC_WORDS = new Set(["real", "united", "city", "sporting", "deportivo", "atletico", "athletic", "club", "team"]);

// ============================================================
//  Helpers
// ============================================================

async function fetchSafe(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function standardizeName(name) {
  if (!name) return "";
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

// Hàm so sánh tên đội thông minh: Kết hợp Viết tắt, Tiền tố và Từ khóa cốt lõi (Core Keyword)
function isSameTeam(team1, team2) {
  if (team1 === team2) return true;
  if (team1.includes(team2) || team2.includes(team1)) return true;

  const words1 = team1.split(' ');
  const words2 = team2.split(' ');

  // 1. Kiểm tra biến thể viết tắt đặc thù (Athletic/Ath, Atletico/Atl)
  for (let w1 of words1) {
    for (let w2 of words2) {
      if ((w1 === 'ath' && w2 === 'athletic') || (w1 === 'athletic' && w2 === 'ath') ||
          (w1 === 'atl' && w2 === 'atletico') || (w1 === 'atletico' && w2 === 'atl')) {
        // Tìm xem có chung từ cốt lõi đặc trưng nào dài từ 4 ký tự trở lên không
        const hasCoreMatch = words1.some(w => w.length >= 4 && !GENERIC_WORDS.has(w) && words2.includes(w));
        if (hasCoreMatch || words1.length === 1 || words2.length === 1) return true;
      }
    }
  }

  // 2. Trích xuất từ khóa cốt lõi (bỏ qua các từ chung chung như real, united, city...)
  const core1 = words1.filter(w => w.length >= 4 && !GENERIC_WORDS.has(w));
  const core2 = words2.filter(w => w.length >= 4 && !GENERIC_WORDS.has(w));

  // Nếu cả hai đều có từ cốt lõi đặc trưng trùng nhau (VD: 'bilbao', 'sociedad', 'osasuna')
  const sharedCore = core1.some(c1 => core2.includes(c1));
  if (sharedCore) {
    return true;
  }

  // 3. Dự phòng bằng khoảng cách Levenshtein cho các lỗi chính tả nhỏ
  const dist = levenshtein(team1, team2);
  const maxLen = Math.max(team1.length, team2.length);
  return (dist / maxLen) <= 0.35; 
}

function cleanAndAliasTeam(rawName) {
  let name = standardizeName(rawName);
  name = name.replace(LEAGUE_CLEANER_REGEX, ' ');
  name = name.replace(TEAM_SUFFIX_REGEX, ' ').replace(/\s+/g, ' ').trim();

  for (let i = 0; i < COMPILED_ALIASES.length; i++) {
    name = name.replace(COMPILED_ALIASES[i].regex, COMPILED_ALIASES[i].val);
  }

  return name;
}

function extractDateTime(title) {
  try {
    let cleanTitle = title.replace(/[^0-9\s]/g, ' ').replace(/\s+/g, ' ');
    let match = cleanTitle.match(/(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})/);
    if (match) {
      let h = parseInt(match[1]), m = parseInt(match[2]), d = parseInt(match[3]), mon = parseInt(match[4]);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59 && d >= 1 && d <= 31 && mon >= 1 && mon <= 12) {
        return { h, m, d, mon };
      }
    }
  } catch (error) {}
  return null;
}

// ============================================================
//  Core Logic
// ============================================================

function processM3UText(text) {
  const matches = [];
  const others = []; 
  if (!text) return { matches, others };

  try {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    let i = 0;
    const nowTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"})).getTime();

    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (line.startsWith("#EXTINF")) {
        try {
          let originalGroup = "Kênh Khác";
          let isBlocked = false;
          const groupMatch = line.match(/group-title="([^"]*)"/i);
          if (groupMatch) {
            originalGroup = groupMatch[1];
            isBlocked = BLOCKED_GROUP_KEYWORDS.some(kw => standardizeName(originalGroup).replace(/\s+/g, '').includes(kw));
          }

          let urlIdx = i + 1;
          while (urlIdx < lines.length) {
            const t = lines[urlIdx].trim();
            if (t === "" || t.startsWith("#")) { urlIdx++; continue; }
            break;
          }

          if (urlIdx < lines.length) {
            const url = lines[urlIdx].trim();
            const titleMatch = line.match(/,(.*)$/);
            let title = titleMatch ? titleMatch[1].trim() : "";

            title = title.replace(/[🟢🟡🔴🟠🔵⚪⚫]/g, '').trim();
            const sportIconMatch = title.match(/[⚽🏐🏀🎾🏈⚾]/);
            let sportIcon = sportIconMatch ? sportIconMatch[0] : "";

            const isFlv = url.toLowerCase().includes(".flv") || url.toLowerCase().includes("=flv");
            
            if (!isBlocked && !isFlv) {
              const dt = extractDateTime(title);
              let skipMatch = false;

              if (dt) {
                const matchDate = new Date(new Date().getFullYear(), dt.mon - 1, dt.d, dt.h, dt.m).getTime();
                const diffHours = (nowTime - matchDate) / (1000 * 60 * 60);

                if (diffHours > EXPIRE_PAST_HOURS) {
                  skipMatch = true;
                } else if (diffHours < -MAX_FUTURE_HOURS) {
                  skipMatch = true;
                }
              }

              if (!skipMatch) {
                let logoMatch = line.match(/(?:tvg-logo|logo)=["']([^"']*)["']/i);
                let logoUrl = logoMatch ? logoMatch[1] : "";

                let cleanTitle = title.replace(/\[.*?\]/g, ' ').replace(/\(.*?\)/g, ' ').replace(/\b\d{1,2}[h:]?\s*\d{1,2}\b/gi, ' ').replace(/\b\d{1,2}[\/\-]\d{1,2}\b/g, ' ').replace(/\s+/g, ' ').trim();
                const vsMatch = cleanTitle.match(/(.*?)\s+(?:vs\.?|v\.?|versus|-)\s+(.*)/i);
                
                if (vsMatch) {
                  let teamA = vsMatch[1].trim();
                  let teamB = vsMatch[2].trim();
                  if (teamB.split(' ').length > 2 && !ALIASES[teamB.toLowerCase()]) {
                      teamB = teamB.split(' ').slice(0, 2).join(' ');
                  }
                  teamB = teamB.trim();
                  
                  let displayNameOut = `${teamA.replace(/^[\/]+/g, '').trim()} vs ${teamB}`;

                  let blvName = "Live";
                  const blvMatch = title.match(/\((.*?)\)/);
                  if (blvMatch) blvName = blvMatch[1].replace(/\[.*?\]/g, '').trim();

                  const now = new Date();
                  matches.push({ 
                    url: url, 
                    title: title,
                    logoUrl: logoUrl,
                    cleanA: cleanAndAliasTeam(teamA),
                    cleanB: cleanAndAliasTeam(teamB),
                    displayNameOut: displayNameOut,
                    rawTeamA: teamA,
                    rawTeamB: teamB,
                    sportIcon: sportIcon,
                    timeStr: dt ? `${dt.h.toString().padStart(2, '0')}:${dt.m.toString().padStart(2, '0')} ${dt.d}/${dt.mon}` : "Sắp tới",
                    timeMs: dt ? new Date(now.getFullYear(), dt.mon - 1, dt.d, dt.h, dt.m).getTime() : (now.getTime() + 24 * 3600 * 1000),
                    blvName: blvName
                  });
                } else {
                  if (/truyen hinh/i.test(standardizeName(originalGroup))) {
                     others.push({ url: url, title: title, logoUrl: logoUrl });
                  }
                }
              }
            }
            i = urlIdx + 1;
            continue;
          }
        } catch (err) {
          i++; 
          continue;
        }
      }
      i++;
    }
  } catch (globalErr) {}
  return { matches, others };
}

// ============================================================
//  Handler
// ============================================================

export default async function handler(req, res) {
  const currentTime = Date.now();

  if (cachedResult && (currentTime - cacheTimestamp < CACHE_TTL_MS)) {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).send(cachedResult);
  }

  let combined = "#EXTM3U\n"; 

  try {
    const [textXiaomi, textThTT, textXoiChe] = await Promise.all([
      fetchSafe(SOURCES.xiaomi), fetchSafe(SOURCES.thtt), fetchSafe(SOURCES.xoiche),
    ]);

    let updateTime = "";
    try {
        const timeUpdateMatch = textThTT.match(/group-title="([^"]*(?:Updated|Cập nhật|Cap nhat|\d{2,4})[^"]*)"/i);
        if (timeUpdateMatch) {
            let rawTime = timeUpdateMatch[1].replace(/Updated|Cập nhật|Cap nhat/gi, '').trim();
            rawTime = rawTime.replace(/\b(\d{2})(\d{2})\b/g, '$1:$2');
            updateTime = rawTime.replace(/^[:\-\s]+/, ''); 
        }
    } catch (e) {}

    const resXiaomi = processM3UText(textXiaomi);
    const resThTT = processM3UText(textThTT);
    const resXoiChe = processM3UText(textXoiChe);

    const allMatches = [...resXiaomi.matches, ...resThTT.matches, ...resXoiChe.matches];
    const allOthers = [...resXiaomi.others, ...resThTT.others, ...resXoiChe.others];

    const groupsList = []; 

    allMatches.forEach(ch => {
      try {
        let foundGroup = null;
        for (const group of groupsList) {
          if ((isSameTeam(ch.cleanA, group.cleanA) && isSameTeam(ch.cleanB, group.cleanB)) ||
              (isSameTeam(ch.cleanA, group.cleanB) && isSameTeam(ch.cleanB, group.cleanA))) {
            foundGroup = group; break;
          }
        }
        
        if (foundGroup) {
          const isDuplicateUrl = foundGroup.streams.some(s => s.url === ch.url);
          if (!isDuplicateUrl) {
             foundGroup.streams.push(ch);
          }
          if (ch.displayNameOut.length > foundGroup.displayNameOut.length) {
             foundGroup.displayNameOut = ch.displayNameOut;
             foundGroup.rawTeamA = ch.rawTeamA;
             foundGroup.rawTeamB = ch.rawTeamB;
             if (ch.sportIcon) foundGroup.sportIcon = ch.sportIcon;
          }
        } else {
          groupsList.push({ 
            cleanA: ch.cleanA, cleanB: ch.cleanB, 
            displayNameOut: ch.displayNameOut, 
            rawTeamA: ch.rawTeamA, rawTeamB: ch.rawTeamB,
            sportIcon: ch.sportIcon,
            timeStr: ch.timeStr, timeMs: ch.timeMs, streams: [ch] 
          });
        }
      } catch (e) {}
    });

    groupsList.sort((a, b) => a.timeMs - b.timeMs);
    const parts = [];

    // 1. Thêm nhóm Truyền hình trước
    if (allOthers.length > 0) {
      allOthers.forEach(ch => {
        let logoAttr = ch.logoUrl ? `tvg-logo="${ch.logoUrl}" ` : "";
        let newExtinf = `#EXTINF:-1 ${logoAttr}group-title="📺 Truyền Hình",${ch.title}`;
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    // 2. Đưa phần Trạng thái lên ngay sau nhóm Truyền hình (Đúng yêu cầu)
    const statusName = updateTime ? `Trạng thái: Ổn định (Cập nhật: ${updateTime})` : `Trạng thái: Ổn định`;
    parts.push(`#EXTINF:-1 tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Twitter_Verified_Badge.svg/512px-Twitter_Verified_Badge.svg.png" group-title="${statusName}",${statusName}\n${STATUS_STREAM_URL}`);

    // 3. Tiếp theo là danh sách các trận đấu đã gộp triệt để
    for (const group of groupsList) {
      const groupTitle = `[${group.timeStr}] ${group.displayNameOut}`; 
      
      group.streams.forEach((ch) => {
        let logoAttr = ch.logoUrl ? `tvg-logo="${ch.logoUrl}" ` : "";
        let cleanTeamA = ch.rawTeamA.replace(/^[\/⚽🏐🏀🎾🏈⚾\s]+/g, '').trim();
        let cleanTeamB = ch.rawTeamB.replace(/^[\/⚽🏐🏀🎾🏈⚾\s]+/g, '').trim();
        let iconStr = ch.sportIcon ? `${ch.sportIcon} ` : "";
        
        let channelName = `[${ch.blvName}] ${iconStr}${cleanTeamA} vs ${cleanTeamB}`;
        
        let newExtinf = `#EXTINF:-1 ${logoAttr}group-title="${groupTitle}",${channelName}`;
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    combined = "#EXTM3U\n" + parts.join("\n\n");
    combined = combined.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";

    cachedResult = combined;
    cacheTimestamp = Date.now();

  } catch (err) {
    combined = "#EXTM3U\n#EXTINF:-1 group-title=\"📺 Truyền Hình\",Lỗi tải danh sách\nhttps://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm\n";
  }

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"); 
  res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).send(combined);
}
