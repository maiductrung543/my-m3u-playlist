export default async function handler(req, res) {
  const url1 = "https://tinyurl.com/vietxiaomi";
  const url2 = "https://thtt.pages.dev/tttt.m3u";

  try {
    const [res1, res2] = await Promise.all([
      fetch(url1),
      fetch(url2)
    ]);

    const text1 = await res1.text();
    const text2 = await res2.text();

    // 1. Trích xuất chuỗi thời gian gốc từ link 2 (thtt)
    const match = text2.match(/group-title="([^"]*)"/);
    let updateTimeStr = "Cập Nhật";
    let cleanText2 = text2;

    if (match) {
      const originalTitle = match[1]; // Ví dụ: "Updated 18/10 09:24"
      // Giữ nguyên chuỗi thời gian gốc, thay thế chữ Updated bằng Cập Nhật lúc
      const timePart = originalTitle.replace(/^Updated\s*/i, '');
      updateTimeStr = `Cập Nhật lúc ${timePart}`;

      // Loại bỏ dòng update cũ khỏi text2 để tránh bị trùng lặp hiển thị
      const lines = text2.split('\n');
      const filteredLines = [];
      let skipNext = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('group-title="') && (lines[i].toLowerCase().includes('update') || lines[i].toLowerCase().includes('cập nhật'))) {
          skipNext = true;
          continue;
        }
        if (skipNext && (lines[i].startsWith('http://') || lines[i].startsWith('https://') || lines[i].trim() === '')) {
          skipNext = false;
          continue;
        }
        skipNext = false;
        filteredLines.push(lines[i]);
      }
      cleanText2 = filteredLines.join('\n').trim();
    }

    // 2. Tạo kênh hiển thị trạng thái hoạt động bình thường với link video mới
    const updateChannel = `#EXTINF:-1 group-title="${updateTimeStr}",⏱️ Trạng thái: Hoạt động bình thường\nhttps://www.shutterstock.com/ent-static-assets/videos/video_mini_generator_result_2.webm`;

    // 3. Ghép nối danh sách: Đưa dòng Cập Nhật xuống CUỐI CÙNG
    let combined = `#EXTM3U\n` + text1.trim();
    if (cleanText2) {
      combined += `\n\n` + cleanText2;
    }
    combined += `\n\n` + updateChannel;

    // Lưu cache 15 phút (900 giây) - Tối ưu tốc độ và chống nghẽn
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(combined);
  } catch (err) {
    res.status(500).send("Lỗi khi tải danh sách: " + err.message);
  }
}
