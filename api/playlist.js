export default async function handler(req, res) {
  const url1 = "https://tinyurl.com/vietxiaomi";
  const url2 = "https://thtt.pages.dev/tttt.m3u";

  // Hàm fetch có Timeout để chống treo API
  async function fetchWithTimeout(resource, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      return null;
    }
  }

  try {
    // Kéo dữ liệu song song với Timeout 5 giây cho mỗi nguồn
    const results = await Promise.allSettled([
      fetchWithTimeout(url1, {}, 5000),
      fetchWithTimeout(url2, {}, 5000),
      fetchWithTimeout("https://xoiche.live", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      }, 5000)
    ]);

    const res1 = results[0].status === 'fulfilled' ? results[0].value : null;
    const res2 = results[1].status === 'fulfilled' ? results[1].value : null;
    const xoicheRes = results[2].status === 'fulfilled' ? results[2].value : null;

    const text1 = (res1 && res1.ok) ? await res1.text().catch(() => "") : "";
    const text2 = (res2 && res2.ok) ? await res2.text().catch(() => "") : "";

    const hotMatchesArray = [];
    const normalChannelsList = [];

    const HOT_LEAGUES_AND_TEAMS = [
      "PREMIER LEAGUE", "NGOẠI HẠNG ANH", "CHAMPIONS LEAGUE", "CÚP C1", 
      "EUROPA LEAGUE", "CÚP C2", "LA LIGA", "SERIE A", "BUNDESLIGA", "LIGUE 1", 
      "V-LEAGUE", "V.LEAGUE", "WORLD CUP", "EURO", "ASIAN CUP", "AFF CUP", "ASEAN CUP",
      "MANCHESTER UNITED", "MAN UTD", "MU", "MANCHESTER CITY", "MAN CITY", "LIVERPOOL", 
      "ARSENAL", "CHELSEA", "REAL MADRID", "BARCELONA", "BARCA", "BAYERN", "PSG", 
      "JUVENTUS", "INTER", "AC MILAN", "ROMA", "ATLETICO", "DORTMUND"
    ];
