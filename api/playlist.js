// --- DANH SÁCH TỪ KHÓA CÁC ĐỘI BÓNG LỚN (Đảm bảo các trận đinh luôn lên HOT) ---
const BIG_TEAMS = [
  "real madrid", "barcelona", "atletico madrid", "bayern munchen", 
  "manchester united", "manchester city", "arsenal", "chelsea", "liverpool", "tottenham",
  "juventus", "inter milan", "milan", "napoli", "roma", "lazio",
  "paris saint germain", "borussia dortmund", "leverkusen", "rb leipzig",
  "ajax", "porto", "benfica", "psv", "galatasaray", "fenerbahce"
];

// Kiểm tra xem trận đấu có phải trận HOT không
function isHotMatch(group, apiFixtures) {
  const fullTextCheck = standardizeName(`${group.cleanA} ${group.cleanB}`);

  // 1. TỰ ĐỘNG GÁN NHẬN HOT CHO ĐỘI TUYỂN VIỆT NAM (Từ U22, U23 đến ĐTQG)
  const isVietnamTeam = /viet\s*nam|vn\b|u22\s*vietnam|u23\s*vietnam|doi\s*tuyen/i.test(fullTextCheck);
  if (isVietnamTeam) {
    return true;
  }

  // 2. KIỂM TRA TRẬN ĐẤU GIỮA 2 ĐỘI LỚN (Big Teams vs Big Teams)
  let countBigTeams = 0;
  for (const team of BIG_TEAMS) {
    if (fullTextCheck.includes(team)) {
      countBigTeams++;
    }
  }
  // Nếu cả 2 đội trong trận đều là đội lớn (ví dụ Atletico vs Bayern) -> Đảm bảo 100% lên HOT
  if (countBigTeams >= 2) {
    return true;
  }

  // 3. Fallback kiểm tra qua API Football-Data nếu có
  if (!apiFixtures || apiFixtures.length === 0) return false;
  
  for (const fix of apiFixtures) {
    const matchHome = group.cleanA.includes(fix.homeTeam) || fix.homeTeam.includes(group.cleanA);
    const matchAway = group.cleanB.includes(fix.awayTeam) || fix.awayTeam.includes(group.cleanB);
    const crossHome = group.cleanA.includes(fix.awayTeam) || fix.awayTeam.includes(group.cleanA);
    const crossAway = group.cleanB.includes(fix.homeTeam) || fix.homeTeam.includes(group.cleanB);

    if ((matchHome && matchAway) || (crossHome && crossAway)) {
      return true;
    }
  }
  return false;
}
