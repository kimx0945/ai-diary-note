import { supabase } from './lib/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Elements
    const loginContainer = document.getElementById('loginContainer');
    const appContainer = document.getElementById('appContainer');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const authErrorMsg = document.getElementById('authErrorMsg');
    const userEmailElement = document.getElementById('userEmail');

    const diaryInput = document.getElementById('diaryInput');
    const voiceBtn = document.getElementById('voiceBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const aiResponse = document.getElementById('aiResponse');

    // Chat Elements
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');

    
    // Auth Logic
    let currentToken = null;

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentToken = session.access_token;
        showApp(session);
    } else {
        showLogin();
    }

    supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
            currentToken = session.access_token;
            showApp(session);
        } else {
            currentToken = null;
            showLogin();
        }
    });

    function showApp(currentSession) {
        if (currentSession && currentSession.user) {
            userEmailElement.textContent = currentSession.user.email;
        }
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        loadHistory();
        initChat(currentSession);
    }

    function showLogin() {
        loginContainer.style.display = 'block';
        appContainer.style.display = 'none';
    }

    function showError(msg, isSuccess = false) {
        authErrorMsg.textContent = msg;
        authErrorMsg.style.display = 'block';
        if (isSuccess) {
            authErrorMsg.style.color = '#34d399';
            authErrorMsg.style.backgroundColor = 'rgba(52, 211, 153, 0.1)';
            authErrorMsg.style.borderColor = 'rgba(52, 211, 153, 0.2)';
        } else {
            authErrorMsg.style.color = '#fca5a5';
            authErrorMsg.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            authErrorMsg.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        }
    }

    loginBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        if (!email || !password) return showError('이메일과 비밀번호를 입력해주세요.');

        loginBtn.innerHTML = '처리 중...';
        loginBtn.disabled = true;

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        
        loginBtn.innerHTML = '로그인';
        loginBtn.disabled = false;

        if (error) showError(error.message);
    });

    signupBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        if (!email || !password) return showError('이메일과 비밀번호를 입력해주세요.');

        signupBtn.innerHTML = '처리 중...';
        signupBtn.disabled = true;

        const { error } = await supabase.auth.signUp({ email, password });
        
        signupBtn.innerHTML = '회원가입';
        signupBtn.disabled = false;

        if (error) showError(error.message);
        else showError('가입 확인 이메일을 확인해주세요!', true);
    });

    googleLoginBtn.addEventListener('click', async () => {
        const { error } = await supabase.auth.signInWithOAuth({ 
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) showError(error.message);
    });

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
    });


    // 저장된 데이터 불러오기
    const savedDiary = localStorage.getItem('savedDiary');
    const savedAiResponse = localStorage.getItem('savedAiResponse');

    if (savedDiary) {
        diaryInput.value = savedDiary;
    }

    if (savedAiResponse) {
        aiResponse.innerText = savedAiResponse;
        aiResponse.classList.add('active');
        aiResponse.style.whiteSpace = 'pre-wrap';
    }

    const historyList = document.getElementById('historyList');

    // 히스토리 불러오기 및 렌더링
    async function loadHistory() {
        try {
            const fetchHeaders = {};
            if (currentToken) {
                fetchHeaders['Authorization'] = `Bearer ${currentToken}`;
            }

            const response = await fetch('/api/history', {
                headers: fetchHeaders
            });
            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || '히스토리를 불러오지 못했습니다.');
            }

            const history = data.history;

            if (history.length === 0) {
                historyList.innerHTML = '<p class="empty-msg">저장된 일기가 없습니다.</p>';
                return;
            }

            historyList.innerHTML = history.map(item => {
                // ID에서 날짜 추출 (기존: diary-YYYYMMDDHHMMSS, 변경: user:[userId]:diary-YYYYMMDDHHMMSS)
                const ts = item.id.split('diary-')[1];
                const formattedDate = ts ? `${ts.slice(0, 4)}년 ${ts.slice(4, 6)}월 ${ts.slice(6, 8)}일 ${ts.slice(8, 10)}: ${ts.slice(10, 12)}` : '날짜 정보 없음';

                return `
                    <div class="history-card">
                        <div class="date">${formattedDate}</div>
                        <div class="content">${item.diaryContent}</div>
                        <div class="response">${item.aiResponse}</div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('History Fetch Error:', error);
            historyList.innerHTML = `<p class="empty-msg" style="color: #fca5a5;">기록을 가져오는데 실패했습니다: ${error.message}</p>`;
        }
    }

    // --- Chat Logic ---
    let chatChannel = null;

    async function initChat(session) {
        if (!session) return;
        
        // 1. 기존 메시지 불러오기 (최근 50개)
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(50);

        if (error) {
            console.error('Chat load error:', error);
            chatMessages.innerHTML = '<p class="empty-msg">메시지를 불러오지 못했습니다.</p>';
        } else {
            chatMessages.innerHTML = '';
            messages.forEach(msg => appendMessage(msg, session.user.id));
            scrollToBottom();
        }

        // 2. 실시간 구독 설정
        if (chatChannel) supabase.removeChannel(chatChannel);

        chatChannel = supabase
            .channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                appendMessage(payload.new, session.user.id);
                scrollToBottom();
            })
            .subscribe();
    }

    function appendMessage(msg, currentUserId) {
        const isOwn = msg.user_id === currentUserId;
        const msgDiv = document.createElement('div');
        msgDiv.className = `message-item ${isOwn ? 'own' : 'others'}`;
        
        const userEmail = msg.user_email || '알 수 없는 사용자';
        
        msgDiv.innerHTML = `
            <div class="message-user">${isOwn ? '나' : userEmail}</div>
            <div class="message-text">${msg.content}</div>
        `;
        
        chatMessages.appendChild(msgDiv);
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendChatMessage() {
        const content = chatInput.value.trim();
        if (!content) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('messages').insert([
            { 
                content: content, 
                user_id: user.id,
                user_email: user.email
            }
        ]);

        if (error) {
            console.error('Send error:', error);
            alert('메시지 전송 실패!');
        } else {
            chatInput.value = '';
        }
    }

    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Analyze Button Click
    analyzeBtn.addEventListener('click', async () => {
        const content = diaryInput.value.trim();
        
        if (!content) {
            alert('일기 내용을 입력해주세요!');
            return;
        }

        // Visual feedback
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> 분석 중...';
        lucide.createIcons();
        
        aiResponse.classList.add('pulse');
        aiResponse.innerText = 'AI가 당신의 하루를 분석하고 기록하고 있습니다...';

        try {
            // 서버리스 백엔드 API 호출
            const fetchHeaders = {
                'Content-Type': 'application/json'
            };
            if (currentToken) {
                fetchHeaders['Authorization'] = `Bearer ${currentToken}`;
            }

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: fetchHeaders,
                body: JSON.stringify({ diaryContent: content })
            });

            const data = await response.json();
            
            if (!response.ok || data.error) {
                throw new Error(data.error || '서버 오류가 발생했습니다.');
            }

            const aiText = data.result;
            
            aiResponse.classList.remove('pulse');
            aiResponse.classList.add('active');
            
            // Apply white-space: pre-wrap to maintain the formatting from the API
            aiResponse.style.whiteSpace = 'pre-wrap';
            aiResponse.innerText = aiText;

            // 로컬 스토리지에 저장
            localStorage.setItem('savedDiary', content);
            localStorage.setItem('savedAiResponse', aiText);

            // Redis 저장 후 히스토리 즉시 갱신
            setTimeout(loadHistory, 1500); // Vercel 서버리스/Redis 반영 시간을 고려한 약간의 지연

        } catch (error) {
            console.error('API Error:', error);
            aiResponse.innerText = '오류가 발생했습니다: ' + error.message;
            aiResponse.classList.remove('pulse');
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i data-lucide="sparkles"></i> 분석 요청하기';
            lucide.createIcons();
        }
    });

    // Voice Input (Web Speech API)
    let isRecognizing = false;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (Recognition) {
        recognition = new Recognition();
        recognition.lang = 'ko-KR';
        recognition.interimResults = false;
        recognition.continuous = false; // Set to false to stop automatically after one phrase, or true for continuous

        recognition.onstart = () => {
            isRecognizing = true;
            console.log('Voice recognition started');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const currentValue = diaryInput.value;
            diaryInput.value = currentValue + (currentValue ? ' ' : '') + transcript;
            diaryInput.dispatchEvent(new Event('input'));
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            let message = '음성 인식 중 오류가 발생했습니다.';
            if (event.error === 'not-allowed') {
                message = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.';
            } else if (event.error === 'network') {
                message = '네트워크 연결을 확인해주세요.';
            }
            alert(message);
            isRecognizing = false;
            resetVoiceBtn();
        };

        recognition.onend = () => {
            console.log('Voice recognition ended');
            isRecognizing = false;
            resetVoiceBtn();
        };
    }

    function resetVoiceBtn() {
        voiceBtn.innerHTML = '<i data-lucide="mic"></i> 음성으로 입력하기';
        voiceBtn.classList.remove('pulse');
        voiceBtn.disabled = false;
        lucide.createIcons();
    }

    voiceBtn.addEventListener('click', () => {
        if (!Recognition) {
            alert('죄송합니다. 현재 브라우저에서 음성 인식을 지원하지 않습니다. 크롬 브라우저를 권장합니다.');
            return;
        }

        if (isRecognizing) {
            recognition.stop();
        } else {
            // Provide immediate UI feedback
            voiceBtn.innerHTML = '<i data-lucide="mic-off"></i> 음성 인식 중...';
            voiceBtn.classList.add('pulse');
            lucide.createIcons();
            
            try {
                recognition.start();
            } catch (err) {
                console.error('Recognition start error:', err);
                // If it's already started, just ignore or reset
                if (err.name === 'InvalidStateError') {
                    // Already started, do nothing
                } else {
                    resetVoiceBtn();
                    alert('음성 인식을 시작할 수 없습니다: ' + err.message);
                }
            }
        }
    });
});
