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
        
        // HTTP API 통신 (WebSocket 대신)
        this.ws = null;
        this.apiUrl = window.location.origin;
        this.playerId = this.generatePlayerId();
        this.isConnected = true; // HTTP는 항상 연결됨
        this.pollingInterval = null;
        
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
        console.log('🌐 API URL:', this.apiUrl);
        console.log('🔌 HTTP 연결 상태: 항상 연결됨');
        
        this.initializeEventListeners();
        this.startMessagePolling();
    }
    
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
            this.joinRoom();
        });
        
        // 코드 입력 필드에서 Enter 키 처리
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
        
        // 숫자만 입력 가능하도록 처리
        document.getElementById('roomCodeInput').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
    
    startGame() {
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
        console.log('🔌 WebSocket 연결 상태:', this.isConnected);
        
        // 온라인 방 생성
        this.hostPlayerName = hostName;
        document.getElementById('gameMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        this.isRoomCreated = true;
        this.isOnlineGame = true;
        this.isRoomHost = true;
        
        console.log('📤 서버에 방 생성 요청 전송');
        // HTTP API로 방 생성 요청
        this.sendMessage({
            type: 'create_room',
            hostName: hostName,
            playerId: this.playerId
        });
        
        this.initializeBoard();
        this.renderBoard();
        this.showWaitingState();
        this.updatePlayerNames();
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
        if (!this.gameStarted || !this.isGameInProgress) return;
        
        const piece = this.board[row][col];
        
        // 기물을 선택하지 않은 상태에서 클릭
        if (!this.selectedSquare) {
            if (piece && piece.color === this.currentPlayer) {
                this.selectedSquare = { row, col };
                this.highlightValidMoves(row, col);
            }
        } else {
            // 이미 기물을 선택한 상태에서 클릭
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                // 같은 칸을 다시 클릭 (선택 해제)
                this.selectedSquare = null;
                this.clearHighlights();
            } else if (piece && piece.color === this.currentPlayer) {
                // 같은 색 기물을 클릭 (다른 기물 선택)
                this.selectedSquare = { row, col };
                this.clearHighlights();
                this.highlightValidMoves(row, col);
            } else {
                // 이동 시도
                if (this.isValidMove(this.selectedSquare.row, this.selectedSquare.col, row, col)) {
                    this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
                    this.selectedSquare = null;
                    this.clearHighlights();
                    this.switchPlayer();
                    this.updateGameStatus();
                } else {
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
    
    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
        }
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // 온라인 모드에서 상대방에게 이동 전송
        if (this.isConnected && this.isOnlineGame) {
            const moveData = {
                type: 'game_move',
                fromRow: fromRow,
                fromCol: fromCol,
                toRow: toRow,
                toCol: toCol,
                capturedPiece: capturedPiece,
                nextPlayer: this.currentPlayer === 'white' ? 'black' : 'white',
                roomCode: this.gameCode
            };
            console.log('📤 내 이동 전송:', `(${fromRow},${fromCol}) → (${toRow},${toCol})`);
            this.sendMessage(moveData);
        } else {
            console.log('⚠️ 오프라인 모드 - 이동 전송 안함');
        }
        
        this.renderBoard();
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
    generateGameCode() {
        // 5자리 랜덤 숫자 코드 생성
        this.gameCode = Math.floor(10000 + Math.random() * 90000).toString();
    }
    
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
    
    // 실제 게임 시작 메서드
    startActualGame() {
        if (this.isConnected && this.isOnlineGame && this.isRoomHost) {
            // 서버에 게임 시작 요청
            this.sendMessage({
                type: 'start_game',
                roomCode: this.gameCode
            });
        }
        
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.updateGameStatus();
        this.showGameButtons();
        this.startTurnTimer();
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
    
    // 방 참가 관련 메서드들
    joinRoom() {
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
        console.log('🔌 WebSocket 연결 상태:', this.isConnected);
        
        // 온라인 방 참가
        this.guestPlayerName = guestName;
        this.isRoomGuest = true;
        
        console.log('📤 서버에 방 참가 요청 전송');
        // HTTP API로 방 참가 요청
        this.sendMessage({
            type: 'join_room',
            roomCode: enteredCode,
            guestName: guestName,
            playerId: this.playerId
        });
        
        // UI 전환
        console.log('🎨 UI 전환: 메뉴 → 게임');
        document.getElementById('gameMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        this.isOnlineGame = true;
        this.initializeBoard();
        this.renderBoard();
        this.showWaitingState();
        this.updatePlayerNames();
    }
    
    simulateJoinRoom(code) {
        // 방 참가 시뮬레이션
        document.getElementById('gameMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        
        this.isRoomGuest = true;
        this.isOnlineGame = true;
        this.gameCode = code;
        // 시뮬레이션: 방장 이름을 임의로 설정 (실제로는 서버에서 받아옴)
        if (!this.hostPlayerName) {
            this.hostPlayerName = '방장';
        }
        this.showGameCode();
        this.initializeBoard();
        this.renderBoard();
        
        // 참가 성공 메시지
        const statusElement = document.getElementById('gameStatus');
        if (statusElement) {
            statusElement.textContent = `방 ${code}에 참가했습니다!`;
            setTimeout(() => {
                this.showWaitingState();
            }, 2000);
        } else {
            this.showWaitingState();
        }
        
        // 즉시 플레이어 정보 업데이트
        this.updatePlayerNames();
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
    
    // WebSocket 통신 메서드들
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }
    
    connectWebSocket() {
        try {
            console.log('WebSocket 연결 시도:', this.wsUrl);
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket 연결 성공!');
                this.isConnected = true;
                this.updateConnectionStatus('연결됨');
                this.sendMessage({
                    type: 'player_connect',
                    playerId: this.playerId
                });
            };
            
            this.ws.onmessage = (event) => {
                console.log('📨 메시지 수신:', event.data);
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            };
            
            this.ws.onclose = (event) => {
                console.log('❌ WebSocket 연결 종료:', event.code, event.reason);
                this.isConnected = false;
                this.updateConnectionStatus('연결 끊김');
                // 재연결 시도 제거 (Vercel에서는 효과 없음)
            };
            
            this.ws.onerror = (error) => {
                console.error('🚨 WebSocket 오류:', error);
                this.isConnected = false;
                this.updateConnectionStatus('연결 실패');
            };
            
        } catch (error) {
            console.error('🚨 WebSocket 연결 실패:', error);
            this.isConnected = false;
            this.updateConnectionStatus('WebSocket 지원 안됨');
            // 로컬 테스트를 위한 시뮬레이션 모드로 전환
            this.simulationMode = true;
        }
    }
    
    updateConnectionStatus(status) {
        // 연결 상태를 화면에 표시
        console.log('🔌 연결 상태:', status);
        const statusElement = document.getElementById('gameStatus');
        if (statusElement && !this.isGameInProgress) {
            statusElement.style.color = this.isConnected ? '#28a745' : '#dc3545';
            statusElement.textContent = `연결 상태: ${status}`;
        }
    }
    
    async sendMessage(message) {
        console.log('📤 HTTP API 요청:', message.type);
        try {
            const response = await fetch(`${this.apiUrl}/api/action`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            });
            
            const result = await response.json();
            console.log('📥 API 응답:', result);
            
            if (result.success) {
                this.handleApiResponse(result);
            } else if (result.error) {
                console.error('❌ API 오류:', result.error);
                alert('오류: ' + result.error);
            }
        } catch (error) {
            console.error('🚨 HTTP 요청 실패:', error);
            this.handleLocalSimulation(message);
        }
    }
    
    handleApiResponse(response) {
        // API 응답을 WebSocket 메시지 형식으로 변환하여 기존 핸들러 사용
        switch (response.type) {
            case 'room_created':
                this.handleRoomCreated(response);
                break;
            case 'room_joined':
                this.handleRoomJoined(response);
                break;
            case 'game_start':
                this.handleGameStart(response);
                break;
        }
    }
    
    startMessagePolling() {
        console.log('🔄 메시지 폴링 시작');
        this.pollingInterval = setInterval(() => {
            this.checkMessages();
        }, 1000); // 1초마다 메시지 확인
    }
    
    async checkMessages() {
        try {
            const response = await fetch(`${this.apiUrl}/api/messages/${this.playerId}`);
            const result = await response.json();
            
            if (result.messages && result.messages.length > 0) {
                console.log('📬 새 메시지 수신:', result.messages.length, '개');
                for (const message of result.messages) {
                    this.handleWebSocketMessage(message);
                }
            }
        } catch (error) {
            console.error('메시지 폴링 오류:', error);
        }
    }
    
    handleLocalSimulation(message) {
        // WebSocket 연결이 안 될 때 로컬 시뮬레이션
        console.log('🎭 로컬 시뮬레이션:', message.type);
        
        switch (message.type) {
            case 'create_room':
                setTimeout(() => {
                    if (!this.gameCode) {
                        this.generateGameCode();
                    }
                    this.handleRoomCreated({
                        roomCode: this.gameCode,
                        hostName: message.hostName
                    });
                }, 500);
                break;
                
            case 'join_room':
                setTimeout(() => {
                    // 방 참가 시뮬레이션
                    this.handleRoomJoined({
                        roomCode: message.roomCode,
                        hostName: '시뮬 방장',
                        guestName: message.guestName
                    });
                }, 500);
                break;
                
            case 'start_game':
                setTimeout(() => {
                    this.handleGameStart({
                        roomCode: message.roomCode
                    });
                }, 500);
                break;
        }
    }
    
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'room_created':
                this.handleRoomCreated(message);
                break;
            case 'room_joined':
                this.handleRoomJoined(message);
                break;
            case 'player_joined':
                this.handlePlayerJoined(message);
                break;
            case 'game_move':
                this.handleGameMove(message);
                break;
            case 'game_start':
                this.handleGameStart(message);
                break;
            case 'timer_sync':
                this.handleTimerSync(message);
                break;
            case 'game_reset':
                this.handleGameReset(message);
                break;
            case 'error':
                this.handleError(message);
                break;
        }
    }
    
    // 서버 메시지 핸들러들
    handleRoomCreated(message) {
        console.log('✅ 방 생성 완료:', message);
        this.gameCode = message.roomCode;
        this.isRoomHost = true;
        this.hostPlayerName = message.hostName;
        this.showGameCode();
        this.updatePlayerNames();
        console.log('🏠 방장 설정 완료 - 코드:', this.gameCode);
    }
    
    handleRoomJoined(message) {
        console.log('✅ 방 참가 완료:', message);
        this.gameCode = message.roomCode;
        this.isRoomGuest = true;
        this.hostPlayerName = message.hostName;
        this.guestPlayerName = message.guestName;
        this.updatePlayerNames();
        console.log('🚪 참가자 설정 완료 - 방장:', this.hostPlayerName, '참가자:', this.guestPlayerName);
    }
    
    handlePlayerJoined(message) {
        console.log('🎉 상대방 참가:', message);
        if (this.isRoomHost) {
            this.guestPlayerName = message.guestName;
            this.updatePlayerNames();
            // 방장에게 게임 시작 권한 알림
            const statusElement = document.getElementById('gameStatus');
            if (statusElement) {
                statusElement.textContent = '상대방이 접속했습니다! 게임을 시작하세요.';
                statusElement.style.color = '#28a745';
            }
            console.log('🎮 게임 시작 가능 상태!');
        }
    }
    
    handleGameMove(message) {
        console.log('♟️ 상대방 이동 수신:', `(${message.fromRow},${message.fromCol}) → (${message.toRow},${message.toCol})`);
        
        // 상대방의 이동을 내 보드에 반영
        this.board[message.toRow][message.toCol] = this.board[message.fromRow][message.fromCol];
        this.board[message.fromRow][message.fromCol] = null;
        
        // 잡힌 기물 처리
        if (message.capturedPiece) {
            console.log('⚔️ 기물 잡힘:', message.capturedPiece);
            this.capturedPieces[message.capturedPiece.color].push(message.capturedPiece);
        }
        
        this.renderBoard();
        this.currentPlayer = message.nextPlayer;
        this.updateGameStatus();
        this.resetTurnTimer();
        console.log('🔄 보드 업데이트 완료, 다음 플레이어:', this.currentPlayer);
    }
    
    handleGameStart(message) {
        this.isGameInProgress = true;
        this.currentPlayer = 'white';
        this.showGameButtons();
        this.updateGameStatus();
        this.startTurnTimer();
    }
    
    handleTimerSync(message) {
        this.currentTurnTime = message.timeLeft;
        this.updateTimerDisplay();
    }
    
    handleGameReset(message) {
        this.resetGame();
    }
    
    handleError(message) {
        alert('오류: ' + message.message);
    }
}

// 게임 시작
document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});
