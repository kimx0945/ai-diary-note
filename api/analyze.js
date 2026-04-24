export default async function handler(req, res) {
  // CORS 처리 (클라이언트에서 호출 가능하도록 설정)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 사전 요청(Preflight) 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST 요청만 지원합니다.' });
  }

  try {
    // 1. 클라이언트로부터 일기 내용 가져오기
    const { diaryContent } = req.body;

    if (!diaryContent) {
      return res.status(400).json({ error: '일기 내용이 전달되지 않았습니다.' });
    }

    // 2. 환경 변수에서 Gemini API 키 가져오기 (Vercel 설정에서 추가)
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.' });
    }

    // 3. 실제 Gemini API 호출 로직
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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

    // 4. 분석 결과를 클라이언트로 돌려주기
    return res.status(200).json({ result: aiText });

  } catch (error) {
    console.error('서버 에러:', error);
    return res.status(500).json({ error: `서버 오류 상세: ${error.message}` });
  }
}
