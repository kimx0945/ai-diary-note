# 프로젝트 아키텍처 및 구조 (Code Architecture)

🔗 **GitHub Repository**: [https://github.com/kimx0945/ai-diary-note](https://github.com/kimx0945/ai-diary-note)

이 파일은 'AI 감성 일기' 웹앱의 전체적인 파일 구조와 데이터 흐름을 명세합니다.
프로젝트의 구조가 변경될 때마다 이 파일도 함께 업데이트됩니다.

## 📂 디렉토리 구조 (Directory Structure)

```text
DAY_5/
├── .env                  # 환경 변수 파일 (Vercel 배포 시 설정할 GEMINI_API_KEY 저장, Git 제외)
├── .gitignore            # Git 버전 관리에서 제외할 파일 목록
├── changelog.md          # 프로젝트 변경 이력 기록 파일
├── codearch.md           # 현재 파일 (프로젝트 아키텍처 명세서)
├── index.html            # 웹앱의 뼈대가 되는 메인 HTML 구조
├── index.css             # 글래스모피즘 기반의 프리미엄 UI 스타일링
├── script.js             # 프론트엔드 핵심 로직 (UI 인터랙션, 로컬 스토리지 관리, 백엔드 통신)
├── package.json          # 프로젝트 의존성 및 스크립트 관리 (Vite 설정 등)
├── package-lock.json     # 패키지 버전 잠금 파일
├── node_modules/         # 설치된 패키지 폴더 (Git 제외)
└── api/                  # 백엔드 서버리스 함수 폴더 (Vercel 환경 지원)
    └── analyze.js        # Gemini API와 직접 통신하여 일기를 분석하는 백엔드 코어 로직
```

---

## 🔄 데이터 흐름 및 아키텍처 (Data Flow)

현재 프로젝트는 **프론트엔드 - 서버리스 백엔드 - 외부 API(Gemini)** 의 3계층(3-Tier) 구조로 이루어져 있습니다.

1. **사용자 입력 (Frontend: `index.html`, `script.js`)**
   - 사용자가 `textarea`에 일기를 작성하거나, Web Speech API를 통해 음성으로 입력합니다.
   - '분석 요청하기' 버튼을 누르면 `script.js`가 일기 내용을 가로챕니다.

2. **백엔드 요청 (Frontend -> Backend)**
   - `script.js`는 외부로 직접 통신하지 않고, 내부 백엔드 주소인 `/api/analyze`로 POST 요청을 보냅니다. (이때 일기 데이터를 JSON으로 담아 보냅니다.)

3. **백엔드 처리 (Backend: `api/analyze.js`)**
   - Vercel 서버리스 함수인 `analyze.js`가 요청을 받습니다.
   - 서버에 안전하게 숨겨져 있는 환경 변수 `process.env.GEMINI_API_KEY`를 꺼내옵니다.
   - 심리상담사 프롬프트 템플릿에 사용자의 일기 내용을 결합하여 실제 **Google Gemini API**로 POST 요청을 보냅니다.

4. **결과 반환 및 저장 (Backend -> Frontend & Redis)**
   - Gemini API로부터 받은 답변을 백엔드가 정제합니다.
   - **(NEW) Redis 저장**: 백엔드는 응답을 프론트엔드로 보내기 직전, Vercel Serverless Redis에 `diary-YYYYMMDDHHMMSS` 키 형식으로 일기 내용과 AI 답변을 영구 저장합니다.
   - 정제된 답변을 프론트엔드(`script.js`)로 전달합니다.
   - `script.js`는 전달받은 답변을 화면(`aiResponse`)에 표시하고, 동시에 브라우저의 `localStorage`에도 임시 저장합니다.

5. **히스토리 조회 (Frontend: `script.js` <-> Backend: `api/history.js`)**
   - 페이지가 로드되면 `script.js`가 `/api/history`를 호출합니다.
   - 백엔드는 Redis에서 모든 `diary-*` 키를 찾아 데이터를 반환합니다.
   - 프론트엔드는 이를 카드 형태로 렌더링하여 하단 히스토리 섹션에 표시합니다.

---
*마지막 업데이트: 일기 히스토리 조회 기능(`api/history.js`) 및 UI 반영 완료*
