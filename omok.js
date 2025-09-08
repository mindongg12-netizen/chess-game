// 오목 게임 클래스
class OmokGame {
    constructor() {
        this.board = Array(19).fill().map(() => Array(19).fill(null));
        this.currentPlayer = 'black'; // 흑돌이 먼저 시작
        this.gameStarted = false;
        this.gameEnded = false;
        this.lastMove = null;
        this.timer = 40;
        this.timerInterval = null;
        this.winningLine = null;
        this.hoveredCell = null;

        // 온라인 게임 속성 (janggi와 동일)
        this.gameCode = null;
        this.isOnlineGame = false;
        this.isGameInProgress = false;
        this.isRoomHost = false; // 흑돌
        this.isRoomGuest = false; // 백돌
        this.isMovePending = false; 

        // 플레이어 이름
        this.hostPlayerName = '';
        this.guestPlayerName = '';

        // Firebase 실시간 통신
        this.database = null;
        this.playerId = this.generatePlayerId();
        this.gameRef = null;
        this.listeners = [];
        
        this.initializeElements();
        this.initializeEventListeners();
        this.waitForFirebase();
        this.createBoard();
    }

    initializeElements() {
        // DOM 요소들
        this.gameMenu = document.getElementById('gameMenu');
        this.gameContainer = document.getElementById('gameContainer');
        this.omokboard = document.getElementById('omokboard');
        this.gridOverlay = document.getElementById('gridOverlay');
        this.starPoints = document.getElementById('starPoints');
        this.currentPlayerEl = document.getElementById('currentPlayer');
        this.gameStatusEl = document.getElementById('gameStatus');
        this.turnTimerEl = document.getElementById('turnTimer');
        this.turnTimer2El = document.getElementById('turnTimer2');
        
        // 플레이어 컨테이너
        this.whitePlayerContainer = document.getElementById('whitePlayerContainer');
        this.blackPlayerContainer = document.getElementById('blackPlayerContainer');
        this.whitePlayerNameEl = document.getElementById('whitePlayerName');
        this.blackPlayerNameEl = document.getElementById('blackPlayerName');
        
        // 게임 코드
        this.gameCodeContainer = document.getElementById('gameCodeContainer');
        this.gameCodeEl = document.getElementById('gameCode');
        this.copyCodeBtn = document.getElementById('copyCodeBtn');
        
        // 버튼들
        this.startGameBtn = document.getElementById('startGameBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.startGameBtnInRoom = document.getElementById('startGameBtnInRoom');
        this.resetBtn = document.getElementById('resetBtn');
        this.backToMenuBtn = document.getElementById('backToMenuBtn');
        
        // 입력 필드들
        this.hostNameInput = document.getElementById('hostNameInput');
        this.guestNameInput = document.getElementById('guestNameInput');
        this.roomCodeInput = document.getElementById('roomCodeInput');
    }

    initializeEventListeners() {
        // 메뉴 버튼들
        this.startGameBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.startGameBtnInRoom.addEventListener('click', () => this.startActualGame());
        this.resetBtn.addEventListener('click', () => this.resetGameOnline());
        this.backToMenuBtn.addEventListener('click', () => this.backToMenu());
        this.copyCodeBtn.addEventListener('click', () => this.copyGameCode());
        
        // 입력 필드 엔터키 이벤트
        this.hostNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });
        this.guestNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        // 방 코드 입력 필드 숫자만 허용
        this.roomCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
    
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    generateRoomCode() {
        return Math.floor(10000 + Math.random() * 90000).toString();
    }

    waitForFirebase() {
        if (window.firebaseReady && window.database) {
            this.database = window.database;
            console.log('🔥 Firebase Connection Complete');
            } else {
            console.log('⏳ Waiting for Firebase to load...');
            document.addEventListener('firebaseReady', () => {
                this.database = window.database;
                console.log('🔥 Firebase Connection Complete (Event)');
            });
        }
    }

