// ============================================================
//  M3U Aggregator - OPTIMIZED (Fire Icon for >= 4 Streams)
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

const OTHER_SPORTS_ICONS_REGEX = /[🏐🏀🎾🏈⚾🎱🏸🥊🏒🏉🎯🏎️🏎]/;

const STATUS_STREAM_URL = "https://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const FETCH_TIMEOUT = 6000; 

const EXPIRE_PAST_HOURS = 2;   
const MAX_FUTURE_HOURS = 12;   

// --- CACHE CONFIG ---
let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 90 * 1000; 

// --- BẢNG QUY ĐỔI VỀ CHUẨN TIẾNG VIỆT ---
const ALIASES = {
  "man dan": "manchester united", "quy do": "manchester united", "man utd": "manchester united", "man united": "manchester united",
  "man city": "manchester city", "wolves": "wolverhampton", "spurs": "tottenham", "newcastle utd": "newcastle",
  "west ham utd": "west ham", "nottm forest": "nottingham forest", "sheffield utd": "sheffield united",
  "psg": "paris saint germain", "bayern": "bayern munchen", "dortmund": "borussia dortmund",
  "monchengladbach": "gladbach", "inter": "inter milan", "ac milan": "milan", "juve": "juventus",
  "atletico madrid": "atletico madrid", "atletico": "atletico madrid", "atl madrid": "atletico madrid", 

  "japan": "nhat ban", "nhat ban": "nhat ban",
  "south korea": "han quoc", "korea republic": "han quoc", "korea rep": "han quoc", "han quoc": "han quoc",
  "china": "trung quoc", "trung quoc": "trung quoc",
  "vietnam": "viet nam", "viet nam": "viet nam",
  "thailand": "thai lan", "thai lan": "thai lan",

  "turkiye": "tho nhi ky", "turkey": "tho nhi ky", "tho nhi ky": "tho nhi ky",
  "belgium": "bi", "bi": "bi",
  "czech republic": "cong hoa sec", "czechia": "cong hoa sec", "czech": "cong hoa sec", "cong hoa sec": "cong hoa sec", "sec": "cong hoa sec",
  "spain": "tay ban nha", "tay ban nha": "tay ban nha",
  "england": "anh", "anh": "anh",
  "france": "phap", "phap": "phap",
  "italy": "y", "y": "y",
  "ivory coast": "bo bien nga", "cote d ivoir": "bo bien nga", "cote d ivoire": "bo bien nga", "bo bien nga": "bo bien nga",
  "netherlands": "ha lan", "holland": "ha lan", "ha lan": "ha lan",
  "portugal": "bo dao nha", "bo dao nha": "bo dao nha",
  "germany": "duc", "duc": "duc",
  "sweden": "thuy dien", "thuy dien": "thuy dien",
  "switzerland": "thuy si", "thuy si": "thuy si",
  "denmark": "dan mach", "dan mach": "dan mach",
  "norway": "na uy", "na uy": "na uy",
  "poland": "ba lan", "ba lan": "ba lan",
  "ukraine": "ukraina", "ukraina": "ukraina",
  "scotland": "xu gan", "xu gan": "xu gan",
  "greece": "hy lap", "hy lap": "hy lap",
  "austria": "ao", "ao": "ao",
  "cyprus": "sip", "sip": "sip",
  "armenia": "armenia",
  "albania": "albania",
  "finland": "finland",
  "latvia": "latvia",
  "montenegro": "montenegro"
};

const COMPILED_ALIASES = Object.entries(ALIASES).map(([k, v]) => ({
  regex: new RegExp(`\\b${k}\\b`, 'g'),
  val: v
}));

const LEAGUE_CLEANER_REGEX = /\b(a league|a-league|ngoai hang|cup c1|c1|champions league|europa league|v league|v-league|uefa nations league|nations league|king s cup|kings cup)\b/g;
const TEAM_SUFFIX_REGEX = /\b(afc|fc|cf|sc|ac|club|calcio|sporting|cd|u19|u20|u21|u23|nu|women|sco)\b/g;

const PRETTY_NAMES = {
  "nhat ban": "Nhật Bản",
  "han quoc": "Hàn Quốc",
  "trung quoc": "Trung Quốc",
  "viet nam": "Việt Nam",
  "thai lan": "Thái Lan",
  "tho nhi ky": "Thổ Nhĩ Kỳ",
  "bi": "Bỉ",
  "cong hoa sec": "Cộng Hòa Séc",
  "tay ban nha": "Tây Ban Nha",
  "anh": "Anh",
  "phap": "Pháp",
  "y": "Ý",
  "bo bien nga": "Bờ Biển Ngà",
  "ha lan": "Hà Lan",
  "bo dao nha": "Bồ Đào Nha",
  "duc": "Đức",
  "thuy dien": "Thụy Điển",
  "thuy si": "Thụy Sĩ",
  "dan mach": "Đan Mạch",
  "na uy": "Na Uy",
  "ba lan": "Ba Lan",
  "ukraina": "Ukraina",
  "croatia": "Croatia",
  "serbia": "Serbia",
  "hy lap": "Hy Lạp",
  "ao": "Áo",
  "sip": "Síp",
  "armenia": "Armenia",
  "albania": "Albania",
  "finland": "Finland",
  "latvia": "Latvia",
  "montenegro": "Montenegro",
  "manchester united": "Manchester United",
  "manchester city": "Manchester City",
  "real madrid": "Real Madrid",
  "barcelona": "Barcelona"
};

