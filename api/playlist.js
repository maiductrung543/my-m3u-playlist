export default async function handler(req, res) {
  const url1 = "https://tinyurl.com/vietxiaomi";      // Link 1: Xiaomi
  const url2 = "https://thtt.pages.dev/tttt.m3u";          // Link 2: THTT (Nguồn lấy thời gian cập nhật)
  const url3 = "https://tinyurl.com/xoiche1";             // Link 3: Xôi Chè

  // Danh sách từ khóa các nhóm/kênh cần ẩn
  const blockedKeywords = ["chuoichien", "saoke", "xoilac", "sutbong"];

  // Hàm chuẩn hóa: bỏ dấu tiếng Việt, viết thường, xóa khoảng trắng và ký tự đặc biệt
  function normalizeStr(str) {
    if (!str) return "";
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');
  }

  // Hàm xử lý, lọc kênh chung cho các nguồn
  function processM3UText(text) {
    if (!text) return { cleaned: "", removedCount: 0 };
    const lines = text.split('\n');
    const filteredLines = [];
    let i = 0;
    let count = 0;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Bỏ qua dòng thông tin update cũ
      if (line.includes('group-title="') && (line.toLowerCase().includes('update') || line.toLowerCase().includes('cập nhật'))) {
        i++;
        if (i < lines.length && (lines[i].startsWith('http://') || lines[i].startsWith('https://'))) {
          i++;
        }
        continue;
      }

      // Kiểm tra nếu là dòng #EXTINF (bắt đầu một kênh)
      if (line.startsWith('#EXTINF')) {
        const extinfLine = lines[i];
        let urlLine = '';
        
        let nextIndex = i + 1;
        while (nextIndex < lines.length && (lines[nextIndex].trim() === '' || lines[nextIndex].startsWith('#'))) {
          nextIndex++;
        }

        if (nextIndex < lines.length) {
          urlLine = lines[nextIndex].trim();
        }

        const normalizedExtinf = normalizeStr(extinfLine);
        const normalizedUrl = normalizeStr(urlLine);
        
        const isBlocked = blockedKeywords.some(keyword => 
          normalizedExtinf.includes(keyword) || normalizedUrl.includes(keyword)
        );

        if (isBlocked) {
          count++;
          i = nextIndex + 1;
          continue;
        } else {
          filteredLines.push(extinfLine);
          i++;
          continue;
        }
      }

      if (line !== '' && !line.startsWith('#EXTM3U')) {
        filteredLines.push(lines[i]);
      }
      i++;
    }

    return {
      cleaned: filteredLines.join('\n').trim(),
      removedCount: count
    };
  }

  try {
    const fetchSafe = async (url) => {
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!r.ok) return "";
        return await r.text();
      } catch (e) {
        return "";
      }
    };

    const [text1, text2, text3] = await Promise.all([
      fetchSafe(url1),
      fetchSafe(url2),
      fetchSafe(url3)
    ]);

    // Trích xuất chuỗi thời gian thực từ Link 2 (THTT)
    let timePart = "";
    if (text2) {
      const match = text2.match(/group-title="([^"]*)"/);
      if (match) {
        const originalTitle = match[1];
        timePart = originalTitle.replace(/^Updated\s*/i, '').trim();
      }
    }

    // Lọc bỏ các nhóm kênh bị chặn trên các nguồn
    const result1 = processM3UText(text1);
    const result2 = processM3UText(text2);
    const result3 = processM3UText(text3);

    // Tạo group-title hiển thị trạng thái kèm thời gian thực từ THTT
    const groupTitle = timePart 
      ? `⏱️ Trạng thái: Hoạt động bình thường (${timePart})` 
      : `⏱️ Trạng thái: Hoạt động bình thường`;

    const updateChannel = `#EXTINF:-1 group-title="${groupTitle}",Hệ thống đang hoạt động ổn định\nhttps://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm`;

    // Ghép nối theo thứ tự: Link 1 -> Link 3 (Xôi Chè) -> Link 2 (THTT)
    let combined = `#EXTM3U\n`;
    if (result1.cleaned) combined += result1.cleaned;
    if (result3.cleaned) combined += `\n\n` + result3.cleaned;
    if (result2.cleaned) combined += `\n\n` + result2.cleaned;
    combined += `\n\n` + updateChannel;

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(combined);
  } catch (err) {
    res.status(500).send("Lỗi khi tải danh sách: " + err.message);
  }
}
