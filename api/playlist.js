// ============================================================
//  M3U Aggregator - Clean & Deduplicate
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
const FETCH_TIMEOUT = 8000;
const EXPIRE_HOURS = 2; 

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

function isSameTeam(team1, team2) {
  if (team1 === team2) return true;
  if (team1.includes(team2) || team2.includes(team1)) return true;
  const dist = levenshtein(team1, team2);
  const maxLen = Math.max(team1.length, team2.length);
  return (dist / maxLen) <= 0.35; 
}

const ALIASES = {
  "man city": "manchester city", "man utd": "manchester united", "man united": "manchester united",
  "wolves": "wolverhampton", "spurs": "tottenham", "newcastle utd": "newcastle",
  "west ham utd": "west ham", "nottm forest": "nottingham forest", "sheffield utd": "sheffield united",
  "psg": "paris saint germain", "bayern": "bayern munchen", "dortmund": "borussia dortmund",
  "monchengladbach": "gladbach", "inter": "inter milan", "ac milan": "milan", "juve": "juventus",
  "atletico": "atleti madrid", "atl madrid": "atleti madrid", "a madrid": "atleti madrid",
  "real": "real madrid", "barca": "barcelona", "sociedad": "real sociedad", "betis": "real betis",
  "vallecano": "rayo vallecano", "ny red bulls": "new york red bulls", "paris fc": "paris fc",
  "eintracht": "eintracht frankfurt", "dep a coruna": "deportivo la coruna"
};

function cleanAndAliasTeam(rawName) {
  let name = standardizeName(rawName);
  name = name.replace(/\b(a league|a-league|ngoai hang|cup c1|c1|champions league|europa league|v league|v-league)\b/g, ' ');
  name = name.replace(/\b(hls|flv|hd|sd|fhd)\b/g, ' '); 
  name = name.replace(/\b(fc|cf|sc|ac|club|calcio|sporting|cd|u19|u20|u21|u23|nu|women|sco)\b/g, ' ')
             .replace(/\s+/g, ' ').trim();

  Object.keys(ALIASES).forEach(k => {
    const regex = new RegExp(`\\b${k}\\b`, 'g');
    name = name.replace(regex, ALIASES[k]);
  });

  return name;
}

function extractDateTime(title) {
  try {
    let cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ');
    let match = cleanTitle.match(/(\d{1,2})\s*(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})/i);
    
    if (match) {
      let h = parseInt(match[1]), m = parseInt(match[2]), d = parseInt(match[3]), mon = parseInt(match[4]);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59 && d >= 1 && d <= 31 && mon >= 1 && mon <= 12) {
        return { h, m, d, mon };
      }
    }
  } catch (error) {}
  return null;
}

function parseMatchTitle(title, url) {
  if (!title) return null;

  // 1. LOẠI BỎ LINK FLV
  if (url.toLowerCase().includes(".flv")) return null;

  let dt = extractDateTime(title);
  let timeStr = "Sắp tới";
  let timeMs = new Date().getTime() + 24 * 3600 * 1000;

  if (dt) {
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const matchDate = new Date(now.getFullYear(), dt.mon - 1, dt.d, dt.h, dt.m);
    timeStr = `${dt.h.toString().padStart(2, '0')}:${dt.m.toString().padStart(2, '0')} ${dt.d}/${dt.mon}`;
    timeMs = matchDate.getTime();

    if ((now.getTime() - timeMs) / (1000 * 60 * 60) > EXPIRE_HOURS) {
      return null;
    }
  }

  let cleanTitle = title
    .replace(/\[.*?\]/g, ' ') 
    .replace(/\(.*?\)/g, ' ') 
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') 
    .replace(/\b\d{1,2}[h:]?\s*\d{1,2}\b/gi, ' ') 
    .replace(/\b\d{1,2}[\/\-]\d{1,2}\b/g, ' ') 
    .replace(/\|.*/g, ' ') 
    .replace(/\s+/g, ' ') 
    .trim();

  const vsMatch = cleanTitle.match(/(.*?)\s+(?:vs\.?|v\.?|versus|-)\s+(.*)/i);
  if (!vsMatch) return null; 

  let teamA = vsMatch[1].trim();
  let teamB = vsMatch[2].trim();

  const teamBWords = teamB.split(' ');
  if (teamBWords.length > 2 && !ALIASES[teamB.toLowerCase()]) {
      teamB = teamBWords.slice(0, 2).join(' ');
  }
  
  // Lấy tên hiển thị của BLV (Phần trong ngoặc)
  let blvName = "Live";
  const blvMatch = title.match(/\((.*?)\)/);
  if (blvMatch) {
      blvName = blvMatch[1].replace(/\[.*?\]/g, '').trim(); // Xóa [hls] nếu có
  } else {
      // Nếu không có ngoặc, cắt lấy phần sau dấu ]
      blvName = title.replace(/^\[.*?\]\s*/, '').replace(/^[^\w\s]+\s*/, '').trim();
  }

  return {
    cleanA: cleanAndAliasTeam(teamA),
    cleanB: cleanAndAliasTeam(teamB),
    timeStr: timeStr,
    timeMs: timeMs,
    displayName: `${teamA.replace(/_/g, ' ').trim()} vs ${teamB.replace(/_/g, ' ').trim()}`,
    blvName: blvName
  };
}

