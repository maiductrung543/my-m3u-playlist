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

    const combined = text1.trim() + "\n\n" + text2.trim();

    // Thiết lập Header cho M3U và CORS
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(combined);
  } catch (err) {
    res.status(500).send("Lỗi khi tải danh sách: " + err.message);
  }
}
