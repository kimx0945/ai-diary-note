import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

let redis = null;

export default async function handler(req, res) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. GET 요청만 지원합니다.' });
  }

  try {
    const authHeader = req.headers.authorization;

    // 1. 사용자 인증 확인
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '인증 토큰이 누락되었습니다.' });
    }

    const token = authHeader.split(' ')[1];
    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
        return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    const userId = user.id;

    if (!redis && process.env.REDIS_URL) {
      redis = new Redis(process.env.REDIS_URL);
    }

    if (!redis) {
      return res.status(500).json({ error: 'Redis 연결 설정이 누락되었습니다.' });
    }

    // 2. 해당 사용자의 모든 일기 키 가져오기
    const keys = await redis.keys(`user:${userId}:diary-*`);

    if (keys.length === 0) {
      return res.status(200).json({ history: [] });
    }

    // 3. 값 가져오기 및 파싱
    const values = await redis.mget(keys);
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

    // 4. 최신순 정렬
    history.sort((a, b) => b.id.localeCompare(a.id));

    return res.status(200).json({ history });

  } catch (error) {
    console.error('History API 에러:', error);
    return res.status(500).json({ error: `서버 오류 상세: ${error.message}` });
  }
}