function processM3UText(text) {
  if (!text || typeof text !== "string") return { matches: [], others: [] };
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const matches = [];
  const others = []; 
  let i = 0;

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

        if (urlIdx >= lines.length) { i = urlIdx; continue; }
        const url = lines[urlIdx].trim();

        if (!isBlocked) {
          const titleMatch = line.match(/,(.*)$/);
          const title = titleMatch ? titleMatch[1].trim() : "";
          
          const matchData = parseMatchTitle(title, url);

          if (matchData) {
            matches.push({ extinf: line, url: url, title: title, matchData: matchData });
          } else {
            // KIỂM TRA LINK FLV CHO KÊNH LẺ
            if (url.toLowerCase().includes(".flv")) { i = urlIdx + 1; continue; }

            const dt = extractDateTime(title);
            if (dt) {
              const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
              const matchDate = new Date(now.getFullYear(), dt.mon - 1, dt.d, dt.h, dt.m);
              if ((now.getTime() - matchDate.getTime()) / (1000 * 60 * 60) > EXPIRE_HOURS) {
                 i = urlIdx + 1; continue;
              }
            }
            if (/truyen hinh/i.test(standardizeName(originalGroup))) {
               others.push({ extinf: line, url: url, title: title });
            }
          }
        }
        i = urlIdx + 1;
        continue;
      } catch (e) { i++; continue; }
    }
    i++;
  }
  return { matches, others };
}

// ============================================================
//  Handler
// ============================================================

export default async function handler(req, res) {
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
        const m = ch.matchData;
        let foundGroup = null;
        for (const group of groupsList) {
          if ((isSameTeam(m.cleanA, group.cleanA) && isSameTeam(m.cleanB, group.cleanB)) ||
              (isSameTeam(m.cleanA, group.cleanB) && isSameTeam(m.cleanB, group.cleanA))) {
            foundGroup = group; break;
          }
        }
        
        if (foundGroup) {
          // LỌC TRÙNG LẶP: Kiểm tra xem tên BLV này đã có trong nhóm chưa
          const isDuplicate = foundGroup.streams.some(s => s.matchData.blvName === m.blvName);
          if (!isDuplicate) {
             foundGroup.streams.push(ch);
          }
          if (m.displayName.length > foundGroup.displayName.length) foundGroup.displayName = m.displayName;
        } else {
          groupsList.push({ cleanA: m.cleanA, cleanB: m.cleanB, displayName: m.displayName, timeStr: m.timeStr, timeMs: m.timeMs, streams: [ch] });
        }
      } catch (e) {}
    });

    groupsList.sort((a, b) => a.timeMs - b.timeMs);
    const parts = [];

    if (allOthers.length > 0) {
      allOthers.forEach(ch => {
        let newExtinf = ch.extinf.replace(/group-title="[^"]*"/i, `group-title="📺 Truyền Hình"`);
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    for (const group of groupsList) {
      const groupTitle = `⚽ [${group.timeStr}] ${group.displayName}`; 
      group.streams.forEach((ch) => {
        let newExtinf = ch.extinf.replace(/group-title="[^"]*"/i, `group-title="${groupTitle}"`);
        // Tên kênh con hiển thị là tên BLV
        newExtinf = newExtinf.replace(/,(.*)$/, `,${ch.matchData.blvName}`);
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    const statusName = updateTime ? `Trạng thái: Ổn định (Cập nhật: ${updateTime})` : `Trạng thái: Ổn định`;
    parts.push(`#EXTINF:-1 group-title="${statusName}",${statusName}\n${STATUS_STREAM_URL}`);

    let combined = "#EXTM3U\n" + parts.join("\n\n");
    combined = combined.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"); 
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).send(combined);

  } catch (err) {
    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    return res.status(200).send("#EXTM3U\n");
  }
}
