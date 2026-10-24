// ============================================================
//  M3U Aggregator - Vercel Serverless Function (SMART GROUPING & AUTO-CLEAN)
//  Nguồn: Xôi Chè + THTT (Bỏ qua Xiaomi)
//  Tính năng: Gom nhóm theo Trận Đấu, tự động xóa trận cũ quá 2 tiếng.
// ============================================================

const SOURCES = {
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
const EXPIRE_HOURS = 2; // Số giờ tối đa để giữ trận đấu

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
 * Ví dụ: "[18:30 - 24/10] Aston Villa VS Manchester City (BLV Xôi Xoài)"
 * Trả về: { displayName: "...", normalized: "...", isExpired: true/false }
 */
function extractMatchInfo(title) {
  if (!title) return null;
  
  // Regex bắt phần [Ngày - Giờ] và Tên Trận
  const match = title.match(/^(\[.*?\]\s*.*?)\s*\(/);
  if (!match) return null;

  let displayName = match[1].trim(); 
  let matchName = displayName;

  const bracketMatch = matchName.match(/^\[.*?\]\s*(.*)$/);
  if (bracketMatch) {
    matchName = bracketMatch[1];
  }

  let normalized = matchName.toLowerCase().replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/\s+(v|vs|versus|-)\s+/g, ' vs ');

  // --- LOGIC KIỂM TRA THỜI GIAN ---
  let isExpired = false;
  try {
    // Lấy giờ Việt Nam (UTC+7)
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    
    // Trích xuất ngày và giờ từ tên (VD: [18:30 - 24/10])
    // Tìm cụm dạng "HH:mm - DD/MM" hoặc "DD/MM - HH:mm" hoặc chỉ "HH:mm"
    const timeMatch = displayName.match(/(?:\[)?(\d{1,2})[:h](\d{2}).*?(\d{1,2})[\/\-](\d{1,2})/i) || 
                      displayName.match(/(?:\[)?(\d{1,2})[\/\-](\d{1,2}).*?(\d{1,2})[:h](\d{2})/i);
    
    if (timeMatch) {
      let h, m, d, month;
      // Kiểm tra xem giờ đứng trước hay ngày đứng trước
      if (timeMatch[0].indexOf(':') < timeMatch[0].indexOf('/') || timeMatch[0].indexOf(':') < timeMatch[0].indexOf('-')) {
        h = parseInt(timeMatch[1]); m = parseInt(timeMatch[2]);
        d = parseInt(timeMatch[3]); month = parseInt(timeMatch[4]);
      } else {
        d = parseInt(timeMatch[1]); month = parseInt(timeMatch[2]);
        h = parseInt(timeMatch[3]); m = parseInt(timeMatch[4]);
      }

      // Tạo đối tượng Date cho trận đấu (dựa trên năm hiện tại)
      const matchDate = new Date(now.getFullYear(), month - 1, d, h, m);
      
      // Nếu trận đấu ở tương lai xa (VD: tháng 12 năm nay lấy giờ tháng 1), xử lý qua năm sau
      if (matchDate.getMonth() < now.getMonth() - 6) matchDate.setFullYear(now.getFullYear() + 1);
      
      // Tính khoảng cách thời gian (mili-giây)
      const diffMs = now - matchDate;
      const diffHours = diffMs / (1000 * 60 * 60);

      // Nếu trận đấu đã diễn ra quá EXPIRE_HOURS tiếng -> Xóa
      if (diffHours > EXPIRE_HOURS) {
        isExpired = true;
      }
    }
  } catch (e) {
    // Bỏ qua lỗi parse thời gian, coi như không hết hạn
    console.error("Lỗi parse thời gian:", e);
  }

  return {
    displayName: displayName,
    normalized: normalized,
    isExpired: isExpired
  };
}

/** Xử lý & lọc nội dung M3U */
function processM3UText(text) {
  if (!text || typeof text !== "string") return [];

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const channels = [];
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
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      if (groupMatch) {
        const normGroup = normalizeStr(groupMatch[1]);
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

        // Nếu là kênh bóng đá và đã quá 2 tiếng -> Không thêm vào danh sách
        if (matchInfo && matchInfo.isExpired) {
          i = urlIdx + 1;
          continue; 
        }

        channels.push({
          extinf: line,
          url: url,
          title: title,
          matchInfo: matchInfo 
        });
      }
      i = urlIdx + 1;
      continue;
    }
    i++;
  }
  return channels;
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
    const [textThTT, textXoiChe] = await Promise.all([
      fetchSafe(SOURCES.thtt),
      fetchSafe(SOURCES.xoiche),
    ]);

    const allChannels = [
      ...processM3UText(textThTT),
      ...processM3UText(textXoiChe)
    ];

    const groupedMatches = {}; 
    const otherChannels = []; 

    allChannels.forEach(ch => {
      if (ch.matchInfo) {
        const key = ch.matchInfo.normalized;
        if (!groupedMatches[key]) {
          groupedMatches[key] = {
            displayName: ch.matchInfo.displayName, 
            streams: []
          };
        }
        groupedMatches[key].streams.push(ch);
      } else {
        otherChannels.push(ch);
      }
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

    if (otherChannels.length > 0) {
      otherChannels.forEach(ch => {
        let newExtinf = ch.extinf.replace(/group-title="[^"]*"/i, `group-title="📺 Kênh Khác / Sự Kiện"`);
        parts.push(`${newExtinf}\n${ch.url}`);
      });
    }

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
