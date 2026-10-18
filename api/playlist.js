export default async function handler(req, res) {
  const url1 = "https://tinyurl.com/vietxiaomi";
  const url2 = "https://thtt.pages.dev/tttt.m3u";

  // Danh sách từ khóa các nhóm/kênh cần ẩn (đã bỏ Phá Làng)
  const blockedKeywords = ["chuoichien", "saoke", "xoilac", "sutbong"];

  // Hàm chuẩn hóa: bỏ dấu tiếng Việt, viết thường, xóa khoảng trắng và ký tự đặc biệt
  function normalizeStr(str) {
    if (!str) return "";
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');
  }

  try {
    const [res1, res2] = await Promise.all([
      fetch(url1),
      fetch(url2)
    ]);

    if (!res1.ok || !res2.ok) {
      throw new Error(`Không thể tải dữ liệu từ nguồn (Status: ${res1.status}, ${res2.status})`);
    }

    const text1 = await res1.text();
    const text2 = await res2.text();

    // 1. Trích xuất chuỗi thời gian gốc từ link 2 (thtt)
    const match = text2.match(/group-title="([^"]*)"/);
    let updateTimeStr = "Cập Nhật";
    let cleanText2 = text2;

    if (match) {
      const originalTitle = match[1];
      const timePart = originalTitle.replace(/^Updated\s*/i, '');
      updateTimeStr = `Cập Nhật lúc ${timePart}`;
    }

    // 2. Xử lý và lọc bỏ các nhóm kênh bị chặn bằng bộ lọc chuẩn hóa
    const lines = text2.split('\n');
    const filteredLines = [];
    let i = 0;
    let removedCount = 0;

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
        
        // Tìm dòng URL tiếp theo của kênh này
        let nextIndex = i + 1;
        while (nextIndex < lines.length && (lines[nextIndex].trim() === '' || lines[nextIndex].startsWith('#'))) {
          nextIndex++;
        }

        if (nextIndex < lines.length) {
          urlLine = lines[nextIndex].trim();
        }

        // Chuẩn hóa dòng EXTINF và URL để so khớp bất chấp dấu, khoảng trắng, viết hoa/thường
        const normalizedExtinf = normalizeStr(extinfLine);
        const normalizedUrl = normalizeStr(urlLine);
        
        const isBlocked = blockedKeywords.some(keyword => 
          normalizedExtinf.includes(keyword) || normalizedUrl.includes(keyword)
        );

        if (isBlocked) {
          removedCount++;
          // Nhảy cóc qua cả cụm kênh này (bỏ qua cả #EXTINF và URL của nó)
          i = nextIndex + 1;
          continue;
        } else {
          // Giữ lại kênh bình thường
          filteredLines.push(extinfLine);
          i++;
          continue;
        }
      }

      // Giữ lại các dòng hợp lệ khác (trừ thẻ #EXTM3U thừa)
      if (line !== '' && !line.startsWith('#EXTM3U')) {
        filteredLines.push(lines[i]);
      }
      i++;
    }

    cleanText2 = filteredLines.join('\n').trim();

    // 3. Tạo kênh hiển thị trạng thái kèm số lượng kênh đã ẩn
    const statusText = removedCount > 0 
      ? `⏱️ Trạng thái: Hoạt động bình thường (Đã ẩn ${removedCount} kênh)` 
      : `⏱️ Trạng thái: Hoạt động bình thường`;

    const updateChannel = `#EXTINF:-1 group-title="${updateTimeStr}",${statusText}\nhttps://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm`;

    // 4. Ghép nối toàn bộ danh sách
    let combined = `#EXTM3U\n` + text1.trim();
    if (cleanText2) {
      combined += `\n\n` + cleanText2;
    }
    combined += `\n\n` + updateChannel;

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(combined);
  } catch (err) {
    res.status(500).send("Lỗi khi tải danh sách: " + err.message);
  }
}
