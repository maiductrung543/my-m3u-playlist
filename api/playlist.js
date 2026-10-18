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

    // 1. Lấy thời gian thực theo giờ Việt Nam (UTC+7)
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const day = String(vietnamTime.getUTCDate()).padStart(2, '0');
    const month = String(vietnamTime.getUTCMonth() + 1).padStart(2, '0');
    const hours = String(vietnamTime.getUTCHours()).padStart(2, '0');
    const minutes = String(vietnamTime.getUTCMinutes()).padStart(2, '0');
    
    // 2. Định dạng chuỗi theo đúng yêu cầu của bạn
    const updateTimeStr = `Cập Nhật lúc ${hours}:${minutes} ${day}/${month}`;

    // 3. Tạo kênh giả lập hiển thị làm nhóm phân loại trên ứng dụng IPTV
    const updateChannel = `#EXTINF:-1 group-title="${updateTimeStr}",⏱️ Trạng thái: Hoạt động bình thường\nhttp://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4`;

    // 4. Ghép nối danh sách (Đưa dòng cập nhật lên đầu danh sách)
    const combined = `#EXTM3U\n` + updateChannel + `\n\n` + text1.trim() + `\n\n` + text2.trim();

    // Lưu cache 15 phút (900 giây) - Tối ưu tốc độ và chống nghẽn
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(combined);
  } catch (err) {
    res.status(500).send("Lỗi khi tải danh sách: " + err.message);
  }
}
