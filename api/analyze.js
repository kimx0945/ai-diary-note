import Redis from 'ioredis';

// 서버리스 함수 외부에서 클라이언트를 선언하여 재사용 (Connection Pooling 지원)
let redis = null;

export default async function handler(req, res) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST 요청만 지원합니다.' });
  }

  try {
    const { diaryContent } = req.body;

    if (!diaryContent) {
      return res.status(400).json({ error: '일기 내용이 전달되지 않았습니다.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.' });
    }

    // 1. Gemini API 호출
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `너는 따뜻한 심리상담사야. 사용자가 작성한 일기를 읽고, 다음 형식을 엄격하게 지켜서 답변해줘.\n\n감정: [기쁨, 슬픔, 분노, 불안, 평온 등 감정을 나타내는 한 단어]\n\n[여기에 사용자의 감정에 공감하고 위로하는 2~3문단의 따뜻한 응원 메시지 작성]\n\n사용자 일기: ${diaryContent}`
                }]
            }]
        })
    });

    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error.message);
    }

    const aiText = data.candidates[0].content.parts[0].text;

    // 2. Redis에 저장
    try {
      if (!redis && process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL);
      }

      if (redis) {
        const now = new Date();
        // KST(UTC+9) 기준으로 타임스탬프 생성
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(now.getTime() + kstOffset);
        
        const timestamp = kstDate.toISOString()
          .replace(/[-T:Z]/g, '')
          .slice(0, 14);
        
        const key = `diary-${timestamp}`;
        const diaryData = {
          diaryContent,
          aiResponse: aiText,
          createdAt: now.toISOString()
        };

        await redis.set(key, JSON.stringify(diaryData));
        console.log(`Successfully saved to Redis: ${key}`);
      }
    } catch (redisError) {
      console.error('Redis 저장 실패:', redisError);
    }

    return res.status(200).json({ result: aiText });

  } catch (error) {
    console.error('서버 에러:', error);
    return res.status(500).json({ error: `서버 오류 상세: ${error.message}` });
  }
}
