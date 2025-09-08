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
        
        // Firebase 관련
        this.database = null;
        this.gameRef = null;
        this.isHost = false;
        this.playerName = '';
        this.roomCode = '';
        
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeFirebase();
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
        this.startGameBtnInRoom.addEventListener('click', () => this.startGame());
        this.resetBtn.addEventListener('click', () => this.resetGame());
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
    }

    initializeFirebase() {
        try {
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            this.database = firebase.database();
                console.log('✅ Firebase 초기화 완료');
            } else {
                console.log('⚠️ Firebase 설정을 찾을 수 없습니다. 오프라인 모드로 실행됩니다.');
            }
        } catch (error) {
            console.log('⚠️ Firebase 초기화 실패:', error);
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
                square.addEventListener('click', () => this.makeMove(row, col));
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

    createRoom() {
        const playerName = this.hostNameInput.value.trim();
        if (!playerName) {
            this.showError(this.hostNameInput, '이름을 입력해주세요');
            return;
        }

        this.playerName = playerName;
        this.isHost = true;
        this.roomCode = this.generateRoomCode();
        
        if (this.database) {
            this.gameRef = this.database.ref(`games/${this.roomCode}`);
            this.setupFirebaseListeners();
            this.gameRef.set({
                host: playerName,
                guest: null,
                board: this.board,
                currentPlayer: 'black',
                gameStarted: false,
                gameEnded: false,
                lastMove: null,
                createdAt: Date.now()
            });
        }

        this.showGameContainer();
        this.updatePlayerInfo();
        this.gameCodeEl.textContent = this.roomCode;
        this.gameCodeContainer.style.display = 'block';
        this.startGameBtnInRoom.style.display = 'block';
        
        console.log(`✅ 방 생성 완료: ${this.roomCode}`);
    }

    joinRoom() {
        const playerName = this.guestNameInput.value.trim();
        const roomCode = this.roomCodeInput.value.trim();
        
        if (!playerName) {
            this.showError(this.guestNameInput, '이름을 입력해주세요');
            return;
        }
        
        if (!roomCode || roomCode.length !== 5) {
            this.showError(this.roomCodeInput, '올바른 5자리 코드를 입력해주세요');
            return;
        }

        this.playerName = playerName;
        this.roomCode = roomCode;
        this.isHost = false;
        
        if (this.database) {
            this.gameRef = this.database.ref(`games/${this.roomCode}`);
            this.setupFirebaseListeners();
            
            this.gameRef.once('value', (snapshot) => {
                const gameData = snapshot.val();
                if (!gameData) {
                    this.showError(this.roomCodeInput, '존재하지 않는 방입니다');
                    return;
                }
                
                if (gameData.guest) {
                    this.showError(this.roomCodeInput, '이미 가득 찬 방입니다');
                    return;
                }
                
                this.gameRef.update({ guest: playerName });
                this.showGameContainer();
                this.updatePlayerInfo();
                this.gameCodeContainer.style.display = 'block';
                
                console.log(`✅ 방 참가 완료: ${this.roomCode}`);
            });
        } else {
            // 오프라인 모드
            this.showGameContainer();
            this.updatePlayerInfo();
            this.startGame();
        }
    }

    setupFirebaseListeners() {
        if (!this.gameRef) return;

        this.gameRef.on('value', (snapshot) => {
            const gameData = snapshot.val();
            if (!gameData) return;

            this.board = gameData.board || this.board;
            this.currentPlayer = gameData.currentPlayer || 'black';
            this.gameStarted = gameData.gameStarted || false;
            this.gameEnded = gameData.gameEnded || false;
            this.lastMove = gameData.lastMove;

            this.updateBoard();
            this.updateCurrentPlayer();
            this.updateGameStatus();
            
            if (this.gameStarted && !this.gameEnded) {
                this.startTimer();
            } else {
                this.stopTimer();
            }
        });
    }

    startGame() {
        if (!this.isHost) return;
        
        this.gameStarted = true;
        this.currentPlayer = 'black';
        this.startTimer();
        
        if (this.gameRef) {
            this.gameRef.update({
                gameStarted: true,
                currentPlayer: 'black'
            });
        }
        
        this.startGameBtnInRoom.style.display = 'none';
        this.resetBtn.style.display = 'block';
        this.updateCurrentPlayer();
        this.updateGameStatus();
        
        console.log('✅ 게임 시작');
    }

    makeMove(row, col) {
        if (!this.gameStarted || this.gameEnded) return;
        if (this.board[row][col] !== null) return;
        
        // 턴 체크 (오프라인 모드에서는 무시)
        if (this.database && this.isHost && this.currentPlayer !== 'black') return;
        if (this.database && !this.isHost && this.currentPlayer !== 'white') return;
        
        this.board[row][col] = this.currentPlayer;
        this.lastMove = { row, col };
        
        // 승리 체크
        const winResult = this.checkWin(row, col);
        if (winResult.win) {
            this.gameEnded = true;
            this.winningLine = winResult.line;
            this.stopTimer();
            this.updateGameStatus();
            
            if (this.gameRef) {
                this.gameRef.update({
                    board: this.board,
                    gameEnded: true,
                    lastMove: this.lastMove,
                    winningLine: this.winningLine
                });
            }
            return;
        }
        
        // 무승부 체크
        if (this.isBoardFull()) {
            this.gameEnded = true;
            this.stopTimer();
            this.updateGameStatus();
            
            if (this.gameRef) {
                this.gameRef.update({
                    board: this.board,
                    gameEnded: true,
                    lastMove: this.lastMove
                });
            }
            return;
        }
        
        // 턴 변경
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.restartTimer();
        
        if (this.gameRef) {
            this.gameRef.update({
                board: this.board,
                currentPlayer: this.currentPlayer,
                lastMove: this.lastMove
            });
        }
        
        this.updateBoard();
        this.updateCurrentPlayer();
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
        for (let row = 0; row < 19; row++) {
            for (let col = 0; col < 19; col++) {
                const square = this.omokboard.children[row * 19 + col];
                square.innerHTML = '';
                
                // 기존 클래스 제거
                square.classList.remove('last-move', 'disabled');
                
                if (this.board[row][col]) {
                    const stone = document.createElement('div');
                    stone.className = `stone ${this.board[row][col]}`;
                    stone.textContent = this.board[row][col] === 'black' ? '●' : '○';
                    
                    // 승리 라인에 포함된 돌인지 확인
                    if (this.winningLine && this.winningLine.some(pos => pos.row === row && pos.col === col)) {
                        stone.classList.add('winning');
                    }
                    
                    square.appendChild(stone);
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
        } else if (this.gameStarted) {
            this.gameStatusEl.textContent = '게임이 진행 중입니다';
        } else {
            this.gameStatusEl.textContent = '게임을 시작하세요';
        }
    }

    updatePlayerInfo() {
        if (this.isHost) {
            this.blackPlayerNameEl.textContent = this.playerName;
            this.whitePlayerNameEl.textContent = '대기중';
            this.blackPlayerContainer.style.display = 'flex';
            this.whitePlayerContainer.style.display = 'flex';
        } else {
            this.whitePlayerNameEl.textContent = this.playerName;
            this.blackPlayerNameEl.textContent = '대기중';
            this.blackPlayerContainer.style.display = 'flex';
            this.whitePlayerContainer.style.display = 'flex';
        }
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

    resetGame() {
        this.board = Array(19).fill().map(() => Array(19).fill(null));
        this.currentPlayer = 'black';
        this.gameStarted = false;
        this.gameEnded = false;
        this.lastMove = null;
        this.winningLine = null;
        this.hoveredCell = null;
        this.stopTimer();
        
        if (this.gameRef) {
            this.gameRef.update({
                board: this.board,
                currentPlayer: 'black',
                gameStarted: false,
                gameEnded: false,
                lastMove: null
            });
        }
        
        this.updateBoard();
        this.updateCurrentPlayer();
        this.updateGameStatus();
        this.startGameBtnInRoom.style.display = 'block';
        this.resetBtn.style.display = 'none';
        
        console.log('✅ 게임 재시작');
    }

    backToMenu() {
        this.stopTimer();
        
        if (this.gameRef) {
            this.gameRef.off();
            if (this.isHost) {
                this.gameRef.remove();
            } else {
                this.gameRef.update({ guest: null });
            }
        }
        
        this.gameMenu.style.display = 'flex';
        this.gameContainer.style.display = 'none';
        this.gameCodeContainer.style.display = 'none';
        this.startGameBtnInRoom.style.display = 'none';
        this.resetBtn.style.display = 'none';
        
        // 입력 필드 초기화
        this.hostNameInput.value = '';
        this.guestNameInput.value = '';
        this.roomCodeInput.value = '';
        
        console.log('✅ 메인 메뉴로 돌아가기');
    }

    copyGameCode() {
        navigator.clipboard.writeText(this.roomCode).then(() => {
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
