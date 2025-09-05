class ChessGame {
    constructor() {
        this.board = [];
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameStarted = false;
        this.capturedPieces = { white: [], black: [] };
        
        // 타이머 관련 속성
        this.turnTimeLimit = 40; // 40초 제한
        this.currentTurnTime = this.turnTimeLimit;
        this.timerInterval = null;
        
        // 온라인 게임 관련 속성
        this.gameCode = null;
        this.isOnlineGame = false;
        this.isRoomCreated = false;
        this.isGameInProgress = false;
        this.isRoomHost = false;
        this.isRoomGuest = false;
        
        // 플레이어 이름
        this.hostPlayerName = '';
        this.guestPlayerName = '';
        
        // Firebase 관련
        this.database = null;
        this.playerId = this.generatePlayerId();
        this.isConnected = false;
        this.roomListeners = []; // Firebase 리스너들을 저장
        
        // 체스 기물 유니코드
        this.pieces = {
            white: {
                king: '♔',
                queen: '♕',
                rook: '♖',
                bishop: '♗',
                knight: '♘',
                pawn: '♙'
            },
            black: {
                king: '♚',
                queen: '♛',
                rook: '♜',
                bishop: '♝',
                knight: '♞',
                pawn: '♟'
            }
        };
        
        console.log('🎯 체스게임 초기화 시작');
        console.log('🆔 플레이어 ID:', this.playerId);
        
        this.initializeEventListeners();
        this.initializeFirebase();
    }
    
    async initializeFirebase() {
        console.log('🔥 Firebase 초기화 대기 중...');
        
        // Firebase가 로드될 때까지 대기
        let attempts = 0;
        while (!window.firebase && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 250));
            attempts++;
        }
        
        if (window.firebase && window.firebase.database) {
            this.database = window.firebase.database;
            this.isConnected = true;
            console.log('✅ Firebase 연결 성공');
        } else {
            console.error('❌ Firebase 초기화 실패');
            this.isConnected = false;
        }
    }
    
    // Firebase 데이터베이스 작업 메서드들
    async createRoom(hostName) {
        if (!this.database) {
            console.error('❌ Firebase 연결되지 않음');
            return false;
        }
        
        try {
            const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js');
            
            const roomCode = this.generateGameCode();
            const roomData = {
                roomCode: roomCode,
                hostId: this.playerId,
                hostName: hostName,
                guestId: null,
                guestName: null,
                gameStarted: false,
                currentPlayer: 'white',
                board: this.getInitialBoard(),
                capturedPieces: { white: [], black: [] },
                createdAt: Date.now(),
                lastActivity: Date.now()
            };
            
            await set(ref(this.database, `rooms/${roomCode}`), roomData);
            
            console.log('🏠 Firebase 방 생성 완료:', roomCode);
            
            this.gameCode = roomCode;
            this.isRoomHost = true;
            this.isRoomGuest = false;
            this.hostPlayerName = hostName;
            this.isOnlineGame = true;
            
            // 방 상태 실시간 감지 시작
            this.listenToRoom(roomCode);
            
            return true;
        } catch (error) {
            console.error('❌ Firebase 방 생성 실패:', error);
            return false;
        }
    }
    
    async joinRoom(roomCode, guestName) {
        if (!this.database) {
            console.error('❌ Firebase 연결되지 않음');
            return false;
        }
        
        try {
            const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js');
            
            // 방 존재 여부 확인
            const roomRef = ref(this.database, `rooms/${roomCode}`);
            const snapshot = await get(roomRef);
            
            if (!snapshot.exists()) {
                alert('존재하지 않는 방 코드입니다.');
                return false;
            }
            
            const roomData = snapshot.val();
            
            if (roomData.guestId) {
                alert('이미 가득 찬 방입니다.');
                return false;
            }
            
            // 방에 참가
            await update(roomRef, {
                guestId: this.playerId,
                guestName: guestName,
                lastActivity: Date.now()
            });
            
            console.log('🚪 Firebase 방 참가 완료:', roomCode);
            
            this.gameCode = roomCode;
            this.isRoomGuest = true;
            this.isRoomHost = false;
            this.guestPlayerName = guestName;
            this.hostPlayerName = roomData.hostName;
            this.isOnlineGame = true;
            
            // 방 상태 실시간 감지 시작
            this.listenToRoom(roomCode);
            
            return true;
        } catch (error) {
            console.error('❌ Firebase 방 참가 실패:', error);
            alert('방 참가에 실패했습니다: ' + error.message);
            return false;
        }
    }
    
    async listenToRoom(roomCode) {
        console.log('👂 Firebase 방 리스너 시작:', roomCode);
        
        const { ref, onValue, off } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js');
        const roomRef = ref(this.database, `rooms/${roomCode}`);
        
        // 기존 리스너 정리
        this.cleanupListeners();
        
        const listener = onValue(roomRef, (snapshot) => {
            if (snapshot.exists()) {
                const roomData = snapshot.val();
                console.log('🔥 Firebase 방 데이터 업데이트:', roomData);
                this.handleRoomUpdate(roomData);
            }
        });
        
        this.roomListeners.push({ ref: roomRef, listener });
    }
    
    handleRoomUpdate(roomData) {
        console.log('🔄 방 데이터 처리:', roomData);
        
        // 플레이어 정보 업데이트
        if (roomData.hostName) this.hostPlayerName = roomData.hostName;
        if (roomData.guestName) this.guestPlayerName = roomData.guestName;
        
        // 게임 상태 업데이트
        if (roomData.gameStarted && !this.isGameInProgress) {
            console.log('🎮 게임 시작됨');
            this.gameStarted = true;
            this.isGameInProgress = true;
            this.showGameButtons();
            this.startTurnTimer();
        }
        
        // 보드 상태 동기화
        if (roomData.board) {
            console.log('♟️ 보드 상태 동기화');
            this.board = roomData.board;
            this.currentPlayer = roomData.currentPlayer || 'white';
            this.capturedPieces = roomData.capturedPieces || { white: [], black: [] };
            this.renderBoard();
            this.updateGameStatus();
        }
        
        // 플레이어 정보 업데이트
        this.updatePlayerNames();
        
        // 방장에게 참가자 알림
        if (this.isRoomHost && roomData.guestId && roomData.guestName && !this.guestPlayerName) {
            const statusElement = document.getElementById('gameStatus');
            if (statusElement) {
                statusElement.textContent = '상대방이 접속했습니다! 게임을 시작하세요.';
                statusElement.style.color = '#28a745';
            }
        }
    }
    
    async startGame() {
        // 이름 입력 검증
        const hostNameInput = document.getElementById('hostNameInput');
        const hostName = hostNameInput.value.trim();
        
        if (!hostName) {
            this.showNameError(hostNameInput, '이름을 입력해주세요');
            return;
        }
        
        if (hostName.length < 2) {
            this.showNameError(hostNameInput, '2글자 이상 입력해주세요');
            return;
        }
        
        console.log('🎮 방 생성 시작 - 방장:', hostName);
        
        // UI 전환
        document.getElementById('gameMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        this.isRoomCreated = true;
        
        // Firebase 방 생성
        const success = await this.createRoom(hostName);
        
        if (success) {
            this.showGameCode();
            this.initializeBoard();
            this.renderBoard();
            this.showWaitingState();
            this.updatePlayerNames();
        } else {
            alert('방 생성에 실패했습니다.');
            this.backToMenu();
        }
    }
    
    async joinRoomAction() {
        // 이름 입력 검증
        const guestNameInput = document.getElementById('guestNameInput');
        const guestName = guestNameInput.value.trim();
        
        if (!guestName) {
            this.showNameError(guestNameInput, '이름을 입력해주세요');
            return;
        }
        
        if (guestName.length < 2) {
            this.showNameError(guestNameInput, '2글자 이상 입력해주세요');
            return;
        }
        
        // 코드 입력 검증
        const codeInput = document.getElementById('roomCodeInput');
        const enteredCode = codeInput.value.trim();
        
        if (enteredCode.length !== 5) {
            this.showJoinError('5자리 코드를 입력해주세요');
            return;
        }
        
        if (!/^\d{5}$/.test(enteredCode)) {
            this.showJoinError('숫자만 입력 가능합니다');
            return;
        }
        
        console.log('🚪 방 참가 시도 - 참가자:', guestName, '방 코드:', enteredCode);
        
        // UI 전환
        document.getElementById('gameMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        
        // Firebase 방 참가
        const success = await this.joinRoom(enteredCode, guestName);
        
        if (success) {
            this.initializeBoard();
            this.renderBoard();
            this.showWaitingState();
            this.updatePlayerNames();
        } else {
            this.backToMenu();
        }
    }
    
    async startActualGame() {
        if (!this.isRoomHost || !this.database) {
            console.log('⚠️ 게임 시작 권한 없음');
            return;
        }
        
        try {
            const { ref, update } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js');
            
            await update(ref(this.database, `rooms/${this.gameCode}`), {
                gameStarted: true,
                lastActivity: Date.now()
            });
            
            console.log('🎮 Firebase 게임 시작 완료');
        } catch (error) {
            console.error('❌ 게임 시작 실패:', error);
        }
    }
    
    async makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
        }
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // Firebase에 이동 정보 업데이트
        if (this.database && this.isOnlineGame && this.isGameInProgress) {
            try {
                const { ref, update } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js');
                
                const nextPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
                
                await update(ref(this.database, `rooms/${this.gameCode}`), {
                    board: this.board,
                    currentPlayer: nextPlayer,
                    capturedPieces: this.capturedPieces,
                    lastActivity: Date.now()
                });
                
                console.log('📤 Firebase 이동 업데이트 완료:', `(${fromRow},${fromCol}) → (${toRow},${toCol})`);
            } catch (error) {
                console.error('❌ Firebase 이동 업데이트 실패:', error);
            }
        }
        
        this.renderBoard();
    }
    
    cleanupListeners() {
        console.log('🧹 Firebase 리스너 정리');
        
        if (this.roomListeners.length > 0) {
            import('https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js').then(({ off }) => {
                this.roomListeners.forEach(({ ref, listener }) => {
                    off(ref, 'value', listener);
                });
                
                this.roomListeners = [];
            });
        }
    }
    
    generateGameCode() {
        // 5자리 랜덤 숫자 코드 생성
        return Math.floor(10000 + Math.random() * 90000).toString();
    }
    
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }
    
    getInitialBoard() {
        // 초기 체스보드 상태 반환
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // 백 기물 배치
        board[7] = [
            { type: 'rook', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'queen', color: 'white' },
            { type: 'king', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'rook', color: 'white' }
        ];
        
        for (let i = 0; i < 8; i++) {
            board[6][i] = { type: 'pawn', color: 'white' };
        }
        
        // 흑 기물 배치
        board[0] = [
            { type: 'rook', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'queen', color: 'black' },
            { type: 'king', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'rook', color: 'black' }
        ];
        
        for (let i = 0; i < 8; i++) {
            board[1][i] = { type: 'pawn', color: 'black' };
        }
        
        return board;
    }
    
    // UI 관련 메서드들
    initializeEventListeners() {
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetGame();
        });
        
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            this.backToMenu();
        });
        
        document.getElementById('copyCodeBtn').addEventListener('click', () => {
            this.copyGameCode();
        });
        
        document.getElementById('startGameBtnInRoom').addEventListener('click', () => {
            this.startActualGame();
        });
        
        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.joinRoomAction();
        });
        
        // 코드 입력 필드에서 Enter 키 처리
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoomAction();
            }
        });
        
        // 숫자만 입력 가능하도록 처리
        document.getElementById('roomCodeInput').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
    
    initializeBoard() {
        // 8x8 체스보드 초기화
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // 백 기물 배치
        this.board[7] = [
            { type: 'rook', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'queen', color: 'white' },
            { type: 'king', color: 'white' },
            { type: 'bishop', color: 'white' },
            { type: 'knight', color: 'white' },
            { type: 'rook', color: 'white' }
        ];
        
        for (let i = 0; i < 8; i++) {
            this.board[6][i] = { type: 'pawn', color: 'white' };
        }
        
        // 흑 기물 배치
        this.board[0] = [
            { type: 'rook', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'queen', color: 'black' },
            { type: 'king', color: 'black' },
            { type: 'bishop', color: 'black' },
            { type: 'knight', color: 'black' },
            { type: 'rook', color: 'black' }
        ];
        
        for (let i = 0; i < 8; i++) {
            this.board[1][i] = { type: 'pawn', color: 'black' };
        }
    }
    
    renderBoard() {
        const boardElement = document.getElementById('chessboard');
        boardElement.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = 'piece';
                    pieceElement.textContent = this.pieces[piece.color][piece.type];
                    square.appendChild(pieceElement);
                }
                
                square.addEventListener('click', () => {
                    this.handleSquareClick(row, col);
                });
                
                boardElement.appendChild(square);
            }
        }
        
        this.updateCapturedPieces();
    }
    
    handleSquareClick(row, col) {
        if (!this.gameStarted || !this.isGameInProgress) {
            console.log('⚠️ 게임이 시작되지 않음 또는 진행중이 아님');
            return;
        }
        
        console.log('🖱️ 클릭된 위치:', `(${row},${col})`);
        console.log('🎯 현재 턴:', this.currentPlayer);
        console.log('🏠 내가 방장:', this.isRoomHost);
        console.log('🚪 내가 참가자:', this.isRoomGuest);
        
        // 플레이어 권한 체크
        const myColor = this.isRoomHost ? 'white' : 'black';
        console.log('🎨 내 색깔:', myColor);
        
        if (this.currentPlayer !== myColor) {
            console.log('⚠️ 내 차례가 아님 - 현재:', this.currentPlayer, '나:', myColor);
            return;
        }
        
        const piece = this.board[row][col];
        console.log('♟️ 클릭된 기물:', piece);
        
        // 기물을 선택하지 않은 상태에서 클릭
        if (!this.selectedSquare) {
            if (piece && piece.color === this.currentPlayer) {
                console.log('✅ 기물 선택:', piece);
                this.selectedSquare = { row, col };
                this.highlightValidMoves(row, col);
            } else {
                console.log('⚠️ 선택할 수 없는 기물');
            }
        } else {
            // 이미 기물을 선택한 상태에서 클릭
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                // 같은 칸을 다시 클릭 (선택 해제)
                console.log('❌ 기물 선택 해제');
                this.selectedSquare = null;
                this.clearHighlights();
            } else if (piece && piece.color === this.currentPlayer) {
                // 같은 색 기물을 클릭 (다른 기물 선택)
                console.log('🔄 다른 기물 선택:', piece);
                this.selectedSquare = { row, col };
                this.clearHighlights();
                this.highlightValidMoves(row, col);
            } else {
                // 이동 시도
                console.log('🎯 이동 시도:', `(${this.selectedSquare.row},${this.selectedSquare.col}) → (${row},${col})`);
                if (this.isValidMove(this.selectedSquare.row, this.selectedSquare.col, row, col)) {
                    console.log('✅ 유효한 이동');
                    this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
                    this.selectedSquare = null;
                    this.clearHighlights();
                    this.switchPlayer();
                    this.updateGameStatus();
                } else {
                    console.log('❌ 유효하지 않은 이동');
                    this.selectedSquare = null;
                    this.clearHighlights();
                }
            }
        }
    }
    
    highlightValidMoves(row, col) {
        this.clearHighlights();
        
        // 선택된 칸 하이라이트
        const selectedSquare = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        selectedSquare.classList.add('selected');
        
        // 유효한 이동 칸들 하이라이트
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.isValidMove(row, col, r, c)) {
                    const targetSquare = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (this.board[r][c]) {
                        targetSquare.classList.add('capture');
                    } else {
                        targetSquare.classList.add('valid-move');
                    }
                }
            }
        }
    }
    
    clearHighlights() {
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'valid-move', 'capture');
        });
    }
    
    isValidMove(fromRow, fromCol, toRow, toCol) {
        // 기본적인 유효성 검사
        if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;
        if (fromRow === toRow && fromCol === toCol) return false;
        
        const piece = this.board[fromRow][fromCol];
        const targetPiece = this.board[toRow][toCol];
        
        if (!piece) return false;
        if (targetPiece && targetPiece.color === piece.color) return false;
        
        // 기물별 이동 규칙 (기본적인 구현)
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        
        switch (piece.type) {
            case 'pawn':
                return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, piece.color);
            case 'rook':
                return (rowDiff === 0 || colDiff === 0) && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'bishop':
                return rowDiff === colDiff && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'queen':
                return (rowDiff === 0 || colDiff === 0 || rowDiff === colDiff) && 
                       this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'king':
                return rowDiff <= 1 && colDiff <= 1;
            case 'knight':
                return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
            default:
                return false;
        }
    }
    
    isValidPawnMove(fromRow, fromCol, toRow, toCol, color) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);
        
        // 전진
        if (fromCol === toCol && !this.board[toRow][toCol]) {
            if (rowDiff === direction) return true;
            if (fromRow === startRow && rowDiff === 2 * direction) return true;
        }
        
        // 대각선 공격
        if (colDiff === 1 && rowDiff === direction && this.board[toRow][toCol]) {
            return true;
        }
        
        return false;
    }
    
    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
        const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.board[currentRow][currentCol]) return false;
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return true;
    }
    
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.resetTurnTimer();
    }
    
    updateGameStatus() {
        const playerText = this.currentPlayer === 'white' ? '백의 차례' : '흑의 차례';
        document.getElementById('currentPlayer').textContent = playerText;
        document.getElementById('gameStatus').textContent = '게임이 진행 중입니다';
        this.updateTimerDisplay();
    }
    
    updateCapturedPieces() {
        const capturedWhiteElement = document.getElementById('capturedWhite');
        const capturedBlackElement = document.getElementById('capturedBlack');
        
        capturedWhiteElement.innerHTML = this.capturedPieces.white
            .map(piece => this.pieces.white[piece.type]).join(' ');
        capturedBlackElement.innerHTML = this.capturedPieces.black
            .map(piece => this.pieces.black[piece.type]).join(' ');
    }
    
    // 타이머 관련 메서드들
    startTurnTimer() {
        this.stopTurnTimer(); // 기존 타이머 정리
        this.currentTurnTime = this.turnTimeLimit;
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.currentTurnTime--;
            this.updateTimerDisplay();
            
            if (this.currentTurnTime <= 0) {
                this.handleTimeOut();
            }
        }, 1000);
    }
    
    stopTurnTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    resetTurnTimer() {
        this.currentTurnTime = this.turnTimeLimit;
        this.startTurnTimer();
    }
    
    updateTimerDisplay() {
        const timerElement = document.getElementById('turnTimer');
        if (timerElement) {
            timerElement.textContent = this.currentTurnTime;
            
            // 5초 이하일 때 경고 스타일 적용
            if (this.currentTurnTime <= 5) {
                timerElement.classList.add('warning');
            } else {
                timerElement.classList.remove('warning');
            }
        }
    }
    
    handleTimeOut() {
        this.stopTurnTimer();
        this.makeRandomMove();
        this.selectedSquare = null;
        this.clearHighlights();
        this.switchPlayer();
        this.updateGameStatus();
    }
    
    makeRandomMove() {
        const validMoves = this.getAllValidMoves(this.currentPlayer);
        
        if (validMoves.length > 0) {
            const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            this.makeMove(randomMove.fromRow, randomMove.fromCol, randomMove.toRow, randomMove.toCol);
        }
    }
    
    getAllValidMoves(player) {
        const validMoves = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === player) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isValidMove(row, col, toRow, toCol)) {
                                validMoves.push({
                                    fromRow: row,
                                    fromCol: col,
                                    toRow: toRow,
                                    toCol: toCol
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return validMoves;
    }
    
    // 게임 코드 관련 메서드들
    showGameCode() {
        const gameCodeContainer = document.getElementById('gameCodeContainer');
        const gameCodeElement = document.getElementById('gameCode');
        
        if (gameCodeContainer && gameCodeElement && this.gameCode) {
            gameCodeElement.textContent = this.gameCode;
            gameCodeContainer.style.display = 'flex';
        }
    }
    
    hideGameCode() {
        const gameCodeContainer = document.getElementById('gameCodeContainer');
        if (gameCodeContainer) {
            gameCodeContainer.style.display = 'none';
        }
        this.gameCode = null;
    }
    
    copyGameCode() {
        if (this.gameCode) {
            navigator.clipboard.writeText(this.gameCode).then(() => {
                // 복사 성공 피드백
                const copyBtn = document.getElementById('copyCodeBtn');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓';
                copyBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = 'linear-gradient(135deg, #17a2b8, #138496)';
                }, 1500);
            }).catch(err => {
                console.error('코드 복사 실패:', err);
                // 복사 실패시 텍스트 선택으로 대체
                const gameCodeElement = document.getElementById('gameCode');
                if (gameCodeElement) {
                    const range = document.createRange();
                    range.selectNodeContents(gameCodeElement);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            });
        }
    }
    
    // 대기 상태 표시
    showWaitingState() {
        const playerElement = document.getElementById('currentPlayer');
        const statusElement = document.getElementById('gameStatus');
        const startBtn = document.getElementById('startGameBtnInRoom');
        
        if (playerElement) playerElement.textContent = '대기 중';
        
        if (this.isRoomHost) {
            if (statusElement) statusElement.textContent = '상대방을 기다리고 있습니다. 코드를 공유하세요!';
            if (startBtn) startBtn.style.display = 'inline-block';
        } else if (this.isRoomGuest) {
            if (statusElement) statusElement.textContent = '방장이 게임을 시작하기를 기다리고 있습니다';
            if (startBtn) startBtn.style.display = 'none';
        }
        
        this.hideResetButton();
        this.updateTimerDisplay();
        this.updatePlayerNames(); // 플레이어 컨테이너 업데이트
    }
    
    // 게임 중 버튼들 표시
    showGameButtons() {
        const startBtn = document.getElementById('startGameBtnInRoom');
        const resetBtn = document.getElementById('resetBtn');
        
        if (startBtn) startBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'inline-block';
    }
    
    // 리셋 버튼 숨기기
    hideResetButton() {
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) resetBtn.style.display = 'none';
    }
    
    // 모든 버튼 숨기기
    hideAllButtons() {
        const startBtn = document.getElementById('startGameBtnInRoom');
        const resetBtn = document.getElementById('resetBtn');
        
        if (startBtn) startBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
    }
    
    showJoinError(message) {
        const joinBtn = document.getElementById('joinRoomBtn');
        const originalText = joinBtn.textContent;
        
        joinBtn.textContent = message;
        joinBtn.style.background = 'linear-gradient(45deg, #dc3545, #c82333)';
        joinBtn.disabled = true;
        
        setTimeout(() => {
            joinBtn.textContent = originalText;
            joinBtn.style.background = 'linear-gradient(45deg, #4ecdc4, #44a08d)';
            joinBtn.disabled = false;
        }, 2000);
    }
    
    clearRoomCodeInput() {
        const codeInput = document.getElementById('roomCodeInput');
        if (codeInput) {
            codeInput.value = '';
        }
    }
    
    // 이름 관련 메서드들
    showNameError(inputElement, message) {
        const originalBorder = inputElement.style.borderColor;
        const originalPlaceholder = inputElement.placeholder;
        
        inputElement.style.borderColor = '#dc3545';
        inputElement.placeholder = message;
        inputElement.value = '';
        
        setTimeout(() => {
            inputElement.style.borderColor = originalBorder;
            inputElement.placeholder = originalPlaceholder;
        }, 3000);
    }
    
    clearNameInputs() {
        const hostNameInput = document.getElementById('hostNameInput');
        const guestNameInput = document.getElementById('guestNameInput');
        
        if (hostNameInput) hostNameInput.value = '';
        if (guestNameInput) guestNameInput.value = '';
    }
    
    updatePlayerNames() {
        // 방장은 백 기물, 참가자는 흑 기물
        const whitePlayerElement = document.getElementById('whitePlayerName');
        const blackPlayerElement = document.getElementById('blackPlayerName');
        const whiteContainer = document.getElementById('whitePlayerContainer');
        const blackContainer = document.getElementById('blackPlayerContainer');
        
        // 방장 (백 기물) 이름 표시
        if (whitePlayerElement) {
            if (this.hostPlayerName) {
                whitePlayerElement.textContent = this.hostPlayerName;
                whitePlayerElement.classList.remove('waiting');
            } else {
                whitePlayerElement.textContent = '접속대기중...';
                whitePlayerElement.classList.add('waiting');
            }
        }
        
        // 참가자 (흑 기물) 이름 표시
        if (blackPlayerElement) {
            if (this.guestPlayerName) {
                blackPlayerElement.textContent = this.guestPlayerName;
                blackPlayerElement.classList.remove('waiting');
            } else {
                blackPlayerElement.textContent = '접속대기중...';
                blackPlayerElement.classList.add('waiting');
            }
        }
        
        // 컨테이너 항상 표시 (방이 생성되었거나 참가했을 때)
        if (whiteContainer && (this.isRoomHost || this.isRoomGuest)) {
            whiteContainer.style.display = 'flex';
        }
        
        if (blackContainer && (this.isRoomHost || this.isRoomGuest)) {
            blackContainer.style.display = 'flex';
        }
    }
    
    hidePlayerNames() {
        const whiteContainer = document.getElementById('whitePlayerContainer');
        const blackContainer = document.getElementById('blackPlayerContainer');
        
        if (whiteContainer) {
            whiteContainer.style.display = 'none';
        }
        
        if (blackContainer) {
            blackContainer.style.display = 'none';
        }
    }
    
    resetGame() {
        this.stopTurnTimer();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.capturedPieces = { white: [], black: [] };
        this.currentTurnTime = this.turnTimeLimit;
        this.isGameInProgress = false;
        this.initializeBoard();
        this.renderBoard();
        this.showWaitingState();
    }
    
    backToMenu() {
        this.stopTurnTimer();
        this.cleanupListeners();
        this.hideGameCode();
        this.hideAllButtons();
        this.clearRoomCodeInput();
        this.clearNameInputs();
        this.hidePlayerNames();
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('gameMenu').style.display = 'block';
        this.gameStarted = false;
        this.isRoomCreated = false;
        this.isGameInProgress = false;
        this.isRoomHost = false;
        this.isRoomGuest = false;
        this.isOnlineGame = false;
        this.hostPlayerName = '';
        this.guestPlayerName = '';
    }
}

// 전역에서 접근 가능하도록 설정
window.ChessGame = ChessGame;