// ============================================================
//  M3U Aggregator - Vercel Serverless Function (SMART GROUPING & AUTO-CLEAN)
//  Nguồn: Xiaomi (Truyền hình) + Xôi Chè + THTT
//  Tính năng: Gom nhóm theo Trận Đấu (Chống lệch tên), giữ nguyên nhóm Truyền Hình, tự động xóa trận cũ quá 2 tiếng.
// ============================================================

const SOURCES = {
  xiaomi: "https://tinyurl.com/vietxiaomi", // Lấy lại nhóm Truyền Hình
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
//  TỪ ĐIỂN RÚT GỌN TÊN ĐỘI BÓNG (Giúp gom nhóm chính xác)
// ============================================================
const TEAM_ALIASES = {
  "man city": "manchester city", "man utd": "manchester united", "man united": "manchester united",
  "wolves": "wolverhampton", "spurs": "tottenham", "newcastle utd": "newcastle",
  "west ham utd": "west ham", "brighton hove": "brighton", "nottm forest": "nottingham forest",
  "sheffield utd": "sheffield united", "psg": "paris saint germain", "bayern munich": "bayern munchen",
  "dortmund": "borussia dortmund", "monchengladbach": "gladbach", "leipzig": "rb leipzig",
  "inter milan": "inter", "ac milan": "milan", "juve": "juventus", "roma": "as roma",
  "atletico madrid": "atletico", "athletic bilbao": "athletic club", "real betis": "betis",
  "sociedad": "real sociedad", "villarreal": "villarreal cf", "vallecano": "rayo vallecano"
};

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

  // Chuẩn hóa tên trận: chữ thường, xóa khoảng trắng, đưa về "vs"
  let normalized = matchName.toLowerCase().replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/\s+(v|vs|versus|-)\s+/g, ' vs ');
  
  // Áp dụng từ điển rút gọn tên đội bóng (Fuzzy match)
  Object.keys(TEAM_ALIASES).forEach(alias => {
    const regex = new RegExp(`\\b${alias}\\b`, 'g');
    normalized = normalized.replace(regex, TEAM_ALIASES[alias]);
  });

  // --- LOGIC KIỂM TRA THỜI GIAN (Quá 2 tiếng thì xóa) ---
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

  return { displayName, normalized, isExpired };
}

/** Xử lý & lọc nội dung M3U */
function processM3UText(text) {
  if (!text || typeof text !== "string") return { matches: [], others: [] };

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const matches = [];
  const others = []; // Chứa các kênh không phải bóng đá (Truyền hình...)
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
        originalGroup = groupMatch[1]; // Lưu lại tên nhóm gốc (VD: Truyền Hình)
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

        // Nếu là bóng đá và quá hạn -> Bỏ qua
        if (matchInfo && matchInfo.isExpired) {
          i = urlIdx + 1;
          continue; 
        }

        const channelData = { extinf: line, url: url, title: title, originalGroup: originalGroup, matchInfo: matchInfo };

        if (matchInfo) {
           matches.push(channelData); // Đưa vào danh sách trận đấu
        } else {
           others.push(channelData); // Đưa vào danh sách truyền hình
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

    // Phân loại kênh
    const resXiaomi = processM3UText(textXiaomi);
    const resThTT = processM3UText(textThTT);
    const resXoiChe = processM3UText(textXoiChe);

    // Gom tất cả các trận bóng đá lại
    const allMatches = [...resXiaomi.matches, ...resThTT.matches, ...resXoiChe.matches];
    
    // Gom tất cả kênh truyền hình (không phải bóng đá) lại
    const allOthers = [...resXiaomi.others, ...resThTT.others, ...resXoiChe.others];

    // --- 1. XỬ LÝ NHÓM TRẬN ĐẤU ---
    const groupedMatches = {}; 
    allMatches.forEach(ch => {
      const key = ch.matchInfo.normalized;
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
      // Sắp xếp để nhóm Truyền Hình lên đầu
      allOthers.sort((a, b) => {
        if (a.originalGroup.includes("Truyền Hình") && !b.originalGroup.includes("Truyền Hình")) return -1;
        if (!a.originalGroup.includes("Truyền Hình") && b.originalGroup.includes("Truyền Hình")) return 1;
        return 0;
      });

      allOthers.forEach(ch => {
        // Giữ nguyên group-title gốc (Truyền Hình, Phim, ...)
        // Nếu nó thuộc mấy nhóm rác không tên thì đưa vào Kênh Khác
        let finalGroup = ch.originalGroup;
        if (normalizeStr(finalGroup) === "" || normalizeStr(finalGroup).length < 2) finalGroup = "📺 Kênh Khác";
        
        let newExtinf = ch.extinf.replace(/group-title="[^"]*"/i, `group-title="${finalGroup}"`);
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    // --- 3. KÊNH TRẠNG THÁI ---
    const statusTitle = `⏱️ Trạng thái: Hoạt động bình thường`;
    parts.push(`#EXTINF:-1 group-title="${statusTitle}",Hệ thống ổn định\n${STATUS_STREAM_URL}`);

    // Ghép lại
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
