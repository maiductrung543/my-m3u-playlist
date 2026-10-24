// ============================================================
//  M3U Aggregator - Ultimate Version
//  Tính năng: Quét toàn bộ các nhóm, gom trận đấu bằng AI Logic, dọn dẹp nhóm rác.
// ============================================================

const SOURCES = {
  xiaomi: "https://tinyurl.com/vietxiaomi",
  thtt:   "https://thtt.pages.dev/tttt.m3u",
  xoiche: "https://tinyurl.com/xoiche1",
};

// Từ điển các nhà cái lậu cần chặn (nếu có link)
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

/** 
 * Hàm tạo Chìa khóa gom nhóm siêu việt
 */
function getMatchFuzzyKey(title) {
  if (!title) return null;

  // 1. Tìm phần tên trận đấu (Xóa các phần như [Giờ], (BLV), |, - ở đầu/cuối)
  let cleanTitle = title
    .replace(/\[.*?\]/g, ' ') // Xóa [18:30 - 24/10]
    .replace(/\(.*?\)/g, ' ') // Xóa (BLV Xôi Xoài)
    .replace(/\|.*/g, ' ')    // Xóa phần sau dấu |
    .trim();

  // 2. Tìm cấu trúc "Đội A vs Đội B" (hỗ trợ vs, v, -, versus)
  // Regex: Bắt lấy BẤT KỲ ký tự nào (trừ ngoặc) đứng trước và sau chữ vs/v/-
  const vsMatch = cleanTitle.match(/(.*?)\s+(?:vs\.?|v\.?|versus|-)\s+(.*)/i);
  
  if (!vsMatch) return null; // Không phải trận đấu

  let teamA = vsMatch[1].trim();
  let teamB = vsMatch[2].trim();

  // 3. Hàm làm sạch tên đội bóng
  const cleanTeamName = (name) => {
    let n = name.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Bỏ dấu tiếng Việt
      .replace(/\b(fc|cf|sc|ac|club|calcio|sporting|cd|u19|u20|u21|u23|nữ|women)\b/g, '') // Bỏ hậu tố
      .replace(/[^a-z0-9\s]/g, '') // Bỏ ký tự đặc biệt
      .replace(/\s+/g, ' ') // Gộp khoảng trắng
      .trim();
    
    // Từ điển đồng nghĩa (Synonym)
    const aliases = {
      "man city": "manchester city", "man utd": "manchester united", "man united": "manchester united",
      "wolves": "wolverhampton", "spurs": "tottenham", "newcastle utd": "newcastle",
      "west ham utd": "west ham", "nottm forest": "nottingham forest", "sheffield utd": "sheffield united",
      "psg": "paris saint germain", "bayern": "bayern munchen", "dortmund": "borussia dortmund",
      "monchengladbach": "gladbach", "inter": "inter milan", "ac milan": "milan", "juve": "juventus",
      "atletico": "atleti madrid", "atl madrid": "atleti madrid", "a madrid": "atleti madrid", "ath madrid": "atleti madrid", "athletic madrid": "atleti madrid",
      "real": "real madrid", "barca": "barcelona", "sociedad": "real sociedad", "betis": "real betis",
      "vallecano": "rayo vallecano", "elche cf": "elche", "ny red bulls": "new york red bulls"
    };
    
    // Thay thế bằng tên chuẩn nếu có trong từ điển
    Object.keys(aliases).forEach(k => {
      if (n === k || n.includes(k)) n = n.replace(k, aliases[k]);
    });

    // Lấy 4 chữ cái đầu của mỗi từ để so sánh (VD: Manchester City -> manc_city)
    return n.split(' ').map(w => w.substring(0, 4)).join('');
  };

  const keyA = cleanTeamName(teamA);
  const keyB = cleanTeamName(teamB);

  // Sắp xếp A-Z để tránh trường hợp nguồn ghi "A vs B", nguồn khác ghi "B vs A"
  const finalKey = [keyA, keyB].sort().join('_vs_');

  return {
    fuzzyKey: finalKey,
    displayName: `${teamA} vs ${teamB}` // Tên hiển thị sạch (VD: Rayo Vallecano vs Elche)
  };
}

/** 
 * Trích xuất thời gian để xóa trận cũ
 */