    createBoard() {
        // 보드 셀 생성
        this.omokboard.innerHTML = '';
        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.dataset.row = row;
                square.dataset.col = col;
                
                // 클릭 이벤트 추가
                square.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`클릭 이벤트: (${row}, ${col})`);
                    this.makeMove(row, col);
                });
                
                // 호버 이벤트 추가
                square.addEventListener('mouseenter', () => this.onCellHover(row, col));
                square.addEventListener('mouseleave', () => this.onCellLeave(row, col));
                
                this.omokboard.appendChild(square);
            }
        }
        
        // 격자선 생성
        this.createGridLines();
        
        // 별점 생성
        this.createStarPoints();
        
        console.log('✅ 오목 보드 생성 완료');
        console.log('보드 크기:', this.omokboard.offsetWidth, 'x', this.omokboard.offsetHeight);
        console.log('격자선 오버레이:', this.gridOverlay);
        console.log('별점 오버레이:', this.starPoints);
        console.log('총 셀 개수:', this.omokboard.children.length);
        
        // 별점 위치 확인
        setTimeout(() => {
            const stars = this.starPoints.querySelectorAll('.star-point');
            console.log('별점 개수:', stars.length);
            stars.forEach((star, index) => {
                console.log(`별점 ${index + 1}:`, {
                    top: star.style.top,
                    left: star.style.left,
                    position: star.style.position,
                    width: star.style.width,
                    height: star.style.height
                });
            });
        }, 100);
    }
    
    createGridLines() {
        this.gridOverlay.innerHTML = '';
        
        // 가로선 생성
        for (let i = 0; i < 19; i++) {
            const line = document.createElement('div');
            line.className = 'grid-line horizontal';
            if (i % 3 === 2) {
                line.classList.add('thick');
            }
            line.style.top = `${(i * 100) / 18}%`;
            line.style.left = '0%';
            line.style.width = '100%';
            this.gridOverlay.appendChild(line);
        }
        
        // 세로선 생성
        for (let i = 0; i < 19; i++) {
            const line = document.createElement('div');
            line.className = 'grid-line vertical';
            if (i % 3 === 2) {
                line.classList.add('thick');
            }
            line.style.left = `${(i * 100) / 18}%`;
            line.style.top = '0%';
            line.style.height = '100%';
            this.gridOverlay.appendChild(line);
        }
        
        console.log('✅ 격자선 생성 완료:', this.gridOverlay.children.length, '개');
    }
    
    createStarPoints() {
        // HTML에 이미 별점이 있으므로 추가로 생성하지 않음
        console.log('✅ HTML에 이미 별점이 있음:', this.starPoints.children.length, '개');
        
        // 기존 별점들의 스타일을 강화
        const existingStars = this.starPoints.querySelectorAll('.star-point');
        existingStars.forEach((star, index) => {
            star.style.cssText = `
                position: absolute !important;
                width: 18px !important;
                height: 18px !important;
                background-color: #000000 !important;
                border-radius: 50% !important;
                transform: translate(-50%, -50%) !important;
                box-shadow: 0 0 10px rgba(0, 0, 0, 1) !important;
                z-index: 35 !important;
                border: 3px solid #333 !important;
                pointer-events: none !important;
            `;
            console.log(`별점 ${index + 1} 스타일 강화 완료`);
        });
        
        // 별점이 실제로 DOM에 있는지 확인
        setTimeout(() => {
            const stars = this.starPoints.querySelectorAll('.star-point');
            console.log('DOM에서 확인된 별점 개수:', stars.length);
            stars.forEach((star, index) => {
                const rect = star.getBoundingClientRect();
                console.log(`별점 ${index + 1}:`, {
                    top: star.style.top,
                    left: star.style.left,
                    width: star.style.width,
                    height: star.style.height,
                    backgroundColor: star.style.backgroundColor,
                    rect: rect,
                    visible: rect.width > 0 && rect.height > 0
                });
            });
        }, 100);
    }
    
    onCellHover(row, col) {
        if (!this.gameStarted || this.gameEnded || this.board[row][col] !== null) {
            return;
        }

        this.hoveredCell = { row, col };
        this.showPreview(row, col);
    }
    
    onCellLeave(row, col) {
        if (this.hoveredCell && this.hoveredCell.row === row && this.hoveredCell.col === col) {
            this.hidePreview();
            this.hoveredCell = null;
        }
    }
    
    showPreview(row, col) {
        const square = this.omokboard.children[row * 19 + col];
        const preview = document.createElement('div');
        preview.className = `stone ${this.currentPlayer} preview`;
        preview.textContent = this.currentPlayer === 'black' ? '●' : '○';
        square.appendChild(preview);
    }
    
    hidePreview() {
        if (this.hoveredCell) {
            const square = this.omokboard.children[this.hoveredCell.row * 19 + this.hoveredCell.col];
            const preview = square.querySelector('.preview');
            if (preview) {
                preview.remove();
            }
        }
    }

    async createRoom() {
        const hostNameInput = document.getElementById('hostNameInput');
        const hostName = hostNameInput.value.trim();
        if (!hostName || hostName.length < 2) {
            this.showError(hostNameInput, '이름을 2자 이상 입력하세요');
            return;
        }
        
        // 오프라인 모드 지원
        if (!this.database) {
            console.log('🔥 오프라인 모드로 게임 시작');
            this.gameCode = this.generateRoomCode();
            this.hostPlayerName = hostName;
            this.isRoomHost = true;
            this.isRoomGuest = false;
            this.isOnlineGame = false; // 오프라인 모드
            
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            this.showGameCode();
            this.updatePlayerInfo();
            this.showWaitingState();
            
            // 오프라인에서는 바로 게임 시작
            this.gameStarted = true;
            this.isGameInProgress = true;
            this.startGameBtnInRoom.style.display = 'none';
            this.resetBtn.style.display = 'block';
            this.startTimer();
            this.updateCurrentPlayer();
            this.updateGameStatus();
            this.updateBoard();
            
            console.log(`✅ 오프라인 방 생성 완료: ${this.gameCode}`);
            return;
        }

        try {
            this.gameCode = this.generateRoomCode();
            this.hostPlayerName = hostName;
            this.isRoomHost = true;
            this.isRoomGuest = false;
            this.isOnlineGame = true;
            
            const initialBoard = Array(19).fill().map(() => Array(19).fill(null));
            
            const roomData = {
                hostId: this.playerId,
                hostName: hostName,
                guestId: null,
                guestName: null,
                gameStarted: false,
                currentPlayer: 'black',
                board: initialBoard,
                lastMove: null,
                gameEnded: false,
                winningLine: null,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            };
            
            this.gameRef = this.database.ref('omok_games/' + this.gameCode);
            await this.gameRef.set(roomData);
            
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            this.showGameCode();
            this.updatePlayerInfo();
            this.showWaitingState();
            this.setupFirebaseListeners();
            
            console.log(`✅ 온라인 방 생성 완료: ${this.gameCode}`);
        } catch (error) {
            console.error('❌ Failed to create room:', error);
            alert('방 만들기에 실패했습니다: ' + error.message);
        }
    }

    async joinRoom() {
        const guestNameInput = document.getElementById('guestNameInput');
        const guestName = guestNameInput.value.trim();
        const codeInput = document.getElementById('roomCodeInput');
        const enteredCode = codeInput.value.trim();
        
        if (guestName.length < 2) {
            this.showError(guestNameInput, '이름을 2자 이상 입력하세요');
            return;
        }
        if (enteredCode.length !== 5 || !/^\d{5}$/.test(enteredCode)) {
            this.showError(codeInput, '5자리 숫자 코드를 입력하세요');
            return;
        }
        if (!this.database) {
            alert('서버 연결 중...');
            return;
        }
        
        try {
            this.gameCode = enteredCode;
            this.gameRef = this.database.ref('omok_games/' + this.gameCode);
            const snapshot = await this.gameRef.once('value');
            const roomData = snapshot.val();
            
            if (!roomData) throw new Error('존재하지 않는 방입니다');
            if (roomData.guestId) throw new Error('방이 가득 찼습니다');
            
            await this.gameRef.update({
                guestId: this.playerId,
                guestName: guestName,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            
            this.guestPlayerName = guestName;
            this.isRoomGuest = true;
            this.isRoomHost = false;
            this.isOnlineGame = true;
            
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            this.showGameCode();
            this.updatePlayerInfo();
            this.setupFirebaseListeners();
            
            console.log(`✅ 방 참가 완료: ${this.gameCode}`);
        } catch (error) {
            console.error('❌ Failed to join room:', error);
            this.showError(codeInput, error.message);
        }
    }

    setupFirebaseListeners() {
        if (!this.gameRef) return;
        
        const gameListener = this.gameRef.on('value', (snapshot) => {
            try {
                const gameData = snapshot.val();
                if (!gameData) {
                    alert('게임 방이 사라졌습니다. 메인 메뉴로 돌아갑니다.');
                    this.backToMenu();
                    return;
                }
                
                console.log('🔥 Firebase 데이터 수신:', {
                    currentPlayer: gameData.currentPlayer,
                    gameStarted: gameData.gameStarted,
                    gameEnded: gameData.gameEnded,
                    board: gameData.board ? '보드 있음' : '보드 없음',
                    lastMove: gameData.lastMove
                });
                
                this.hostPlayerName = gameData.hostName || '';
                if (gameData.guestId && !this.guestPlayerName) {
                    this.guestPlayerName = gameData.guestName || '';
                    if (this.isRoomHost) {
                        this.showWaitingState();
                    }
                }
                this.updatePlayerInfo();

                // 보드 동기화 (항상 실행)
                if (gameData.board) {
                    console.log('🔄 보드 동기화 시작');
                    this.syncBoard(gameData.board);
                }

                // 현재 플레이어 업데이트 (항상 실행)
                if (gameData.currentPlayer) {
                    console.log(`🔄 현재 플레이어 업데이트: ${this.currentPlayer} → ${gameData.currentPlayer}`);
                    this.currentPlayer = gameData.currentPlayer;
                    this.updateCurrentPlayer();
                    this.restartTimer();
                }
                
                // 이동 대기 상태 해제 (항상 실행)
                this.isMovePending = false;
                console.log('✅ isMovePending = false');
                
                // 게임 상태 업데이트
                if (gameData.gameStarted && !this.isGameInProgress) {
                    console.log('🎮 게임 시작 처리');
                    this.handleGameStart();
                }
                if (gameData.gameEnded && this.isGameInProgress) {
                    console.log('🏁 게임 종료 처리');
                    this.endGame(gameData.winner);
                }
                if (gameData.gameRestarted && gameData.gameStarted && !gameData.gameEnded) {
                    if (!this.isGameInProgress || !this.gameStarted) {
                        console.log('🔄 게임 재시작 처리');
                        this.handleGameRestart(gameData);
                    }
                }
            } catch (error) {
                console.error('❌ Firebase 리스너 오류:', error);
                console.error('오류 발생 시 게임 데이터:', snapshot.val());
            }
        });
        this.listeners.push({ ref: this.gameRef, listener: gameListener });
    }

    showGameCode() {
        this.gameCodeEl.textContent = this.gameCode;
        this.gameCodeContainer.style.display = 'block';
    }

    showWaitingState() {
        this.startGameBtnInRoom.style.display = 'block';
        this.resetBtn.style.display = 'none';
    }

    syncBoard(remoteBoard) {
        console.log('🔄 syncBoard 호출');
        console.log('원격 보드 타입:', typeof remoteBoard);
        
        // 원격 보드가 null이거나 undefined인 경우
        if (!remoteBoard) {
            console.log('⚠️ 원격 보드가 null/undefined, 현재 보드 유지');
            this.updateBoard();
            return;
        }
        
        let newBoard = null;
        
        // 원격 보드가 배열인 경우
        if (Array.isArray(remoteBoard)) {
            if (remoteBoard.length === 19) {
                // 각 행이 배열인지 확인
                let isValid = true;
                for (let i = 0; i < 19; i++) {
                    if (!Array.isArray(remoteBoard[i]) || remoteBoard[i].length !== 19) {
                        isValid = false;
                        break;
                    }
                }
                
                if (isValid) {
                    newBoard = remoteBoard;
                    console.log('✅ 보드 동기화 완료 (배열)');
                } else {
                    console.log('❌ 원격 보드 배열 구조가 잘못됨, 현재 보드 유지');
                }
            } else {
                console.log('❌ 원격 보드 배열 길이가 19가 아님:', remoteBoard.length);
            }
        } 
        // 원격 보드가 객체인 경우 (Firebase에서 객체로 저장된 경우)
        else if (typeof remoteBoard === 'object') {
            console.log('🔄 객체 형태의 보드 데이터 처리');
            try {
                // 객체를 2차원 배열로 변환
                newBoard = Array(19).fill().map(() => Array(19).fill(null));
                
                for (let row = 0; row < 19; row++) {
                    const rowKey = row.toString();
                    if (remoteBoard[rowKey] && typeof remoteBoard[rowKey] === 'object') {
                        for (let col = 0; col < 19; col++) {
                            const colKey = col.toString();
                            if (remoteBoard[rowKey][colKey] !== undefined) {
                                newBoard[row][col] = remoteBoard[rowKey][colKey];
                            }
                        }
                    }
                }
                
                console.log('✅ 보드 동기화 완료 (객체 → 배열 변환)');
            } catch (error) {
                console.error('❌ 객체 보드 변환 실패:', error);
                console.log('현재 보드 유지');
            }
        } else {
            console.log('❌ 원격 보드가 배열도 객체도 아님:', typeof remoteBoard);
        }
        
        // 보드가 변경되었을 때만 업데이트
        if (newBoard) {
            const boardChanged = this.hasBoardChanged(newBoard);
            if (boardChanged) {
                console.log('🔄 보드 변경 감지, 업데이트 실행');
                this.board = newBoard;
                this.updateBoard();
            } else {
                console.log('📋 보드 변경 없음, 업데이트 스킵');
            }
        } else {
            this.updateBoard();
        }
    }
    
    hasBoardChanged(newBoard) {
        if (!this.board || !newBoard) return true;
        
        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                if (this.board[row][col] !== newBoard[row][col]) {
                    return true;
                }
            }
        }
        return false;
    }

    handleGameStart() {
        console.log('🎮 handleGameStart 호출');
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.startGameBtnInRoom.style.display = 'none';
        this.resetBtn.style.display = 'block';
        this.startTimer();
        this.updateCurrentPlayer();
        this.updateGameStatus();
        this.updateBoard(); // 보드도 업데이트
        console.log('✅ 게임 시작됨 - 상태:', {
            gameStarted: this.gameStarted,
            isGameInProgress: this.isGameInProgress,
            currentPlayer: this.currentPlayer
        });
    }

    handleGameRestart(gameData) {
        console.log('🔄 handleGameRestart 호출됨');
        console.log('🔄 gameData:', gameData);
        console.log('🔄 resetFromPopup:', gameData.resetFromPopup);
        
        // 팝업에서 리셋된 경우 기존 팝업 제거
        if (gameData.resetFromPopup) {
            console.log('🔄 팝업에서 리셋됨, 기존 팝업 제거');
            const existingPopup = document.getElementById('winPopup');
            if (existingPopup) {
                existingPopup.remove();
                console.log('✅ 기존 팝업 제거 완료');
            }
        }
        
        // 게임 상태 초기화
        this.board = gameData.board || Array(19).fill().map(() => Array(19).fill(null));
        this.currentPlayer = gameData.currentPlayer || 'black';
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.gameEnded = false;
        this.winningLine = null;
        this.lastMove = null;
        this.isMovePending = false;
        
        console.log('🔄 게임 상태 초기화 완료');
        
        // 모든 돌 완전 제거
        this.clearAllStones();
        
        // UI 업데이트
        this.startGameBtnInRoom.style.display = 'none';
        this.resetBtn.style.display = 'block';
        
        // 타이머 시작
        this.startTimer();
        
        // 보드 및 상태 업데이트
        this.updateBoard();
        this.updateCurrentPlayer();
        this.updateGameStatus();
        
        console.log('✅ 게임 재시작 완료');
    }

    endGame(winner) {
        console.log('🎯 endGame 호출됨, winner:', winner);
        this.gameEnded = true;
        this.isGameInProgress = false;
        this.stopTimer();
        this.updateGameStatus();
        console.log('✅ 게임 종료:', winner);
        
        // 승리 팝업 표시
        console.log('🎯 showWinPopup 호출 시작');
        this.showWinPopup(winner);
        console.log('🎯 showWinPopup 호출 완료');
    }
    
    showWinPopup(winner) {
        console.log('🎯 showWinPopup 시작, winner:', winner);
        console.log('🎯 document.body:', document.body);
        console.log('🎯 document.readyState:', document.readyState);
        
        // 기존 팝업이 있으면 제거
        const existingPopup = document.getElementById('winPopup');
        if (existingPopup) {
            console.log('🎯 기존 팝업 제거');
            existingPopup.remove();
        }
        
        // 팝업 생성
        console.log('🎯 팝업 요소 생성 시작');
        const popup = document.createElement('div');
        popup.id = 'winPopup';
        
        // PC 환경을 위한 더 강력한 스타일링
        popup.style.position = 'fixed';
        popup.style.top = '0';
        popup.style.left = '0';
        popup.style.width = '100%';
        popup.style.height = '100%';
        popup.style.background = 'rgba(0, 0, 0, 0.8)';
        popup.style.display = 'flex';
        popup.style.justifyContent = 'center';
        popup.style.alignItems = 'center';
        popup.style.zIndex = '9999';
        popup.style.animation = 'fadeIn 0.3s ease';
        
        console.log('🎯 팝업 기본 스타일 적용 완료');
        
        const popupContent = document.createElement('div');
        
        // PC 환경을 위한 개별 스타일 적용
        popupContent.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        popupContent.style.padding = '40px';
        popupContent.style.borderRadius = '20px';
        popupContent.style.textAlign = 'center';
        popupContent.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.3)';
        popupContent.style.color = 'white';
        popupContent.style.maxWidth = '400px';
        popupContent.style.width = '90%';
        popupContent.style.animation = 'slideIn 0.3s ease';
        popupContent.style.position = 'relative';
        popupContent.style.zIndex = '10000';
        
        console.log('🎯 팝업 콘텐츠 스타일 적용 완료');
        
        let message = '';
        let emoji = '';
        
        if (winner === null) {
            message = '무승부입니다!';
            emoji = '🤝';
        } else {
            // 승리자 이름 결정
            let winnerName = '';
            let isMyWin = false;
            
            if (winner === 'black') {
                // 흑돌이 승리한 경우
                if (this.isRoomHost) {
                    winnerName = this.hostPlayerName;
                    isMyWin = true;
                } else if (this.isRoomGuest) {
                    winnerName = this.guestPlayerName;
                    isMyWin = false;
                }
            } else if (winner === 'white') {
                // 백돌이 승리한 경우
                if (this.isRoomHost) {
                    winnerName = this.guestPlayerName;
                    isMyWin = false;
                } else if (this.isRoomGuest) {
                    winnerName = this.hostPlayerName;
                    isMyWin = true;
                }
            }
            
            // 메시지 결정
            if (isMyWin) {
                message = '축하합니다! 당신이 승리했습니다! 🎉';
                emoji = winner === 'black' ? '⚫' : '⚪';
            } else {
                message = `${winnerName}님이 승리했습니다. 아쉽게 패배했습니다. 😔`;
                emoji = winner === 'black' ? '⚫' : '⚪';
            }
        }
        
        popupContent.innerHTML = `
            <div style="font-size: 4rem; margin-bottom: 20px;">${emoji}</div>
            <h2 style="font-size: 2rem; margin-bottom: 20px; font-weight: bold;">${message}</h2>
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
                <button id="playAgainBtn" style="
                    background: linear-gradient(45deg, #ff6b6b, #ff8e8e);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 25px;
                    font-size: 1.1rem;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 5px 15px rgba(255, 107, 107, 0.3);
                ">다시 하기</button>
                <button id="closePopupBtn" style="
                    background: linear-gradient(45deg, #4ecdc4, #44a08d);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 25px;
                    font-size: 1.1rem;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 5px 15px rgba(78, 205, 196, 0.3);
                ">닫기</button>
            </div>
        `;
        
        popup.appendChild(popupContent);
        
        console.log('🎯 팝업 DOM에 추가 시작');
        console.log('🎯 document.body 존재:', !!document.body);
        
        // DOM에 추가
        document.body.appendChild(popup);
        
        console.log('🎯 팝업 DOM에 추가 완료');
        console.log('🎯 팝업 요소 확인:', document.getElementById('winPopup'));
        
        // 약간의 지연 후 이벤트 리스너 추가 (PC 환경 호환성)
        setTimeout(() => {
            console.log('🎯 이벤트 리스너 추가 시작');
            
            const playAgainBtn = document.getElementById('playAgainBtn');
            const closePopupBtn = document.getElementById('closePopupBtn');
            
            console.log('🎯 playAgainBtn:', playAgainBtn);
            console.log('🎯 closePopupBtn:', closePopupBtn);
            
            if (playAgainBtn) {
                playAgainBtn.addEventListener('click', () => {
                    console.log('🎯 다시 하기 버튼 클릭');
                    popup.remove();
                    
                    // 약간의 지연 후 게임 재시작 (팝업 제거 후)
                    setTimeout(() => {
                        this.resetGameFromPopup();
                    }, 100);
                });
            }
            
            if (closePopupBtn) {
                closePopupBtn.addEventListener('click', () => {
                    console.log('🎯 닫기 버튼 클릭');
                    popup.remove();
                });
            }
            
            // 배경 클릭 시 닫기
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    console.log('🎯 배경 클릭으로 팝업 닫기');
                    popup.remove();
                }
            });
            
            console.log('🎯 이벤트 리스너 추가 완료');
        }, 100);
        
        // CSS 애니메이션 추가
        console.log('🎯 CSS 애니메이션 추가 시작');
        const style = document.createElement('style');
        style.id = 'winPopupStyles';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { 
                    opacity: 0;
                    transform: translateY(-50px) scale(0.9);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            #winPopup {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                z-index: 9999 !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
            }
            #playAgainBtn:hover, #closePopupBtn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
            }
        `;
        
        // 기존 스타일 제거
        const existingStyle = document.getElementById('winPopupStyles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        document.head.appendChild(style);
        console.log('🎯 CSS 애니메이션 추가 완료');
        
        // 팝업이 실제로 표시되었는지 확인
        setTimeout(() => {
            const popupElement = document.getElementById('winPopup');
            if (popupElement) {
                console.log('🎯 팝업 표시 확인됨:', popupElement);
                console.log('🎯 팝업 스타일:', window.getComputedStyle(popupElement));
            } else {
                console.log('❌ 팝업이 DOM에서 찾을 수 없음');
                
                // PC 환경에서 팝업이 안 뜰 경우 백업 alert 사용
                console.log('🎯 백업 alert 팝업 표시');
                let alertMessage = '';
                if (winner === null) {
                    alertMessage = '무승부입니다!';
                } else {
                    // 승리자 이름 결정
                    let winnerName = '';
                    let isMyWin = false;
                    
                    if (winner === 'black') {
                        // 흑돌이 승리한 경우
                        if (this.isRoomHost) {
                            winnerName = this.hostPlayerName;
                            isMyWin = true;
                        } else if (this.isRoomGuest) {
                            winnerName = this.guestPlayerName;
                            isMyWin = false;
                        }
                    } else if (winner === 'white') {
                        // 백돌이 승리한 경우
                        if (this.isRoomHost) {
                            winnerName = this.guestPlayerName;
                            isMyWin = false;
                        } else if (this.isRoomGuest) {
                            winnerName = this.hostPlayerName;
                            isMyWin = true;
                        }
                    }
                    
                    // 메시지 결정
                    if (isMyWin) {
                        alertMessage = '축하합니다! 당신이 승리했습니다! 🎉';
                    } else {
                        alertMessage = `${winnerName}님이 승리했습니다. 아쉽게 패배했습니다. 😔`;
                    }
                }
                
                if (confirm(alertMessage + '\n\n다시 하시겠습니까?')) {
                    setTimeout(() => {
                        this.resetGameFromPopup();
                    }, 100);
                }
            }
        }, 200);
    }

    async startActualGame() {
        console.log('🚀 startActualGame 호출');
        console.log('호스트 여부:', this.isRoomHost);
        console.log('게스트 이름:', this.guestPlayerName);
        
        if (!this.isRoomHost || !this.guestPlayerName) {
            console.log('❌ 호스트가 아니거나 게스트가 없음');
            return;
        }
        
        try {
            console.log('✅ 게임 시작 요청');
            await this.gameRef.update({
                gameStarted: true,
                isGameInProgress: true,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            console.log('✅ 게임 시작 완료');
        } catch (error) {
            console.error('❌ Game start failed:', error);
            alert('게임 시작에 실패했습니다: ' + error.message);
        }
    }

    async makeMove(row, col) {
        console.log(`🎯 makeMove 호출: (${row}, ${col})`);
        console.log('게임 상태:', {
            isGameInProgress: this.isGameInProgress,
            isMovePending: this.isMovePending,
            currentPlayer: this.currentPlayer,
            isRoomHost: this.isRoomHost,
            isRoomGuest: this.isRoomGuest,
            isOnlineGame: this.isOnlineGame,
            boardValue: this.board[row][col]
        });
        
        if (!this.isGameInProgress || this.isMovePending) {
            console.log('❌ 게임이 진행 중이 아니거나 이동 대기 중');
            return;
        }
        if (this.board[row][col] !== null) {
            console.log('❌ 이미 돌이 있는 위치');
            return;
        }
        
        // 턴 체크 (오프라인 모드에서는 항상 허용)
        if (this.isOnlineGame) {
            const isMyTurn = (this.isRoomHost && this.currentPlayer === 'black') || 
                            (this.isRoomGuest && this.currentPlayer === 'white');
            if (!isMyTurn) {
                console.log('❌ 내 차례가 아님');
                return;
            }
        }
        
        console.log('✅ 수를 둘 수 있음, 돌 배치 시작');
        this.isMovePending = true;
        
        // 안전한 보드 업데이트
        if (!this.board[row]) {
            this.board[row] = Array(19).fill(null);
        }
        this.board[row][col] = this.currentPlayer;
        this.lastMove = { row, col };
        
        // 즉시 로컬 보드 업데이트
        this.updateBoard();
        console.log('✅ 로컬 보드 업데이트 완료');
        
        // 승리 체크
        console.log('🎯 승리 체크 시작, row:', row, 'col:', col);
        const winResult = this.checkWin(row, col);
        console.log('🎯 승리 체크 결과:', winResult);
        
        if (winResult.win) {
            console.log('🎉 승리!');
            console.log('🎯 승리자:', this.currentPlayer);
            console.log('🎯 승리 라인:', winResult.line);
            this.winningLine = winResult.line;
            const winner = this.currentPlayer;
            
            // 로컬에서 즉시 게임 종료 처리
            console.log('🎯 endGame 호출 전');
            this.endGame(winner);
            console.log('🎯 endGame 호출 후');
            
            if (this.isOnlineGame && this.gameRef) {
                try {
                    const boardForFirebase = this.board.map(row => 
                        row.map(cell => cell === null ? null : cell)
                    );
                    
                    await this.gameRef.update({
                        board: boardForFirebase,
                        gameEnded: true,
                        winner: winner,
                        lastMove: this.lastMove,
                        winningLine: this.winningLine,
                        lastActivity: firebase.database.ServerValue.TIMESTAMP
                    });
                } catch (error) {
                    console.error('❌ Move update failed:', error);
                }
            }
            return;
        }
        
        // 무승부 체크
        if (this.isBoardFull()) {
            console.log('🤝 무승부!');
            
            // 로컬에서 즉시 게임 종료 처리
            this.endGame(null);
            
            if (this.isOnlineGame && this.gameRef) {
                try {
                    const boardForFirebase = this.board.map(row => 
                        row.map(cell => cell === null ? null : cell)
                    );
                    
                    await this.gameRef.update({
                        board: boardForFirebase,
                        gameEnded: true,
                        winner: null,
                    lastMove: this.lastMove,
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                    });
                } catch (error) {
                    console.error('❌ Move update failed:', error);
                }
            }
            return;
        }
        
        // 턴 변경
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.restartTimer();
        this.updateCurrentPlayer();
        console.log(`🔄 턴 변경: ${this.currentPlayer}`);
        
        if (this.isOnlineGame && this.gameRef) {
            try {
                // 보드를 Firebase에 저장할 때 일관된 형태로 변환
                const boardForFirebase = this.board.map(row => 
                    row.map(cell => cell === null ? null : cell)
                );
                
                console.log('📤 Firebase에 업데이트 전송:', {
                    currentPlayer: this.currentPlayer,
                    lastMove: this.lastMove,
                    boardSize: boardForFirebase.length
                });
                
                await this.gameRef.update({
                    board: boardForFirebase,
                    currentPlayer: this.currentPlayer,
                    lastMove: this.lastMove,
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                });
                console.log('✅ Firebase 업데이트 완료');
                
                // Firebase 리스너가 isMovePending을 false로 설정할 때까지 기다리지 않음
                // 리스너에서 자동으로 처리됨
            } catch (error) {
                console.error('❌ Move update failed:', error);
                this.isMovePending = false;
            }
        } else {
            // 오프라인 모드에서는 즉시 다음 턴으로
            this.isMovePending = false;
            console.log('✅ 오프라인 모드 - 턴 변경 완료');
        }
    }

    checkWin(row, col) {
        // 안전한 보드 체크
        if (!this.board || !this.board[row] || this.board[row][col] === null) {
            return { win: false, line: null };
        }

        const directions = [
            [0, 1],   // 가로
            [1, 0],   // 세로
            [1, 1],   // 대각선 \
            [1, -1]   // 대각선 /
        ];
        
        const player = this.board[row][col];
        
        for (const [dx, dy] of directions) {
            let count = 1;
            let line = [{ row, col }];
            
            // 한 방향으로 확인
            for (let i = 1; i < 5; i++) {
                const newRow = row + dx * i;
                const newCol = col + dy * i;
                if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
                    this.board[newRow] && this.board[newRow][newCol] === player) {
                    count++;
                    line.push({ row: newRow, col: newCol });
                } else {
                    break;
                }
            }
            
            // 반대 방향으로 확인
            for (let i = 1; i < 5; i++) {
                const newRow = row - dx * i;
                const newCol = col - dy * i;
                if (newRow >= 0 && newRow < 19 && newCol >= 0 && newCol < 19 && 
                    this.board[newRow] && this.board[newRow][newCol] === player) {
                    count++;
                    line.unshift({ row: newRow, col: newCol });
                } else {
                    break;
                }
            }
            
            if (count >= 5) {
                return { win: true, line: line.slice(0, 5) };
            }
        }
        
        return { win: false, line: null };
    }

    isBoardFull() {
        if (!this.board || !Array.isArray(this.board)) {
        return false;
    }

        for (let row = 0; row < 19; row++) {
            if (!this.board[row] || !Array.isArray(this.board[row])) {
                return false;
            }
            for (let col = 0; col < 19; col++) {
                if (this.board[row][col] === null) {
                    return false;
                }
            }
        }
        return true;
    }

    updateBoard() {
        console.log('🔄 updateBoard 호출');
        console.log('보드 상태:', this.board);
        console.log('omokboard 자식 개수:', this.omokboard.children.length);
        
        // 안전한 보드 초기화 체크
        if (!this.board || !Array.isArray(this.board) || this.board.length !== 19) {
            console.log('❌ 보드가 올바르게 초기화되지 않음, 재초기화');
            this.board = Array(19).fill().map(() => Array(19).fill(null));
        }
        
        // 안전한 winningLine 체크
        if (this.winningLine && !Array.isArray(this.winningLine)) {
            console.log('❌ winningLine이 배열이 아님, 초기화');
            this.winningLine = null;
        }
        
        // 게임 재시작 시 모든 돌 완전 제거
        if (!this.gameEnded && this.board.every(row => row.every(cell => cell === null))) {
            console.log('🔄 게임 재시작 감지, 모든 돌 완전 제거');
            this.clearAllStones();
        }
        
        let stoneCount = 0;
        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                const squareIndex = row * 19 + col;
                const square = this.omokboard.children[squareIndex];
                
                if (!square) {
                    console.log(`❌ Square not found at (${row}, ${col}), index: ${squareIndex}`);
                    continue;
                }
                
                square.innerHTML = '';
                
                // 기존 클래스 제거
                square.classList.remove('last-move', 'disabled');
                
                // 안전한 보드 값 체크
                if (this.board[row] && this.board[row][col]) {
                    stoneCount++;
                    console.log(`🪨 돌 생성: (${row}, ${col}) = ${this.board[row][col]}`);
                    const stone = document.createElement('div');
                    stone.className = `stone ${this.board[row][col]}`;
                    stone.textContent = this.board[row][col] === 'black' ? '●' : '○';
                    
                    // 인라인 스타일로 강제 적용
                    stone.style.cssText = `
                        position: absolute !important;
                        width: 24px !important;
                        height: 24px !important;
                        border-radius: 50% !important;
                        display: flex !important;
                        justify-content: center !important;
                        align-items: center !important;
                        font-size: 14px !important;
                        font-weight: bold !important;
                        cursor: pointer !important;
                        transition: all 0.2s ease !important;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.4) !important;
                        z-index: 100 !important;
                        top: 50% !important;
                        left: 50% !important;
                        transform: translate(-50%, -50%) !important;
                        ${this.board[row][col] === 'black' ? 
                            'background: radial-gradient(circle at 30% 30%, #666, #000) !important; color: white !important; text-shadow: 1px 1px 2px rgba(255,255,255,0.3) !important;' :
                            'background: radial-gradient(circle at 30% 30%, #fff, #e0e0e0) !important; color: black !important; text-shadow: 1px 1px 2px rgba(0,0,0,0.3) !important; border: 1px solid #ccc !important;'
                        }
                    `;
                    
                    // 안전한 승리 라인 체크
                    if (this.winningLine && Array.isArray(this.winningLine) && this.winningLine.length > 0) {
                        const isWinningStone = this.winningLine.some(pos => 
                            pos && typeof pos === 'object' && pos.row === row && pos.col === col
                        );
                        if (isWinningStone) {
                            stone.classList.add('winning');
                            stone.style.animation = 'pulse 1s infinite !important';
                            stone.style.boxShadow = '0 0 0 4px #ff6b6b, 0 4px 8px rgba(0,0,0,0.3) !important';
                        }
                    }
                    
                    square.appendChild(stone);
                    console.log(`✅ 돌 추가 완료: (${row}, ${col})`);
                    
                    // 돌이 실제로 DOM에 추가되었는지 확인
                    setTimeout(() => {
                        const addedStone = square.querySelector('.stone');
                        if (addedStone) {
                            const rect = addedStone.getBoundingClientRect();
                            console.log(`돌 확인: (${row}, ${col})`, {
                                visible: rect.width > 0 && rect.height > 0,
                                rect: rect,
                                style: addedStone.style.cssText
                            });
                        } else {
                            console.log(`❌ 돌이 DOM에 없음: (${row}, ${col})`);
                        }
                    }, 10);
                }
                
                // 마지막 수 표시
                if (this.lastMove && this.lastMove.row === row && this.lastMove.col === col) {
                    square.classList.add('last-move');
                }
                
                // 게임 종료 시 비활성화
                if (this.gameEnded) {
                    square.classList.add('disabled');
                }
            }
        }
        
        console.log(`✅ updateBoard 완료 - 총 ${stoneCount}개 돌 렌더링`);
    }
    
    clearAllStones() {
        console.log('🧹 clearAllStones 호출 - 모든 돌 완전 제거');
        
        // 모든 square에서 돌 제거
        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                const squareIndex = row * 19 + col;
                const square = this.omokboard.children[squareIndex];
                
                if (square) {
                    // 모든 자식 요소 제거
                    square.innerHTML = '';
                    
                    // 모든 관련 클래스 제거
                    square.classList.remove('last-move', 'disabled', 'winning');
                    
                    // 스타일 초기화
                    square.style.cssText = '';
                    
                    // 돌 관련 모든 요소 강제 제거
                    const stones = square.querySelectorAll('.stone');
                    stones.forEach(stone => {
                        stone.remove();
                    });
                    
                    // 호버 효과 제거
                    const hoverElements = square.querySelectorAll('.hover-preview');
                    hoverElements.forEach(element => {
                        element.remove();
                    });
                }
            }
        }
        
        // 추가적인 정리
        const allStones = this.omokboard.querySelectorAll('.stone');
        allStones.forEach(stone => {
            stone.remove();
        });
        
        console.log('✅ clearAllStones 완료 - 모든 돌 제거됨');
    }

    updateCurrentPlayer() {
        if (this.gameEnded) {
            this.currentPlayerEl.textContent = '게임 종료';
                return;
            }
            
        if (!this.gameStarted) {
            this.currentPlayerEl.textContent = '대기중';
                return;
            }
            
        const playerText = this.currentPlayer === 'black' ? '흑(黑)의 차례' : '백(白)의 차례';
        this.currentPlayerEl.textContent = playerText;
    }

    updateGameStatus() {
        if (this.gameEnded) {
            if (this.isBoardFull()) {
                this.gameStatusEl.textContent = '무승부입니다!';
            } else {
                const winner = this.currentPlayer === 'black' ? '흑(黑)' : '백(白)';
                this.gameStatusEl.textContent = `${winner} 승리!`;
            }
        } else if (this.isGameInProgress) {
            this.gameStatusEl.textContent = '게임이 진행 중입니다';
        } else if (this.isOnlineGame && !this.guestPlayerName) {
            this.gameStatusEl.textContent = '상대방을 기다리는 중...';
        } else {
            this.gameStatusEl.textContent = '게임을 시작하세요';
        }
    }

    updatePlayerInfo() {
        if (this.isRoomHost) {
            this.blackPlayerNameEl.textContent = this.hostPlayerName;
            this.whitePlayerNameEl.textContent = this.guestPlayerName || '대기중';
        } else {
            this.whitePlayerNameEl.textContent = this.guestPlayerName;
            this.blackPlayerNameEl.textContent = this.hostPlayerName;
        }
        this.blackPlayerContainer.style.display = 'flex';
        this.whitePlayerContainer.style.display = 'flex';
    }

    startTimer() {
        this.stopTimer();
        this.timer = 40;
        this.updateTimer();
        
        this.timerInterval = setInterval(() => {
            this.timer--;
            this.updateTimer();
            
            if (this.timer <= 0) {
                this.timeUp();
            }
        }, 1000);
    }

    restartTimer() {
        this.startTimer();
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimer() {
        if (this.turnTimerEl) {
            this.turnTimerEl.textContent = this.timer;
            this.turnTimerEl.className = this.timer <= 10 ? 'timer warning' : 'timer';
        }
        if (this.turnTimer2El) {
            this.turnTimer2El.textContent = this.timer;
            this.turnTimer2El.className = this.timer <= 10 ? 'timer warning' : 'timer';
        }
    }

    timeUp() {
        this.stopTimer();
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.updateCurrentPlayer();
        this.updateGameStatus();
        
        if (this.gameRef) {
            this.gameRef.update({
                currentPlayer: this.currentPlayer
            });
        }
        
        this.startTimer();
    }

    async resetGameFromPopup() {
        console.log('🔄 resetGameFromPopup 호출됨 (팝업에서 다시 하기)');
        console.log('🔄 isOnlineGame:', this.isOnlineGame);
        console.log('🔄 gameRef:', this.gameRef);
        
        if (!this.gameRef || !this.isOnlineGame) {
            console.log('🔄 오프라인 모드, 로컬만 초기화');
            this.resetGame();
            return;
        }
        
        try {
            console.log('🔄 Firebase를 통한 양쪽 플레이어 게임 재시작 시작');
            const newBoard = Array(19).fill().map(() => Array(19).fill(null));
            
            // Firebase에 게임 재시작 신호 전송 (양쪽 플레이어 모두 동기화)
            await this.gameRef.update({
                board: newBoard,
                currentPlayer: 'black',
                gameStarted: true,
                isGameInProgress: true,
                gameEnded: false,
                winner: null,
                lastMove: null,
                winningLine: null,
                gameRestarted: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP,
                resetFromPopup: true  // 팝업에서 리셋했음을 표시
            });
            
            console.log('✅ Firebase를 통한 양쪽 플레이어 게임 재시작 완료');
        } catch (error) {
            console.error('❌ Game restart from popup failed:', error);
            alert('게임 재시작에 실패했습니다: ' + error.message);
        }
    }

    async resetGameOnline() {
        console.log('🔄 resetGameOnline 호출됨');
        console.log('🔄 isOnlineGame:', this.isOnlineGame);
        console.log('🔄 gameRef:', this.gameRef);
        
        // 먼저 로컬 상태 초기화
        this.resetGame();
        
        if (!this.gameRef || !this.isOnlineGame) {
            console.log('🔄 오프라인 모드 또는 gameRef 없음, 로컬만 초기화');
            return;
        }
        
        try {
            console.log('🔄 Firebase 게임 상태 초기화 시작');
            const newBoard = Array(19).fill().map(() => Array(19).fill(null));
            
            await this.gameRef.update({
                board: newBoard,
                currentPlayer: 'black',
                gameStarted: true,
                isGameInProgress: true,
                gameEnded: false,
                winner: null,
                lastMove: null,
                winningLine: null,
                gameRestarted: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            
            console.log('✅ Firebase 게임 상태 초기화 완료');
        } catch (error) {
            console.error('❌ Game restart failed:', error);
            alert('게임 재시작에 실패했습니다: ' + error.message);
        }
    }

    resetGame() {
        console.log('🔄 resetGame 호출됨');
        
        // 게임 상태 초기화
        this.board = Array(19).fill().map(() => Array(19).fill(null));
        this.currentPlayer = 'black';
        this.gameStarted = false;
        this.gameEnded = false;
        this.isGameInProgress = false;
        this.lastMove = null;
        this.winningLine = null;
        this.hoveredCell = null;
        this.isMovePending = false;
        
        console.log('🔄 게임 상태 초기화 완료');
        
        // 타이머 정지
        this.stopTimer();
        
        // 모든 돌 완전 제거
        this.clearAllStones();
        
        // UI 업데이트
        this.updateBoard();
        this.updateCurrentPlayer();
        this.updateGameStatus();
        
        // 버튼 상태 업데이트
        if (this.startGameBtnInRoom) {
            this.startGameBtnInRoom.style.display = 'block';
        }
        if (this.resetBtn) {
            this.resetBtn.style.display = 'none';
        }
        
        console.log('✅ resetGame 완료');
    }

    backToMenu() {
        // Clean up Firebase listeners to prevent memory leaks
        if (this.gameRef && this.listeners.length > 0) {
            this.listeners.forEach(({ ref, listener }) => ref.off('value', listener));
            this.listeners = [];
            this.gameRef = null;
        }

        this.stopTimer();
        this.gameCodeContainer.style.display = 'none';
        this.startGameBtnInRoom.style.display = 'none';
        this.resetBtn.style.display = 'none';
        this.blackPlayerContainer.style.display = 'none';
        this.whitePlayerContainer.style.display = 'none';
        
        // 입력 필드 초기화
        this.hostNameInput.value = '';
        this.guestNameInput.value = '';
        this.roomCodeInput.value = '';
        
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('gameMenu').style.display = 'block';
        
        // 상태 초기화
        this.gameStarted = false;
        this.isGameInProgress = false;
            this.isRoomHost = false;
        this.isRoomGuest = false;
        this.isOnlineGame = false;
        this.hostPlayerName = '';
        this.guestPlayerName = '';
        this.gameCode = null;
        
        console.log('✅ 메인 메뉴로 돌아가기');
    }

    copyGameCode() {
        navigator.clipboard.writeText(this.gameCode).then(() => {
            this.copyCodeBtn.textContent = '✓';
            setTimeout(() => {
                this.copyCodeBtn.textContent = '📋';
            }, 2000);
        });
    }

    showGameContainer() {
        this.gameMenu.style.display = 'none';
        this.gameContainer.style.display = 'flex';
    }

    showError(inputElement, message) {
        inputElement.classList.add('error');
        inputElement.placeholder = message;
        setTimeout(() => {
            inputElement.classList.remove('error');
            inputElement.placeholder = inputElement === this.roomCodeInput ? '5자리 코드 입력' : '이름';
        }, 3000);
    }

    generateRoomCode() {
        return Math.floor(10000 + Math.random() * 90000).toString();
    }
}

// 테마 토글 기능
function initializeThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const lightTheme = document.getElementById('lightTheme');
    const darkTheme = document.getElementById('darkTheme');
    
    themeToggle.addEventListener('click', () => {
        const isDark = darkTheme.disabled;
        
        if (isDark) {
            lightTheme.disabled = true;
            darkTheme.disabled = false;
            themeToggle.querySelector('.theme-icon').textContent = '☀️';
            localStorage.setItem('theme', 'dark');
        } else {
            lightTheme.disabled = false;
            darkTheme.disabled = true;
            themeToggle.querySelector('.theme-icon').textContent = '🌙';
            localStorage.setItem('theme', 'light');
        }
    });
    
    // 저장된 테마 불러오기
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        lightTheme.disabled = true;
        darkTheme.disabled = false;
        themeToggle.querySelector('.theme-icon').textContent = '☀️';
    }
}

// 게임 초기화
document.addEventListener('DOMContentLoaded', () => {
    initializeThemeToggle();
    window.omokGame = new OmokGame();
});
