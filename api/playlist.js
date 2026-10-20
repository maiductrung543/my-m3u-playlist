// ============================================================
//  M3U Aggregator - Vercel Serverless Function
//  Nguồn: Xiaomi + Xôi Chè + THTT
//  Cache: 5 phút (CDN + browser)
// ============================================================

const SOURCES = {
  xiaomi: "https://tinyurl.com/vietxiaomi",
  thtt:   "https://thtt.pages.dev/tttt.m3u",
  xoiche: "https://tinyurl.com/xoiche1",
};

// Từ khóa chặn (Đã chuẩn hóa, không dấu, viết thường, không khoảng trắng)
// CHỈ tìm kiếm trong phần group-title (Tên nhóm), không tìm ở tên kênh hay link
const BLOCKED_GROUP_KEYWORDS = [
  "chuoichien", 
  "saoke", 
  "xoilac", 
  "sutbong", 
  "phalangtv", 
  "xoigactv", 
  "colatv", 
  "gavang24htv", 
  "gavang33tv"
];

const STATUS_STREAM_URL =
  "https://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const FETCH_TIMEOUT = 8000;

// ============================================================
//  Helpers
// ============================================================

/** Chuẩn hóa chuỗi: bỏ dấu tiếng Việt, lowercase, bỏ ký tự đặc biệt */
function normalizeStr(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Fetch an toàn */
async function fetchSafe(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "*/*",
        "Accept-Language": "vi,en;q=0.9",
      },
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

/** Xử lý & lọc nội dung M3U (Chỉ lọc theo Group) */
function processM3UText(text) {
  const stats = { total: 0, removed: 0, kept: 0 };
  if (!text || typeof text !== "string") {
    return { cleaned: "", stats };
  }

  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Bỏ block "update/cập nhật" cũ
    if (
      line.includes('group-title="') &&
      /update|cập nhật|cap nhat/i.test(line)
    ) {
      i++;
      if (i < lines.length && /^https?:\/\//i.test(lines[i].trim())) i++;
      continue;
    }

    // Bắt đầu kênh
    if (line.startsWith("#EXTINF")) {
      stats.total++;

      // Tìm dòng URL thật
      let urlIdx = i + 1;
      while (urlIdx < lines.length) {
        const t = lines[urlIdx].trim();
        if (t === "" || t.startsWith("#")) {
          urlIdx++;
          continue;
        }
        break;
      }

      if (urlIdx >= lines.length) {
        stats.removed++;
        i = urlIdx;
        continue;
      }

      const block = lines.slice(i, urlIdx + 1);

      // --- LOGIC LỌC: CHỈ LẤY group-title ĐỂ KIỂM TRA ---
      let isBlocked = false;
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      
      if (groupMatch) {
        const normalizedGroup = normalizeStr(groupMatch[1]);
        isBlocked = BLOCKED_GROUP_KEYWORDS.some((kw) => normalizedGroup.includes(kw));
      }

      if (isBlocked) {
        stats.removed++;
      } else {
        out.push(...block);
        stats.kept++;
      }

      i = urlIdx + 1;
      continue;
    }

    // Dòng rời
    if (line !== "" && !line.startsWith("#EXTM3U")) {
      out.push(rawLine);
    }
    i++;
  }

  return {
    cleaned: out.join("\n").trim(),
    stats,
  };
}

/** Lấy thời gian cập nhật từ nội dung THTT */
function extractTimePart(text) {
  if (!text) return "";
  const m =
    text.match(/group-title="([^"]*(?:Updated|Cập nhật|Cap nhat)[^"]*)"/i) ||
    text.match(/group-title="([^"]*\d{1,2}[:h]\d{2}[^"]*)"/i);
  if (!m) return "";
  return m[1]
    .replace(/^Updated\s*[:\-]?\s*/i, "")
    .replace(/^Cập nhật\s*[:\-]?\s*/i, "")
    .trim();
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "'").replace(/\n/g, " ").trim();
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
    const [text1, text2, text3] = await Promise.all([
      fetchSafe(SOURCES.xiaomi),
      fetchSafe(SOURCES.thtt),
      fetchSafe(SOURCES.xoiche),
    ]);

    const timePart = extractTimePart(text2);

    const r1 = processM3UText(text1);
    const r2 = processM3UText(text2);
    const r3 = processM3UText(text3);

    const statusTitle = timePart
      ? `⏱️ Trạng thái: Hoạt động bình thường (${escapeAttr(timePart)})`
      : `⏱️ Trạng thái: Hoạt động bình thường`;

    const statusChannel =
      `#EXTINF:-1 group-title="${statusTitle}",Hệ thống đang hoạt động ổn định\n` +
      STATUS_STREAM_URL;

    const parts = [];
    if (r1.cleaned) parts.push(r1.cleaned);
    if (r3.cleaned) parts.push(r3.cleaned);
    if (r2.cleaned) parts.push(r2.cleaned);
    parts.push(statusChannel);

    let combined = "#EXTM3U\n" + parts.join("\n\n");
    combined = combined
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!combined.endsWith("\n")) combined += "\n";

    console.log(
      `[M3U] Xiaomi=${r1.stats.kept}/${r1.stats.total}, ` +
        `XôiChè=${r3.stats.kept}/${r3.stats.total}, ` +
        `THTT=${r2.stats.kept}/${r2.stats.total}, ` +
        `time="${timePart || "N/A"}", ` +
        `size=${combined.length}B`
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
    );
    res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Vary", "Accept-Encoding");

    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }

    res.status(200).send(combined);
  } catch (err) {
    console.error("[M3U] Lỗi:", err);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(500).send("Lỗi khi tải danh sách: " + (err?.message || "unknown"));
  }
}
