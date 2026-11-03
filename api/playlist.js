// ============================================================
//  M3U Aggregator - DOUBLE FILTER HOT MATCHES (Safe Error Handling)
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

// Icon môn thể thao KHÔNG PHẢI bóng đá để loại bỏ
const OTHER_SPORTS_ICONS_REGEX = /[🏐🏀🎾🏈⚾🎱🏸🥊🏒🏉🎯🏎️🏎]/;

const STATUS_STREAM_URL = "https://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const FETCH_TIMEOUT = 6000; 

const EXPIRE_PAST_HOURS = 2;   // Bỏ các trận đã đá quá 2 tiếng
const MAX_FUTURE_HOURS = 12;   // Chỉ lấy các trận diễn ra trong vòng 12 tiếng tới

// --- API CONFIG FOR HOT MATCHES ---
const FOOTBALL_DATA_API_KEY = "da4ee468a99c4bfd9953108f4241d612"; 
const FOOTBALL_DATA_URL = "https://api.football-data.org/v4/matches";

// 1. Danh sách các GIẢI ĐẤU LỚN được phép xét HOT
const TOP_COMPETITIONS = [
  "world cup", "fifa world cup",
  "european championship", "uefa euro", "euro",
  "afc asian cup", "asian cup",
  "copa america",
  "uefa champions league", "champions league", 
  "uefa europa league", "europa league", 
  "uefa conference league", "conference league",
  "premier league", 
  "primera division", "la liga", 
  "serie a", 
  "bundesliga", 
  "ligue 1", 
  "fa cup", 
  "copa del rey"
];

// 2. Danh sách CÁC ĐỘI BÓNG LỚN (Chỉ các trận có sự góp mặt của các đội này mới được lên HOT)
const BIG_TEAMS = [
  "real madrid", "barcelona", "atletico madrid", 
  "manchester united", "manchester city", "arsenal", "chelsea", "liverpool", "tottenham",
  "bayern munchen", "borussia dortmund", "leverkusen", "rb leipzig",
  "juventus", "inter milan", "ac milan", "milan", "napoli", "as roma", "roma",
  "paris saint germain", "psg",
  "ajax", "benfica", "porto", "sporting cp"
];

let cachedFixtures = null;
let fixturesCacheTimestamp = 0;
const FIXTURES_CACHE_TTL_MS = 2 * 3600 * 1000; // Cache API 2 tiếng

let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 90 * 1000; // Cache 90 giây

// --- PRE-COMPILE REGEX ALIASES ---
const ALIASES = {
  "man dan": "manchester united",
  "quy do": "manchester united",
  "man city": "manchester city", "man utd": "manchester united", "man united": "manchester united",
  "wolves": "wolverhampton", "spurs": "tottenham", "newcastle utd": "newcastle",
  "west ham utd": "west ham", "nottm forest": "nottingham forest", "sheffield utd": "sheffield united",
  "psg": "paris saint germain", "bayern": "bayern munchen", "dortmund": "borussia dortmund",
  "monchengladbach": "gladbach", "inter": "inter milan", "ac milan": "milan", "juve": "juventus",
  "atletico": "atletico madrid", "atleti": "atletico madrid", "atl madrid": "atletico madrid", "a madrid": "atletico madrid",
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

// ============================================================
//  Helpers
// ============================================================

async function fetchSafe(url, options = {}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "*/*", ...options.headers },
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

async function fetchFeaturedFixtures() {
  const now = Date.now();
  if (cachedFixtures && (now - fixturesCacheTimestamp < FIXTURES_CACHE_TTL_MS)) {
    return cachedFixtures;
  }

  if (!FOOTBALL_DATA_API_KEY || FOOTBALL_DATA_API_KEY === "YOUR_API_KEY_HERE") {
    return [];
  }

  try {
    const resText = await fetchSafe(FOOTBALL_DATA_URL, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
    });
    if (!resText) return cachedFixtures || [];

    const data = JSON.parse(resText);
    if (data && data.matches) {
      const hotMatches = data.matches.map(m => {
        return {
          homeTeam: standardizeName(m?.homeTeam?.name || ""),
          awayTeam: standardizeName(m?.awayTeam?.name || ""),
          competition: standardizeName(m?.competition?.name || "")
        };
      });
      cachedFixtures = hotMatches;
      fixturesCacheTimestamp = now;
      return hotMatches;
    }
  } catch (e) {
    // Fallback an toàn
  }
  return cachedFixtures || [];
}