function isMatchExpired(title) {
  try {
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const timeMatch = title.match(/(?:\[)?(\d{1,2})[:h](\d{2}).*?(\d{1,2})[\/\-](\d{1,2})/i) || 
                      title.match(/(?:\[)?(\d{1,2})[\/\-](\d{1,2}).*?(\d{1,2})[:h](\d{2})/i);
    
    if (timeMatch) {
      let h, m, d, month;
      if (timeMatch[0].indexOf(':') < timeMatch[0].indexOf('/') || timeMatch[0].indexOf(':') < timeMatch[0].indexOf('-')) {
        h = parseInt(timeMatch[1]); m = parseInt(timeMatch[2]); d = parseInt(timeMatch[3]); month = parseInt(timeMatch[4]);
      } else {
        d = parseInt(timeMatch[1]); month = parseInt(timeMatch[2]); h = parseInt(timeMatch[3]); m = parseInt(timeMatch[4]);
      }
      const matchDate = new Date(now.getFullYear(), month - 1, d, h, m);
      if (matchDate.getMonth() < now.getMonth() - 6) matchDate.setFullYear(now.getFullYear() + 1);
      if ((now - matchDate) / (1000 * 60 * 60) > EXPIRE_HOURS) return true;
    }
  } catch (e) {}
  return false;
}

/** Xử lý & phân loại M3U */
function processM3UText(text) {
  if (!text || typeof text !== "string") return { matches: [], others: [] };

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const matches = [];
  const others = []; 
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith("#EXTINF")) {
      let originalGroup = "Kênh Khác";
      let isBlocked = false;
      
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      if (groupMatch) {
        originalGroup = groupMatch[1];
        const normGroup = originalGroup.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
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
        
        // Phân tích xem đây có phải trận bóng đá không
        const matchData = getMatchFuzzyKey(title);

        // Nếu là bóng đá VÀ chưa hết hạn
        if (matchData && !isMatchExpired(title)) {
          matches.push({ extinf: line, url: url, title: title, matchData: matchData });
        } else if (!matchData) {
          // Không phải bóng đá -> Đưa vào nhóm khác
          others.push({ extinf: line, url: url, title: title, originalGroup: originalGroup });
        }
        // (Nếu là bóng đá nhưng hết hạn thì bỏ luôn, không thêm vào mảng nào cả)
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
      fetchSafe(SOURCES.xiaomi), fetchSafe(SOURCES.thtt), fetchSafe(SOURCES.xoiche),
    ]);

    const resXiaomi = processM3UText(textXiaomi);
    const resThTT = processM3UText(textThTT);
    const resXoiChe = processM3UText(textXoiChe);

    const allMatches = [...resXiaomi.matches, ...resThTT.matches, ...resXoiChe.matches];
    const allOthers = [...resXiaomi.others, ...resThTT.others, ...resXoiChe.others];

    // --- 1. GOM NHÓM TRẬN ĐẤU ---
    const groupedMatches = {}; 
    allMatches.forEach(ch => {
      const key = ch.matchData.fuzzyKey; 
      if (!groupedMatches[key]) {
        groupedMatches[key] = { displayName: ch.matchData.displayName, streams: [] };
      }
      // Lấy thời gian (nếu có) từ kênh đầu tiên để hiển thị lên tên nhóm
      if (!groupedMatches[key].timePrefix) {
        const timeMatch = ch.title.match(/^\[(.*?)\]/);
        if (timeMatch) groupedMatches[key].timePrefix = timeMatch[1];
      }
      groupedMatches[key].streams.push(ch);
    });

    const parts = [];

    // Duyệt qua các nhóm trận đấu
    for (const key in groupedMatches) {
      const group = groupedMatches[key];
      const timeStr = group.timePrefix ? `[${group.timePrefix}] ` : '';
      const groupTitle = `⚽ ${timeStr}${group.displayName}`; 
      
      group.streams.forEach((ch) => {
        let newExtinf = ch.extinf.replace(/group-title="[^"]*"/i, `group-title="${groupTitle}"`);
        // Rút gọn tên BLV
        const blvMatch = ch.title.match(/\((.*?)\)/);
        if (blvMatch) {
           newExtinf = newExtinf.replace(/,(.*)$/, `,${blvMatch[1]}`);
        }
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    // --- 2. XỬ LÝ NHÓM TRUYỀN HÌNH / KÊNH KHÁC ---
    if (allOthers.length > 0) {
      allOthers.forEach(ch => {
        let finalGroup = ch.originalGroup;
        const normGroup = finalGroup.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Gom các nhóm rác (Vua Sân Cỏ, Khô Gà...) vào "Kênh Khác"
        // Chỉ giữ lại nhóm Truyền Hình, Phim, Sự Kiện
        if (!/truyen hinh|phim|su kien|the thao|hoat hinh|thieu nhi/i.test(normGroup)) {
           finalGroup = "📺 Kênh Khác / Sự Kiện";
        }
        
        let newExtinf = ch.extinf.replace(/group-title="[^"]*"/i, `group-title="${finalGroup}"`);
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

    // --- 3. KÊNH TRẠNG THÁI ---
    parts.push(`#EXTINF:-1 group-title="⏱️ Trạng thái",Hệ thống ổn định\n${STATUS_STREAM_URL}`);

    let combined = "#EXTM3U\n" + parts.join("\n\n");
    combined = combined.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";

    res.setHeader("Cache-Control", "no-store"); // Không cache để bạn test dễ hơn, lúc ưng thì đổi lại 300
    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.method === "HEAD") return res.status(200).end();
    res.status(200).send(combined);

  } catch (err) {
    console.error("[M3U] Lỗi:", err);
    res.status(500).send("Lỗi: " + (err?.message || "unknown"));
  }
}
