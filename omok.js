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
        
        if (!this.database) {
            alert('Firebase에 연결 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }
        
        try {
            this.gameCode = this.generateRoomCode();
            this.hostPlayerName = hostName;
            this.isRoomHost = true;
            this.isRoomGuest = false;
            this.isOnlineGame = true;
            
            const roomData = {
                hostId: this.playerId,
                hostName: hostName,
                guestId: null,
                guestName: null,
                gameStarted: false,
                currentPlayer: 'black',
                board: this.board,
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
            
            console.log(`✅ 방 생성 완료: ${this.gameCode}`);
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
            const gameData = snapshot.val();
            if (!gameData) {
                alert('게임 방이 사라졌습니다. 메인 메뉴로 돌아갑니다.');
                this.backToMenu();
                return;
            }
            
            this.hostPlayerName = gameData.hostName;
            if (gameData.guestId && !this.guestPlayerName) {
                this.guestPlayerName = gameData.guestName;
                if (this.isRoomHost) {
                    this.showWaitingState();
                }
            }
            this.updatePlayerInfo();

            if (gameData.board) this.syncBoard(gameData.board);

            if (gameData.currentPlayer !== this.currentPlayer) {
                this.currentPlayer = gameData.currentPlayer;
                this.updateCurrentPlayer();
                this.restartTimer();
            }
            
            this.isMovePending = false;
            
            if (gameData.gameStarted && !this.isGameInProgress) {
                this.handleGameStart();
            }
            if (gameData.gameEnded && this.isGameInProgress) {
                this.endGame(gameData.winner);
            }
            if (gameData.gameRestarted && gameData.gameStarted && !gameData.gameEnded) {
                if (!this.isGameInProgress || !this.gameStarted) {
                    this.handleGameRestart(gameData);
                }
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
        this.board = remoteBoard;
        this.updateBoard();
    }

    handleGameStart() {
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.startGameBtnInRoom.style.display = 'none';
        this.resetBtn.style.display = 'block';
        this.startTimer();
        this.updateCurrentPlayer();
        this.updateGameStatus();
        console.log('✅ 게임 시작됨');
    }

    handleGameRestart(gameData) {
        this.board = gameData.board;
        this.currentPlayer = gameData.currentPlayer;
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.gameEnded = false;
        this.winningLine = null;
        this.startGameBtnInRoom.style.display = 'none';
        this.resetBtn.style.display = 'block';
        this.startTimer();
        this.updateBoard();
        this.updateCurrentPlayer();
        this.updateGameStatus();
        console.log('✅ 게임 재시작됨');
    }

    endGame(winner) {
        this.gameEnded = true;
        this.isGameInProgress = false;
        this.stopTimer();
        this.updateGameStatus();
        console.log('✅ 게임 종료:', winner);
    }

    async startActualGame() {
        if (!this.isRoomHost || !this.guestPlayerName) return;
        
        try {
            await this.gameRef.update({
                gameStarted: true,
                isGameInProgress: true,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('❌ Game start failed:', error);
            alert('게임 시작에 실패했습니다: ' + error.message);
        }
    }

    async makeMove(row, col) {
        if (!this.isGameInProgress || this.isMovePending) return;
        if (this.board[row][col] !== null) return;
        
        // 턴 체크
        const isMyTurn = (this.isRoomHost && this.currentPlayer === 'black') || 
                        (this.isRoomGuest && this.currentPlayer === 'white');
        if (!isMyTurn) return;
        
        this.isMovePending = true;
        this.board[row][col] = this.currentPlayer;
        this.lastMove = { row, col };
        
        // 승리 체크
        const winResult = this.checkWin(row, col);
        if (winResult.win) {
            this.winningLine = winResult.line;
            const winner = this.currentPlayer;
            
            try {
                await this.gameRef.update({
                    board: this.board,
                    gameEnded: true,
                    winner: winner,
                    lastMove: this.lastMove,
                    winningLine: this.winningLine,
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (error) {
                console.error('❌ Move update failed:', error);
            }
            return;
        }
        
        // 무승부 체크
        if (this.isBoardFull()) {
            try {
                await this.gameRef.update({
                    board: this.board,
                    gameEnded: true,
                    winner: null,
                    lastMove: this.lastMove,
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (error) {
                console.error('❌ Move update failed:', error);
            }
            return;
        }
        
        // 턴 변경
        const nextPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        
        try {
            await this.gameRef.update({
                board: this.board,
                currentPlayer: nextPlayer,
                lastMove: this.lastMove,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('❌ Move update failed:', error);
            this.isMovePending = false;
        }
    }

    checkWin(row, col) {
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
                    this.board[newRow][newCol] === player) {
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
                    this.board[newRow][newCol] === player) {
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
        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                if (this.board[row][col] === null) {
                    return false;
                }
            }
        }
        return true;
    }

    updateBoard() {
        console.log('updateBoard 호출');
        console.log('보드 상태:', this.board);
        
        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                const square = this.omokboard.children[row * 19 + col];
                if (!square) {
                    console.log(`Square not found at (${row}, ${col})`);
                    continue;
                }
                
                square.innerHTML = '';
                
                // 기존 클래스 제거
                square.classList.remove('last-move', 'disabled');
                
                if (this.board[row][col]) {
                    console.log(`돌 생성: (${row}, ${col}) = ${this.board[row][col]}`);
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
                        z-index: 40 !important;
                        top: 50% !important;
                        left: 50% !important;
                        transform: translate(-50%, -50%) !important;
                        ${this.board[row][col] === 'black' ? 
                            'background: radial-gradient(circle at 30% 30%, #666, #000) !important; color: white !important; text-shadow: 1px 1px 2px rgba(255,255,255,0.3) !important;' :
                            'background: radial-gradient(circle at 30% 30%, #fff, #e0e0e0) !important; color: black !important; text-shadow: 1px 1px 2px rgba(0,0,0,0.3) !important; border: 1px solid #ccc !important;'
                        }
                    `;
                    
                    // 승리 라인에 포함된 돌인지 확인
                    if (this.winningLine && this.winningLine.some(pos => pos.row === row && pos.col === col)) {
                        stone.classList.add('winning');
                        stone.style.animation = 'pulse 1s infinite !important';
                        stone.style.boxShadow = '0 0 0 4px #ff6b6b, 0 4px 8px rgba(0,0,0,0.3) !important';
                    }
                    
                    square.appendChild(stone);
                    console.log(`돌 추가 완료: (${row}, ${col})`);
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
        
        console.log('updateBoard 완료');
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

    async resetGameOnline() {
        if (!this.gameRef || !this.isOnlineGame) {
            this.resetGame();
            return;
        }
        try {
            await this.gameRef.update({
                board: Array(19).fill().map(() => Array(19).fill(null)),
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
        } catch (error) {
            console.error('❌ Game restart failed:', error);
            alert('게임 재시작에 실패했습니다: ' + error.message);
        }
    }

    resetGame() {
        this.board = Array(19).fill().map(() => Array(19).fill(null));
        this.currentPlayer = 'black';
        this.gameStarted = false;
        this.gameEnded = false;
        this.lastMove = null;
        this.winningLine = null;
        this.hoveredCell = null;
        this.stopTimer();
        this.updateBoard();
        this.updateCurrentPlayer();
        this.updateGameStatus();
        this.startGameBtnInRoom.style.display = 'block';
        this.resetBtn.style.display = 'none';
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
