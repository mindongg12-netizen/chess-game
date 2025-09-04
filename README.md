# 🏆 실시간 온라인 체스 게임

실시간 멀티플레이어 체스 게임입니다. WebSocket을 사용하여 두 명의 플레이어가 온라인에서 실시간으로 체스를 즐길 수 있습니다.

## 🎮 주요 기능

- **실시간 멀티플레이어**: WebSocket을 통한 실시간 게임 진행
- **방 생성/참가 시스템**: 5자리 코드로 간편한 방 생성 및 참가
- **40초 턴 제한**: 각 턴마다 40초 시간 제한
- **자동 랜덤 이동**: 시간 초과 시 자동 랜덤 이동
- **실시간 동기화**: 말 이동, 잡힌 기물, 타이머 등 모든 게임 상태 실시간 동기화
- **플레이어 이름 표시**: 각 플레이어의 이름이 체스판 양쪽에 표시
- **반응형 디자인**: 데스크톱과 모바일 모두 지원

## 🚀 로컬 실행 방법

### 1. 저장소 클론 및 의존성 설치

```bash
# Node.js가 설치되어 있어야 합니다
npm install
```

### 2. 서버 실행

```bash
npm start
```

또는 개발 모드 (자동 재시작):

```bash
npm run dev
```

### 3. 게임 접속

브라우저에서 `http://localhost:3000`으로 접속하세요.

## 🌐 온라인 배포 방법

### Heroku 배포

1. **Heroku CLI 설치** (https://devcenter.heroku.com/articles/heroku-cli)

2. **Heroku 앱 생성**
```bash
heroku create your-chess-game-name
```

3. **환경 변수 설정**
```bash
heroku config:set NODE_ENV=production
```

4. **배포**
```bash
git add .
git commit -m "Deploy chess game"
git push heroku main
```

5. **앱 열기**
```bash
heroku open
```

### Railway 배포

1. [Railway](https://railway.app)에 회원가입
2. GitHub 저장소 연결
3. 자동 배포 완료
4. 생성된 URL로 접속

### Render 배포

1. [Render](https://render.com)에 회원가입
2. "New Web Service" 선택
3. GitHub 저장소 연결
4. 빌드 명령어: `npm install`
5. 시작 명령어: `npm start`
6. 배포 완료

### Vercel 배포

1. [Vercel](https://vercel.com)에 회원가입
2. GitHub/GitLab/Bitbucket 계정으로 로그인
3. "New Project" 클릭
4. GitHub 저장소 선택 및 연결
5. 프로젝트 설정:
   - **Framework Preset**: `Other`
   - **Build Command**: `npm install`
   - **Output Directory**: `./`
   - **Install Command**: `npm install`
6. 환경 변수 설정 (선택사항):
   - `NODE_ENV`: `production`
7. "Deploy" 클릭
8. 배포 완료 후 생성된 URL 확인

**Vercel CLI를 사용한 배포:**
```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 폴더에서 배포
vercel

# 프로덕션 배포
vercel --prod
```

**참고**: 이미 `vercel.json` 설정 파일이 포함되어 있어 자동으로 Node.js 서버가 배포됩니다.

## 🎯 게임 플레이 방법

### 방 만들기 (방장)
1. 이름 입력
2. "방 만들기" 클릭
3. 생성된 5자리 코드를 상대방에게 전달
4. 상대방 접속 후 "게임 시작" 클릭

### 방 참가하기 (참가자)
1. 이름 입력
2. 방장에게 받은 5자리 코드 입력
3. "참가하기" 클릭
4. 방장이 게임을 시작할 때까지 대기

### 게임 진행
- **백 기물**: 방장이 플레이
- **흑 기물**: 참가자가 플레이
- **턴 제한**: 각 턴마다 40초 시간 제한
- **실시간 동기화**: 모든 이동과 상태가 실시간으로 동기화

## 🔧 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, WebSocket (ws 라이브러리)
- **실시간 통신**: WebSocket
- **배포**: Heroku, Railway, Render 등

## 📁 파일 구조

```
chess-game/
├── index.html          # 메인 HTML 파일
├── chess.js            # 게임 로직 및 WebSocket 클라이언트
├── style.css           # 스타일시트
├── server.js           # Node.js WebSocket 서버
├── package.json        # 프로젝트 설정 및 의존성
├── vercel.json         # Vercel 배포 설정
├── deploy.sh           # 자동 배포 스크립트
└── README.md          # 프로젝트 설명서
```

## 🛠️ 문제 해결

### 연결 문제
- 방화벽 설정 확인
- 포트 3000이 사용 가능한지 확인
- 브라우저 콘솔에서 오류 메시지 확인

### 게임 동기화 문제
- 인터넷 연결 상태 확인
- 페이지 새로고침 후 재시도
- 서버 재시작 후 재시도

## 📝 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 🤝 기여하기

버그 리포트나 기능 제안은 Issues에 등록해주세요.

---

🎉 **즐거운 체스 게임 되세요!** 🎉