function formatPrettyName(normalizedKey, fallbackRaw) {
  if (PRETTY_NAMES[normalizedKey]) return PRETTY_NAMES[normalizedKey];
  if (!fallbackRaw) return "";
  return fallbackRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

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

  let words = name.split(' ');
  let uniqueWords = [...new Set(words)];
  return uniqueWords.join(' ').trim();
}

function cleanDisplayTeam(raw) {
  if (!raw) return "";
  let s = raw.replace(/^[\/]+/g, '').trim();
  s = s.replace(/^(friendlies|giao huu|giao hieu|v[\s\-]?league|ngoai hang|premier league|serie a|la liga|bundesliga|champions league|cup c1|c1|king'?s cup)\b/gi, '').trim();
  
  let normalizedKey = cleanAndAliasTeam(s);
  return formatPrettyName(normalizedKey, s);
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

function getNormalizedTokens(str) {
  const words = standardizeName(str).split(' ').filter(w => w.length >= 2);
  const combinedPairs = [];
  for (let i = 0; i < words.length - 1; i++) {
    combinedPairs.push(words[i] + words[i+1]);
  }
  const allTokens = [...new Set([...words, ...combinedPairs])];
  return allTokens.sort();
}

function isMatchGroup(ch, group) {
  if (ch.timeStr === "Sắp tới" || group.timeStr === "Sắp tới" || ch.timeStr !== group.timeStr) {
    return false;
  }

  const t1A = getNormalizedTokens(ch.cleanA);
  const t1B = getNormalizedTokens(ch.cleanB);
  const t2A = getNormalizedTokens(group.cleanA);
  const t2B = getNormalizedTokens(group.cleanB);

  const isSameTeam = (clean1, tokens1, clean2, tokens2) => {
    if (!clean1 || !clean2) return false;
    if (clean1 === clean2) return true;
    return tokens1.some(w => tokens2.includes(w));
  };

  const matchAA = isSameTeam(ch.cleanA, t1A, group.cleanA, t2A);
  const matchBB = isSameTeam(ch.cleanB, t1B, group.cleanB, t2B);
  const matchAB = isSameTeam(ch.cleanA, t1A, group.cleanB, t2B);
  const matchBA = isSameTeam(ch.cleanB, t1B, group.cleanA, t2A);

  return matchAA || matchBB || matchAB || matchBA;
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

            title = title.replace(/[🟢🟡🔴🟠🔵⚪⚫⚽]/g, '').trim();

            const isFlv = url.toLowerCase().includes(".flv") || url.toLowerCase().includes("=flv");
            
            if (!isBlocked && !isFlv && !hasOtherSportIcon) {
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
                  let teamA = cleanDisplayTeam(vsMatch[1].trim());
                  let teamB = cleanDisplayTeam(vsMatch[2].trim());
                  
                  let displayNameOut = `${teamA} vs ${teamB}`;

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
          if (ch.displayNameOut.length < foundGroup.displayNameOut.length) {
             foundGroup.displayNameOut = ch.displayNameOut;
             foundGroup.rawTeamA = ch.rawTeamA;
             foundGroup.rawTeamB = ch.rawTeamB;
          }
        } else {
          groupsList.push({ 
            cleanA: ch.cleanA, cleanB: ch.cleanB, 
            displayNameOut: ch.displayNameOut, 
            rawTeamA: ch.rawTeamA, rawTeamB: ch.rawTeamB,
            timeStr: ch.timeStr, timeMs: ch.timeMs, streams: [ch] 
          });
        }
      } catch (e) {}
    });

    const filteredGroupsList = groupsList.filter(group => group.streams.length >= 2);

    filteredGroupsList.sort((a, b) => a.timeMs - b.timeMs);
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

    for (const group of filteredGroupsList) {
      // Đổi điều kiện từ >= 5 thành >= 4 luồng thì thêm icon ngọn lửa 🔥
      const isHotMatch = group.streams.length >= 4;
      const hotIcon = isHotMatch ? "🔥 " : "";
      const groupTitle = `[${group.timeStr}] ${hotIcon}${group.displayNameOut}`; 
      
      group.streams.forEach((ch) => {
        let logoAttr = ch.logoUrl ? `tvg-logo="${ch.logoUrl}" ` : "";
        let cleanTeamA = ch.rawTeamA.replace(/^[\/⚽🏐🏀🎾🏈⚾\s]+/g, '').trim();
        let cleanTeamB = ch.rawTeamB.replace(/^[\/⚽🏐🏀🎾🏈⚾\s]+/g, '').trim();
        
        let channelName = `[${ch.blvName}] ${cleanTeamA} vs ${cleanTeamB}`;
        
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
