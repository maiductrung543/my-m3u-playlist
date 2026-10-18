export default async function handler(req, res) {
  const url1 = "https://tinyurl.com/vietxiaomi";
  const url2 = "https://tinyurl.com/xoiche1"; // Link mới thêm vào
  const url3 = "https://thtt.pages.dev/tttt.m3u"; // Link cũ chuyển thành link 3

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
    const [res1, res2, res3] = await Promise.all([
      fetch(url1),
      fetch(url2),
      fetch(url3)
    ]);

    if (!res1.ok || !res2.ok || !res3.ok) {
      throw new Error(`Không thể tải dữ liệu từ nguồn (Status: ${res1.status}, ${res2.status}, ${res3.status})`);
    }

    const text1 = await res1.text();
    const text2 = await res2.text();
    const text3 = await res3.text();

    // 1. Trích xuất chuỗi thời gian gốc từ link 3 (thtt)
    const match = text3.match(/group-title="([^"]*)"/);
    let updateTimeStr = "Cập Nhật";

    if (match) {
      const originalTitle = match[1];
      const timePart = originalTitle.replace(/^Updated\s*/i, '');
      updateTimeStr = `Cập Nhật lúc ${timePart}`;
    }

    // 2. Lọc bỏ các nhóm kênh bị chặn trên cả 3 nguồn
    const result1 = processM3UText(text1);
    const result2 = processM3UText(text2);
    const result3 = processM3UText(text3);

    const totalRemoved = result1.removedCount + result2.removedCount + result3.removedCount;

    // 3. Tạo kênh hiển thị trạng thái kèm tổng số lượng kênh đã ẩn
    const statusText = totalRemoved > 0 
      ? `⏱️ Trạng thái: Hoạt động bình thường (Đã ẩn ${totalRemoved} kênh)` 
      : `⏱️ Trạng thái: Hoạt động bình thường`;

    const updateChannel = `#EXTINF:-1 group-title="${updateTimeStr}",${statusText}\nhttps://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm`;

    // 4. Ghép nối toàn bộ danh sách theo đúng thứ tự (Link 1 -> Link mới -> Link 3)
    let combined = `#EXTM3U\n`;
    if (result1.cleaned) combined += result1.cleaned;
    if (result2.cleaned) combined += `\n\n` + result2.cleaned;
    if (result3.cleaned) combined += `\n\n` + result3.cleaned;
    combined += `\n\n` + updateChannel;

    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(combined);
  } catch (err) {
    res.status(500).send("Lỗi khi tải danh sách: " + err.message);
  }
}
