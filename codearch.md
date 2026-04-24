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
├── index.html            # 웹앱의 뼈대가 되는 메인 HTML (일기 + 실시간 채팅 UI)
├── index.css             # 글래스모피즘 기반의 프리미엄 UI 스타일링
├── script.js             # 프론트엔드 핵심 로직 (UI 인터랙션, Supabase 인증, 실시간 채팅)
├── vite.config.js        # Vite 번들러 환경 설정 (Vercel 환경 변수 클라이언트 노출)
├── package.json          # 프로젝트 의존성 및 스크립트 관리 (Vite 설정 등)
├── package-lock.json     # 패키지 버전 잠금 파일
├── node_modules/         # 설치된 패키지 폴더 (Git 제외)
├── api/                  # 백엔드 서버리스 함수 폴더 (Vercel 환경 지원)
│   ├── analyze.js        # Gemini API와 통신하여 일기를 분석하고 Redis에 저장
│   └── history.js        # Redis에 저장된 전체 일기 기록을 가져와 최신순으로 반환
├── lib/                  # 공통 유틸리티 및 라이브러리 설정 폴더
│   └── supabase.js       # Supabase 클라이언트 초기화 및 설정 파일
```

---

## 🔄 데이터 흐름 및 아키텍처 (Data Flow)

현재 프로젝트는 **프론트엔드 - 서버리스 백엔드 - 외부 API(Gemini & Supabase & Redis)** 구조로 이루어져 있습니다.

1. **인증 및 인가 (Frontend & Supabase)**
   - 앱 최초 진입 시 `script.js`가 Supabase 클라이언트(`lib/supabase.js`)를 통해 세션을 확인합니다.
   - 세션이 없으면 로그인 폼을 렌더링하고, 로그인/회원가입/Google 소셜 로그인을 처리합니다.
   - 세션이 존재하면(로그인 성공 시) 메인 일기장 및 실시간 채팅 컨테이너로 진입하며, 사용자 이메일을 상단에 표시합니다.

2. **실시간 채팅 (Frontend & Supabase Realtime)**
   - 사용자가 채팅 입력 시 Supabase `messages` 테이블에 데이터가 삽입됩니다(`insert`).
   - Supabase Realtime 채널(`postgres_changes`)을 통해 모든 접속자에게 즉시 메시지가 전파되어 UI가 실시간으로 업데이트됩니다.


2. **사용자 입력 (Frontend: `index.html`, `script.js`)**
   - 로그인된 사용자가 `textarea`에 일기를 작성하거나, Web Speech API를 통해 음성으로 입력합니다.
   - '분석 요청하기' 버튼을 누르면 `script.js`가 일기 내용을 가로챕니다.

3. **백엔드 요청 (Frontend -> Backend)**
   - `script.js`는 Supabase 세션에서 `access_token`을 가져와 `Authorization: Bearer <token>` 헤더에 담아 `/api/analyze`로 POST 요청을 보냅니다.

4. **백엔드 처리 및 보안 (Backend: `api/analyze.js`)**
   - 서버리스 함수는 `SUPABASE_SERVICE_ROLE_KEY`를 사용하여 관리자 클라이언트를 생성합니다.
   - 전달받은 토큰을 `supabase.auth.getUser(token)`로 검증하여 실제 사용자의 `userId`를 확보합니다. (위변조 방지)
   - 서버에 안전하게 숨겨져 있는 환경 변수 `process.env.GEMINI_API_KEY`를 꺼내옵니다.
   - 심리상담사 프롬프트 템플릿에 사용자의 일기 내용을 결합하여 실제 **Google Gemini API**로 POST 요청을 보냅니다.

5. **결과 반환 및 사용자별 저장 (Backend -> Frontend & Redis)**
   - Gemini API로부터 받은 답변을 백엔드가 정제합니다.
   - **사용자별 Redis 저장**: 백엔드는 응답을 프론트엔드로 보내기 직전, `user:[userId]:diary-YYYYMMDDHHMMSS` 키 형식으로 해당 사용자만의 일기 데이터를 영구 저장합니다.
   - 정제된 답변을 프론트엔드로 전달합니다.

6. **개인 히스토리 조회 (Frontend: `script.js` <-> Backend: `api/history.js`)**
   - 메인 화면 진입 시 `script.js`가 토큰을 담아 `/api/history`를 호출합니다.
   - 백엔드는 토큰을 검증하여 해당 사용자의 `userId`를 확인한 뒤, Redis에서 `user:[userId]:diary-*` 패턴의 키들만 조회하여 반환합니다. (타인의 일기 조회 불가능)
   - 프론트엔드는 이를 카드 형태로 렌더링하여 하단 히스토리 섹션에 표시합니다.

---
*마지막 업데이트: Supabase 로그인/회원가입 인증 도입 및 Vite 환경 설정 추가*