function standardizeName(name) {
  if (!name) return "";
  return String(name).toLowerCase()
    .replace(/đ/g, 'd')
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
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

function isMatchGroup(ch, group) {
  const timeDiff = Math.abs(ch.timeMs - group.timeMs);
  if (timeDiff > 45 * 60 * 1000) return false;

  const getWords = (str) => standardizeName(str).split(' ').filter(w => w.length >= 3);
  
  const a1 = getWords(ch.cleanA);
  const b1 = getWords(ch.cleanB);
  const a2 = getWords(group.cleanA);
  const b2 = getWords(group.cleanB);

  const countOverlap = (arr1, arr2) => arr1.filter(w => arr2.includes(w)).length;

  const directMatch = countOverlap(a1, a2) >= 1 && countOverlap(b1, b2) >= 1;
  const crossMatch = countOverlap(a1, b2) >= 1 && countOverlap(b1, a2) >= 1;

  return directMatch || crossMatch;
}

// BỘ LỌC KÉP GIẢI ĐẤU + ĐỘI BÓNG LỚN LÊN HOT
function isHotMatch(group, apiFixtures) {
  try {
    if (!group) return false;
    const cleanA = group.cleanA || "";
    const cleanB = group.cleanB || "";
    const fullTextCheck = standardizeName(`${cleanA} ${cleanB}`);

    // 1. Tự động gán nhãn HOT cho Đội tuyển Việt Nam (U22, U23, ĐTQG)
    const isVietnamTeam = /viet\s*nam|vn\b|u22\s*vietnam|u23\s*vietnam|doi\s*tuyen/i.test(fullTextCheck);
    if (isVietnamTeam) {
      return true;
    }

    // 2. Kiểm tra trận đấu có sự góp mặt của các Đội bóng lớn (Big Teams)
    const hasBigTeam = BIG_TEAMS.some(team => fullTextCheck.includes(team));
    if (!hasBigTeam) {
      return false; // Nếu không có đội bóng lớn nào tham gia -> Bỏ qua nhãn HOT
    }

    // 3. Kiểm tra qua API xem trận đó có thuộc Giải đấu lớn (Top Competitions) không
    if (!apiFixtures || !Array.isArray(apiFixtures) || apiFixtures.length === 0) return false;
    
    for (const fix of apiFixtures) {
      if (!fix) continue;
      
      const compName = standardizeName(fix.competition || "");
      const isTopComp = TOP_COMPETITIONS.some(comp => compName.includes(comp));
      
      if (!isTopComp) continue;

      const fixHome = standardizeName(fix.homeTeam || "");
      const fixAway = standardizeName(fix.awayTeam || "");

      const matchHome = cleanA.includes(fixHome) || fixHome.includes(cleanA);
      const matchAway = cleanB.includes(fixAway) || fixAway.includes(cleanB);
      const crossHome = cleanA.includes(fixAway) || fixAway.includes(cleanA);
      const crossAway = cleanB.includes(fixHome) || fixHome.includes(cleanB);

      if ((matchHome && matchAway) || (crossHome && crossAway)) {
        return true;
      }
    }
  } catch (e) {
    // Bắt lỗi ngầm tránh crash 500
  }
  return false;
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

            const hasOtherSportIcon = OTHER_SPORTS_ICONS_REGEX.test(title);

            title = title.replace(/[🟢🟡🔴🟠🔵⚪⚫]/g, '').trim();
            const sportIconMatch = title.match(/[⚽]/);
            let sportIcon = sportIconMatch ? sportIconMatch[0] : "⚽";

            const isFlv = url.toLowerCase().includes(".flv") || url.toLowerCase().includes("=flv");
            
            const isU19 = /\bu19\b/i.test(title);
            const isVietnam = /viet\s*nam|vn\b/i.test(title);
            const skipU19 = isU19 && !isVietnam;

            if (!isBlocked && !isFlv && !hasOtherSportIcon && !skipU19) {
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
  try {
    const currentTime = Date.now();

    if (cachedResult && (currentTime - cacheTimestamp < CACHE_TTL_MS)) {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(200).send(cachedResult);
    }

    let combined = "#EXTM3U\n"; 

    const [textXiaomi, textThTT, textXoiChe, apiFixtures] = await Promise.all([
      fetchSafe(SOURCES.xiaomi), 
      fetchSafe(SOURCES.thtt), 
      fetchSafe(SOURCES.xoiche),
      fetchFeaturedFixtures()
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
          if (isMatchGroup(ch, group)) {
            foundGroup = group; 
            break;
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

    if (allOthers.length > 0) {
      allOthers.forEach(ch => {
        let logoAttr = ch.logoUrl ? `tvg-logo="${ch.logoUrl}" ` : "";
        let newExtinf = `#EXTINF:-1 ${logoAttr}group-title="📺 Truyền Hình",${ch.title}`;
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    const statusName = updateTime ? `Trạng thái: Ổn định (Cập nhật: ${updateTime})` : `Trạng thái: Ổn định`;
    parts.push(`#EXTINF:-1 tvg-logo="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Twitter_Verified_Badge.svg/512px-Twitter_Verified_Badge.svg.png" group-title="${statusName}",${statusName}\n${STATUS_STREAM_URL}`);

    for (const group of groupsList) {
      const isHot = isHotMatch(group, apiFixtures);
      const groupTitle = isHot 
        ? `🔥 HOT 🔥 [${group.timeStr}] ${group.displayNameOut}` 
        : `[${group.timeStr}] ${group.displayNameOut}`; 
      
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

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"); 
    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).send(combined);

  } catch (err) {
    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    return res.status(200).send("#EXTM3U\n#EXTINF:-1 group-title=\"📺 Truyền Hình\",Lỗi hệ thống tạm thời\nhttps://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm\n");
  }
}
