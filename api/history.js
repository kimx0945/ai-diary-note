import Redis from 'ioredis';

let redis = null;

export default async function handler(req, res) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. GET 요청만 지원합니다.' });
  }

  try {
    if (!redis && process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL);
    }

    if (!redis) {
      return res.status(500).json({ error: 'Redis 연결 설정이 누락되었습니다.' });
    }

    // 1. 'diary-*' 패턴의 모든 키 가져오기
    const keys = await redis.keys('diary-*');

    if (keys.length === 0) {
      return res.status(200).json({ history: [] });
    }

    // 2. 모든 키에 해당하는 값 가져오기
    const values = await redis.mget(keys);

    // 3. 데이터 파싱 및 가공
    const history = keys.map((key, index) => {
      try {
        const parsed = JSON.parse(values[index]);
        return {
          id: key,
          ...parsed
        };
      } catch (e) {
        return null;
      }
    }).filter(item => item !== null);

    // 4. 최신순 정렬 (ID가 diary-YYYYMMDDHHMMSS 형식이므로 문자열 역순 정렬)
    history.sort((a, b) => b.id.localeCompare(a.id));

    return res.status(200).json({ history });

  } catch (error) {
    console.error('History API 에러:', error);
    return res.status(500).json({ error: `서버 오류 상세: ${error.message}` });
  }
}
