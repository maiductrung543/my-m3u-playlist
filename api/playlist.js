// ============================================================
//  M3U Aggregator - Vercel Serverless Function
//  Fix: Gom nhóm bóng đá thông minh bằng Fuzzy Match + Giữ nhóm Truyền Hình
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

function normalizeStr(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

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

/** 
 * Hàm tạo "Chìa khóa" gom nhóm thông minh (Fuzzy Key)
 * Lấy 3 ký tự đầu của mỗi từ (bỏ qua các từ nối như fc, cf, sc...)
 */
function getFuzzyKey(matchName) {
  if (!matchName) return "";
  
  // Bỏ các hậu tố, tiền tố thừa
  let clean = matchName.toLowerCase()
    .replace(/\b(fc|cf|sc|ac|club|calcio|sporting|atletico|atletica|de|real|cd)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '') // bỏ ký tự đặc biệt
    .replace(/\s+/g, ' ') // gộp khoảng trắng
    .trim();

  // Tách thành 2 đội (dựa vào chữ vs)
  const parts = clean.split(/\s+vs\s+/);
  if (parts.length !== 2) return clean; // Không phải dạng VS thì giữ nguyên

  // Hàm rút gọn: Giữ 3 chữ cái đầu của mỗi từ
  const shortenTeam = (team) => {
    return team.split(' ').map(word => word.substring(0, 3)).join('');
  };

  return `${shortenTeam(parts[0])}_vs_${shortenTeam(parts[1])}`;
}

/** 
 * Hàm bóc tách tên trận đấu VÀ kiểm tra hạn sử dụng
 */
function extractMatchInfo(title) {
  if (!title) return null;
  
  const match = title.match(/^(\[.*?\]\s*.*?)\s*\(/);
  if (!match) return null;

  let displayName = match[1].trim(); 
  let matchName = displayName;

  const bracketMatch = matchName.match(/^\[.*?\]\s*(.*)$/);
  if (bracketMatch) {
    matchName = bracketMatch[1];
  }

  // Đưa về dạng chuẩn để tí nữa băm
  let normalized = matchName.toLowerCase().replace(/\s+(v|vs|versus|-)\s+/g, ' vs ');
  
  // --- LOGIC KIỂM TRA THỜI GIAN ---
  let isExpired = false;
  try {
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const timeMatch = displayName.match(/(?:\[)?(\d{1,2})[:h](\d{2}).*?(\d{1,2})[\/\-](\d{1,2})/i) || 
                      displayName.match(/(?:\[)?(\d{1,2})[\/\-](\d{1,2}).*?(\d{1,2})[:h](\d{2})/i);
    
    if (timeMatch) {
      let h, m, d, month;
      if (timeMatch[0].indexOf(':') < timeMatch[0].indexOf('/') || timeMatch[0].indexOf(':') < timeMatch[0].indexOf('-')) {
        h = parseInt(timeMatch[1]); m = parseInt(timeMatch[2]);
        d = parseInt(timeMatch[3]); month = parseInt(timeMatch[4]);
      } else {
        d = parseInt(timeMatch[1]); month = parseInt(timeMatch[2]);
        h = parseInt(timeMatch[3]); m = parseInt(timeMatch[4]);
      }
      const matchDate = new Date(now.getFullYear(), month - 1, d, h, m);
      if (matchDate.getMonth() < now.getMonth() - 6) matchDate.setFullYear(now.getFullYear() + 1);
      
      const diffMs = now - matchDate;
      if (diffMs / (1000 * 60 * 60) > EXPIRE_HOURS) isExpired = true;
    }
  } catch (e) { }

  return { 
    displayName, 
    fuzzyKey: getFuzzyKey(normalized), // Dùng chìa khóa thông minh để gom
    isExpired 
  };
}

/** Xử lý & lọc nội dung M3U */
function processM3UText(text) {
  if (!text || typeof text !== "string") return { matches: [], others: [] };

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const matches = [];
  const others = []; 
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes('group-title="') && /update|cập nhật|cap nhat/i.test(line)) {
      i++;
      if (i < lines.length && /^https?:\/\//i.test(lines[i].trim())) i++;
      continue;
    }

    if (line.startsWith("#EXTINF")) {
      let isBlocked = false;
      let originalGroup = "Kênh Khác";
      
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      if (groupMatch) {
        originalGroup = groupMatch[1]; 
        const normGroup = normalizeStr(originalGroup);
        isBlocked = BLOCKED_GROUP_KEYWORDS.some(kw => normGroup.includes(kw));
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
        
        const matchInfo = extractMatchInfo(title);

        if (matchInfo && matchInfo.isExpired) {
          i = urlIdx + 1;
          continue; 
        }

        const channelData = { extinf: line, url: url, title: title, originalGroup: originalGroup, matchInfo: matchInfo };

        if (matchInfo) {
           matches.push(channelData); 
        } else {
           others.push(channelData); 
        }
      }
      i = urlIdx + 1;
      continue;
    }
    i++;
  }
  return { matches, others };
}

// ============================================================
//  Handler
// ============================================================

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const [textXiaomi, textThTT, textXoiChe] = await Promise.all([
      fetchSafe(SOURCES.xiaomi),
      fetchSafe(SOURCES.thtt),
      fetchSafe(SOURCES.xoiche),
    ]);

    const resXiaomi = processM3UText(textXiaomi);
    const resThTT = processM3UText(textThTT);
    const resXoiChe = processM3UText(textXoiChe);

    const allMatches = [...resXiaomi.matches, ...resThTT.matches, ...resXoiChe.matches];
    const allOthers = [...resXiaomi.others, ...resThTT.others, ...resXoiChe.others];

    // --- 1. XỬ LÝ NHÓM TRẬN ĐẤU (Dùng Fuzzy Key) ---
    const groupedMatches = {}; 
    allMatches.forEach(ch => {
      const key = ch.matchInfo.fuzzyKey; 
      if (!groupedMatches[key]) {
        groupedMatches[key] = { displayName: ch.matchInfo.displayName, streams: [] };
      }
      groupedMatches[key].streams.push(ch);
    });

    const parts = [];

    for (const key in groupedMatches) {
      const group = groupedMatches[key];
      const groupTitle = `⚽ ${group.displayName}`; 
      
      group.streams.forEach((ch) => {
        let newExtinf = ch.extinf.replace(/group-title="[^"]*"/i, `group-title="${groupTitle}"`);
        const blvMatch = ch.title.match(/\((.*?)\)/);
        if (blvMatch) {
           newExtinf = newExtinf.replace(/,(.*)$/, `,${blvMatch[1]}`);
        }
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    // --- 2. XỬ LÝ NHÓM TRUYỀN HÌNH / KÊNH KHÁC ---
    if (allOthers.length > 0) {
      allOthers.sort((a, b) => {
        if (a.originalGroup.includes("Truyền Hình") && !b.originalGroup.includes("Truyền Hình")) return -1;
        if (!a.originalGroup.includes("Truyền Hình") && b.originalGroup.includes("Truyền Hình")) return 1;
        return 0;
      });

      allOthers.forEach(ch => {
        let finalGroup = ch.originalGroup;
        if (normalizeStr(finalGroup) === "" || normalizeStr(finalGroup).length < 2) finalGroup = "📺 Kênh Khác";
        
        let newExtinf = ch.extinf.replace(/group-title="[^"]*"/i, `group-title="${finalGroup}"`);
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    // --- 3. KÊNH TRẠNG THÁI ---
    const statusTitle = `⏱️ Trạng thái: Hoạt động bình thường`;
    parts.push(`#EXTINF:-1 group-title="${statusTitle}",Hệ thống ổn định\n${STATUS_STREAM_URL}`);

    let combined = "#EXTM3U\n" + parts.join("\n\n");
    combined = combined.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";

    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.method === "HEAD") return res.status(200).end();
    res.status(200).send(combined);

  } catch (err) {
    console.error("[M3U] Lỗi:", err);
    res.status(500).send("Lỗi: " + (err?.message || "unknown"));
  }
}
