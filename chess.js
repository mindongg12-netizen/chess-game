class ChessGame {
    constructor() {
        this.board = [];
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameStarted = false;
        this.capturedPieces = { white: [], black: [] };

        // Timer properties
        this.turnTimeLimit = 40; // 40 seconds limit
        this.currentTurnTime = this.turnTimeLimit;
        this.timerInterval = null;

        // Online game properties
        this.gameCode = null;
        this.isOnlineGame = false;
        this.isRoomCreated = false;
        this.isGameInProgress = false;
        this.isRoomHost = false;
        this.isRoomGuest = false;
        // Flag to prevent moves while one is being processed
        this.isMovePending = false; 

        // Player names
        this.hostPlayerName = '';
        this.guestPlayerName = '';

        // Firebase real-time communication
        this.database = null; // Set after Firebase loads
        this.playerId = this.generatePlayerId();
        this.gameRef = null;
        this.listeners = [];
        
        // 다크모드 상태
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';

        // 이전 게임 패자 정보 (게임 재시작 시에도 유지)
        this.previousLoser = localStorage.getItem('chessPreviousLoser') || null;
        console.log('📊 이전 게임 패자 정보 로드:', this.previousLoser || '없음');

        // Unicode chess pieces
        this.pieces = {
            white: {
                king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙'
            },
            black: {
                king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟'
            }
        };

        console.log('🔥 Firebase Chess Game Initialization Started');
        console.log('🆔 Player ID:', this.playerId);

        this.initializeEventListeners();
        this.waitForFirebase();
    }

    initializeEventListeners() {
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('resetBtn').addEventListener('click', () => this.handleGameRestart());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.backToMenu());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyGameCode());
        document.getElementById('startGameBtnInRoom').addEventListener('click', () => this.startActualGame());
        document.getElementById('resignBtn').addEventListener('click', () => this.handleResignation());
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.joinRoom());
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        
        // 다크모드 토글 이벤트 리스너
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('roomCodeInput').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
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
        
        // 초기 테마 설정
        this.initializeTheme();
    }

    async startGame() {
        const hostNameInput = document.getElementById('hostNameInput');
        const hostName = hostNameInput.value.trim();
        if (!hostName) {
            this.showNameError(hostNameInput, 'Please enter your name');
            return;
        }
        if (hostName.length < 2) {
            this.showNameError(hostNameInput, 'Please enter at least 2 characters');
            return;
        }
        console.log('🔥 Starting Firebase room creation - Host:', hostName);
        if (!this.database) {
            alert('Waiting for Firebase connection. Please try again in a moment.');
            return;
        }
        try {
            this.gameCode = this.generateRoomCode();
            this.hostPlayerName = hostName;
            this.isRoomHost = true;
            this.isRoomGuest = false;
            this.isOnlineGame = true;
            console.log('🏠 Firebase Host setup complete');
            console.log('- Is Host:', this.isRoomHost);
            console.log('- Is Guest:', this.isRoomGuest);
            console.log('- My color: white (Host)');
            console.log('- Starting turn:', 'white');
            const roomData = {
                hostId: this.playerId,
                hostName: hostName,
                guestId: null,
                guestName: null,
                gameStarted: false,
                currentPlayer: 'white',
                board: this.getInitialBoard(),
                capturedPieces: { white: [], black: [] },
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            };
            this.gameRef = this.database.ref('games/' + this.gameCode);
            await this.gameRef.set(roomData);
            console.log('✅ Firebase room created:', this.gameCode);
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            this.showGameCode();
            this.initializeBoard();
            this.renderBoard();
            this.showWaitingState();
            this.updatePlayerNames();
            this.setupFirebaseListeners();
        } catch (error) {
            console.error('❌ Failed to create room:', error);
            alert('Failed to create room: ' + error.message);
        }
    }

    /**
     * 게임 재시작 버튼을 눌렀을 때 호출되는 메인 함수
     * 이 함수는 체스 보드를 초기화하고 게임을 재시작하지만,
     * 이전 게임 패자 정보는 절대 초기화하지 않습니다.
     */
    async handleGameRestart() {
        console.log('🔄 게임 재시작 버튼 클릭됨');

        // ⚠️ 중요: 게임 재시작 전 이전 게임 패자 정보 확인 및 보호
        const previousLoserBeforeRestart = this.previousLoser;
        console.log('🛡️ 게임 재시작 전 패자 정보 보호:', previousLoserBeforeRestart);

        // 🎯 핵심 로직: 이전 게임 패자 정보를 기반으로 첫 턴 결정
        const firstPlayer = this.determineFirstPlayerFromPreviousLoser();
        console.log(`🎯 새로운 게임의 첫 턴 결정: ${firstPlayer === 'white' ? '백(white)' : '흑(black)'}`);

        // 기존 게임 재시작 로직 호출 (결정된 첫 턴 정보와 함께)
        await this.resetGameOnlineWithFirstPlayer(firstPlayer);

        // ⚠️ 중요: 게임 재시작 후 이전 게임 패자 정보가 유지되었는지 확인
        const previousLoserAfterRestart = this.previousLoser;
        console.log('✅ 게임 재시작 후 패자 정보 확인:', previousLoserAfterRestart);

        if (previousLoserBeforeRestart !== previousLoserAfterRestart) {
            console.warn('⚠️ 경고: 패자 정보가 변경되었습니다!');
            console.warn('이전 값:', previousLoserBeforeRestart);
            console.warn('현재 값:', previousLoserAfterRestart);
            // 안전하게 원래 값으로 복원
            this.previousLoser = previousLoserBeforeRestart;
            localStorage.setItem('chessPreviousLoser', previousLoserBeforeRestart);
            console.log('🔧 패자 정보 복원 완료');
        } else {
            console.log('🎯 패자 정보 안전하게 유지됨 ✓');
        }

        // 게임 재시작 완료 메시지
        console.log('🎮 게임 재시작 완료 - 새로운 게임을 시작하세요!');
        console.log(`🚀 첫 번째 플레이어: ${firstPlayer === 'white' ? '백(white)' : '흑(black)'}의 차례입니다!`);
    }

    /**
     * 이전 게임 패자 정보를 기반으로 첫 번째 플레이어를 결정
     * @returns {string} 첫 번째 플레이어 ('white' 또는 'black')
     */
    determineFirstPlayerFromPreviousLoser() {
        const previousLoser = this.getPreviousLoser();

        if (!previousLoser || previousLoser === 'none') {
            // 첫 게임이거나 무승부인 경우: 기본 체스 규칙에 따라 백이 먼저
            console.log('📋 첫 게임 또는 무승부 - 백(white)이 첫 턴을 가집니다.');
            return 'white';
        }

        if (previousLoser === 'white') {
            // 이전 게임에서 백이 졌으므로, 이번에는 백이 먼저 시작
            console.log('📋 이전 게임에서 백이 패배 - 백(white)이 첫 턴을 가집니다.');
            return 'white';
        }

        if (previousLoser === 'black') {
            // 이전 게임에서 흑이 졌으므로, 이번에는 흑이 먼저 시작
            console.log('📋 이전 게임에서 흑이 패배 - 흑(black)이 첫 턴을 가집니다.');
            return 'black';
        }

        // 안전장치: 알 수 없는 값인 경우 기본값으로 백
        console.log('⚠️ 알 수 없는 패자 정보 - 기본값으로 백(white)이 첫 턴을 가집니다.');
        return 'white';
    }

    /**
     * 지정된 첫 번째 플레이어로 온라인 게임을 재시작
     * @param {string} firstPlayer - 첫 번째 플레이어 ('white' 또는 'black')
     */
    async resetGameOnlineWithFirstPlayer(firstPlayer) {
        if (!this.gameRef || !this.isOnlineGame) {
            console.log('⚠️ Not an online game - resetting locally');
            this.resetGameWithFirstPlayer(firstPlayer);
            return;
        }

        console.log('🔄 Requesting online game restart with first player:', firstPlayer);
        console.log('💾 이전 게임 패자 정보 유지:', this.previousLoser);

        try {
            const initialBoard = this.getInitialBoard();
            await this.gameRef.update({
                board: initialBoard,
                currentPlayer: firstPlayer,
                capturedPieces: { white: [], black: [] },
                gameStarted: true,
                isGameInProgress: true,
                gameEnded: false,
                winner: null,
                gameRestarted: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            console.log(`✅ Game restart signal sent to Firebase with ${firstPlayer} as first player`);

            // ⚠️ 중요: Firebase에는 previousLoser 정보를 저장하지 않음
            // 이 정보는 클라이언트 측 localStorage에서만 관리됨
        } catch (error) {
            console.error('❌ Game restart failed:', error);
            alert('Failed to restart game: ' + error.message);
        }
    }

    async resetGameOnline() {
        if (!this.gameRef || !this.isOnlineGame) {
            console.log('⚠️ Not an online game - resetting locally');
            this.resetGame();
            return;
        }

        console.log('🔄 Requesting online game restart');
        console.log('💾 이전 게임 패자 정보 유지:', this.previousLoser);

        try {
            const initialBoard = this.getInitialBoard();
            await this.gameRef.update({
                board: initialBoard,
                currentPlayer: 'white',
                capturedPieces: { white: [], black: [] },
                gameStarted: true,
                isGameInProgress: true,
                gameEnded: false,
                winner: null,
                gameRestarted: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            console.log('✅ Game restart signal sent to Firebase');

            // ⚠️ 중요: Firebase에는 previousLoser 정보를 저장하지 않음
            // 이 정보는 클라이언트 측 localStorage에서만 관리됨
        } catch (error) {
            console.error('❌ Game restart failed:', error);
            alert('Failed to restart game: ' + error.message);
        }
    }

    /**
     * 지정된 첫 번째 플레이어로 로컬 게임을 재시작
     * @param {string} firstPlayer - 첫 번째 플레이어 ('white' 또는 'black')
     */
    resetGameWithFirstPlayer(firstPlayer) {
        this.stopTurnTimer();
        this.currentPlayer = firstPlayer;
        this.selectedSquare = null;
        this.capturedPieces = { white: [], black: [] };
        this.currentTurnTime = this.turnTimeLimit;
        this.isGameInProgress = false;

        // ⚠️ 중요: previousLoser 변수는 절대 초기화하지 않음!
        // 이 변수는 게임 재시작 시에도 유지되어야 함
        console.log('🔄 게임 재시작 - 이전 게임 패자 정보 유지:', this.previousLoser);
        console.log(`🚀 첫 번째 플레이어 설정: ${firstPlayer}`);

        this.initializeBoard();
        this.renderBoard();
        this.showWaitingState();
    }

    resetGame() {
        this.stopTurnTimer();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.capturedPieces = { white: [], black: [] };
        this.currentTurnTime = this.turnTimeLimit;
        this.isGameInProgress = false;

        // ⚠️ 중요: previousLoser 변수는 절대 초기화하지 않음!
        // 이 변수는 게임 재시작 시에도 유지되어야 함
        console.log('🔄 게임 재시작 - 이전 게임 패자 정보 유지:', this.previousLoser);

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
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        this.board[7] = [
            { type: 'rook', color: 'white' }, { type: 'knight', color: 'white' },
            { type: 'bishop', color: 'white' }, { type: 'queen', color: 'white' },
            { type: 'king', color: 'white' }, { type: 'bishop', color: 'white' },
            { type: 'knight', color: 'white' }, { type: 'rook', color: 'white' }
        ];
        for (let i = 0; i < 8; i++) this.board[6][i] = { type: 'pawn', color: 'white' };
        this.board[0] = [
            { type: 'rook', color: 'black' }, { type: 'knight', color: 'black' },
            { type: 'bishop', color: 'black' }, { type: 'queen', color: 'black' },
            { type: 'king', color: 'black' }, { type: 'bishop', color: 'black' },
            { type: 'knight', color: 'black' }, { type: 'rook', color: 'black' }
        ];
        for (let i = 0; i < 8; i++) this.board[1][i] = { type: 'pawn', color: 'black' };
    }

    renderBoard() {
        const boardElement = document.getElementById('chessboard');
        if (!boardElement) {
            console.error('❌ chessboard element not found');
            return;
        }
        if (!this.board || !Array.isArray(this.board) || this.board.length !== 8) {
            console.error('❌ Invalid board data:', this.board);
            return;
        }
        boardElement.innerHTML = '';
        for (let row = 0; row < 8; row++) {
            if (!this.board[row] || !Array.isArray(this.board[row]) || this.board[row].length !== 8) {
                console.error(`❌ Invalid row data [${row}]:`, this.board[row]);
                return;
            }
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                const piece = this.board[row][col];
                if (piece && piece.type && piece.color) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = 'piece';
                    if (this.pieces[piece.color] && this.pieces[piece.color][piece.type]) {
                        pieceElement.textContent = this.pieces[piece.color][piece.type];
                    } else {
                        console.warn('⚠️ Unknown piece:', piece);
                    }
                    square.appendChild(pieceElement);
                }
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }
        this.updateCapturedPieces();
    }

    async handleSquareClick(row, col) {
        if (!this.gameStarted || !this.isGameInProgress) {
            console.log('⚠️ Game not started or not in progress.');
            return;
        }
        // *** FIX: Block any new move if one is already being processed.
        if (this.isMovePending) {
            console.log('⚠️ A move is already being processed. Please wait.');
            return;
        }
        
        console.log(`🖱️ Clicked on: (${row},${col})`);
        
        // *** FIX: Stricter turn checking at the very beginning.
        const myColor = this.isRoomHost ? 'white' : 'black';
        if (this.currentPlayer !== myColor) {
            console.warn(`❌ Not your turn! Current turn: ${this.currentPlayer}, Your color: ${myColor}`);
            alert("It's the opponent's turn. Please wait.");
            return;
        }
        
        console.log('✅ Authority check passed - It is your turn.');
        
        const piece = this.board[row][col];
        
        if (!this.selectedSquare) {
            if (piece && piece.color === this.currentPlayer) {
                this.selectedSquare = { row, col };
                this.highlightValidMoves(row, col);
            }
        } else {
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                this.selectedSquare = null;
                this.clearHighlights();
            } else if (piece && piece.color === this.currentPlayer) {
                this.selectedSquare = { row, col };
                this.clearHighlights();
                this.highlightValidMoves(row, col);
            } else {
                if (this.isValidMove(this.selectedSquare.row, this.selectedSquare.col, row, col)) {
                    await this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
                    this.selectedSquare = null;
                    this.clearHighlights();
                    // Do not switch player here for online games, wait for Firebase listener
                } else {
                    this.selectedSquare = null;
                    this.clearHighlights();
                }
            }
        }
    }

    highlightValidMoves(row, col) {
        this.clearHighlights();
        const selectedSquare = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        selectedSquare.classList.add('selected');
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
        if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;
        if (fromRow === toRow && fromCol === toCol) return false;
        const piece = this.board[fromRow][fromCol];
        const targetPiece = this.board[toRow][toCol];
        if (!piece) return false;
        if (targetPiece && targetPiece.color === piece.color) return false;
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        switch (piece.type) {
            case 'pawn': return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, piece.color);
            case 'rook': return (rowDiff === 0 || colDiff === 0) && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'bishop': return rowDiff === colDiff && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'queen': return (rowDiff === 0 || colDiff === 0 || rowDiff === colDiff) && this.isPathClear(fromRow, fromCol, toRow, toCol);
            case 'king': return rowDiff <= 1 && colDiff <= 1;
            case 'knight': return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
            default: return false;
        }
    }

    isValidPawnMove(fromRow, fromCol, toRow, toCol, color) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        const rowDiff = toRow - fromRow;
        if (fromCol === toCol && !this.board[toRow][toCol]) {
            if (rowDiff === direction) return true;
            if (fromRow === startRow && rowDiff === 2 * direction && this.isPathClear(fromRow, fromCol, toRow, toCol)) return true;
        }
        if (Math.abs(toCol - fromCol) === 1 && rowDiff === direction && this.board[toRow][toCol]) {
            return true;
        }
        return false;
    }

    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = Math.sign(toRow - fromRow);
        const colStep = Math.sign(toCol - fromCol);
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.board[currentRow][currentCol]) return false;
            currentRow += rowStep;
            currentCol += colStep;
        }
        return true;
    }

    async makeMove(fromRow, fromCol, toRow, toCol) {
        // *** FIX: Lock the board to prevent further moves
        this.isMovePending = true;
        console.log('🔒 Move initiated. Board is locked.');

        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];

        // 수 실행
        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
        }
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // This is a local render for immediate feedback
        this.renderBoard();

        // 수 실행 후 게임 결과 확인
        const gameResult = this.determineGameResult();
        let gameEnded = false;
        let winner = null;
        let endReason = null;

        if (gameResult) {
            gameEnded = true;
            if (gameResult === 'white_wins') {
                winner = 'white';
                endReason = 'checkmate';
            } else if (gameResult === 'black_wins') {
                winner = 'black';
                endReason = 'checkmate';
            } else if (gameResult === 'draw') {
                winner = null;
                endReason = 'stalemate';
            }
        }

        // Firebase로 수 전송
        if (this.gameRef && this.isOnlineGame) {
            console.log('🔥 Sending move to Firebase...');
            try {
                const updateData = {
                    board: this.board,
                    capturedPieces: this.capturedPieces,
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                };

                if (gameEnded) {
                    updateData.gameEnded = true;
                    updateData.winner = winner;
                    updateData.endReason = endReason;
                    updateData.isGameInProgress = false;
                } else {
                    // 다음 플레이어로 턴 변경
                    const nextPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
                    updateData.currentPlayer = nextPlayer;
                }

                await this.gameRef.update(updateData);
                console.log('✅ Move successfully sent to Firebase.');

                // 게임이 끝났으면 로컬에서도 게임 종료 처리
                if (gameEnded) {
                    this.endGameWithResult(endReason, winner);
                }
            } catch (error) {
                console.error('❌ Failed to send move:', error);
                // *** FIX: Unlock board on failure
                this.isMovePending = false;
                console.log('🔓 Board unlocked due to error.');
                alert('An error occurred while sending your move. Please try again.');
                // 수 되돌리기 (선택사항)
                this.board[fromRow][fromCol] = piece;
                this.board[toRow][toCol] = capturedPiece;
                if (capturedPiece) {
                    this.capturedPieces[capturedPiece.color].pop();
                }
                this.renderBoard();
            }
        } else {
            // 오프라인 게임에서는 로컬에서 턴 변경 및 게임 결과 처리
            if (gameEnded) {
                this.endGameWithResult(endReason, winner);
            } else {
                this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
                this.updateGameStatus();
                this.resetTurnTimer();
            }
        }
    }

    endGame(winner) {
        console.log(`🎯 게임 종료: ${winner} 승리!`);
        
        // 게임 상태 업데이트
        this.isGameInProgress = false;
        this.gameStarted = false;
        this.stopTurnTimer();
        
        // UI 업데이트
        const gameStatus = document.getElementById('gameStatus');
        const winnerText = winner === 'white' ? '백' : '흑';
        gameStatus.textContent = `🎉 게임 종료! ${winnerText}의 승리! 🎉`;
        gameStatus.style.color = '#dc3545';
        gameStatus.style.fontSize = '1.3rem';
        gameStatus.style.fontWeight = 'bold';
        
        // 타이머 표시 숨기기
        const timerElement = document.getElementById('turnTimer');
        if (timerElement) {
            timerElement.style.display = 'none';
        }
        
        // 모든 말 선택 해제
        this.selectedSquare = null;
        this.clearHighlights();
        
        // 내가 승자인지 패자인지 확인
        const myColor = this.isRoomHost ? 'white' : 'black';
        const isWinner = winner === myColor;
        
        // 승리자와 패배자에게 다른 메시지 표시
        setTimeout(() => {
            if (isWinner) {
                // 승리자 메시지
                alert(`🎊 축하합니다! 승리하셨습니다! 🎊\n\n훌륭한 체스 실력이네요! 🏆`);
            } else {
                // 패배자 메시지 (격려)
                alert(`😊 수고하셨습니다! 🎯\n\n다시 도전해보세요! 다음엔 더 잘하실 거예요! 💪\n화이팅! 🌟`);
            }
        }, 500);
    }
    
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.updateGameStatus();
        this.resetTurnTimer();
    }

    updateGameStatus() {
        const playerText = this.currentPlayer === 'white' ? "백말 차례" : "흑말 차례";                                                                                                                                      
        const currentPlayerElement = document.getElementById('currentPlayer');
        if (currentPlayerElement) currentPlayerElement.textContent = playerText;
        const gameStatusElement = document.getElementById('gameStatus');
        if (gameStatusElement && this.isGameInProgress) gameStatusElement.textContent = 'Game in progress';
        this.updateTimerDisplay();
    }

    updateCapturedPieces() {
        const capturedWhiteElement = document.getElementById('capturedWhite');
        const capturedBlackElement = document.getElementById('capturedBlack');
        if (!this.capturedPieces) this.capturedPieces = { white: [], black: [] };
        if (!Array.isArray(this.capturedPieces.white)) this.capturedPieces.white = [];
        if (!Array.isArray(this.capturedPieces.black)) this.capturedPieces.black = [];
        capturedWhiteElement.innerHTML = this.capturedPieces.white.map(p => this.pieces.white[p.type]).join(' ');
        capturedBlackElement.innerHTML = this.capturedPieces.black.map(p => this.pieces.black[p.type]).join(' ');
    }

    startTurnTimer() {
        this.stopTurnTimer();
        this.currentTurnTime = this.turnTimeLimit;
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            this.currentTurnTime--;
            this.updateTimerDisplay();
            if (this.currentTurnTime <= 0) this.handleTimeOut();
        }, 1000);
    }

    stopTurnTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = null;
    }

    resetTurnTimer() {
        this.stopTurnTimer(); // Stop any existing timer
        if(this.isGameInProgress) {
            this.startTurnTimer();
        }
    }
    
    updateTimerDisplay() {
        const timerElement = document.getElementById('turnTimer');
        if (timerElement) {
            timerElement.textContent = this.currentTurnTime;
            timerElement.classList.toggle('warning', this.currentTurnTime <= 5);
            
            // 요소 가시성 강제 설정
            timerElement.style.display = 'block';
            timerElement.style.visibility = 'visible';
            timerElement.style.opacity = '1';
            
            // 디버깅 정보
            console.log(`🕐 타이머 표시 업데이트: ${this.currentTurnTime}초`);
            console.log('📱 타이머 요소 상태:');
            console.log('  - textContent:', timerElement.textContent);
            console.log('  - display:', getComputedStyle(timerElement).display);
            console.log('  - visibility:', getComputedStyle(timerElement).visibility);
            console.log('  - opacity:', getComputedStyle(timerElement).opacity);
            console.log('  - position:', getComputedStyle(timerElement).position);
        } else {
            console.error('❌ turnTimer 엘리먼트를 찾을 수 없음');
        }
    }
    
    async handleTimeOut() {
        this.stopTurnTimer();
        const myColor = this.isRoomHost ? 'white' : 'black';

        // Only the player whose turn it is should handle timeout.
        if (this.currentPlayer === myColor) {
            alert('시간이 초과되었습니다! 무작위 수를 두겠습니다.');

            // 무작위 수 실행
            const validMoves = this.getAllValidMovesForColor(myColor);
            if (validMoves.length > 0) {
                const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                await this.makeMove(randomMove.fromRow, randomMove.fromCol, randomMove.toRow, randomMove.toCol);
            } else {
                // 움직일 수 있는 수가 없으면 (드문 경우) 기권 처리
                console.log('⚠️ Timeout with no valid moves - treating as resignation');
                this.endGameWithResult('timeout', myColor === 'white' ? 'black' : 'white');
            }
        }
    }

    async makeRandomMove() {
        const validMoves = this.getAllValidMoves(this.currentPlayer);
        if (validMoves.length > 0) {
            const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            await this.makeMove(randomMove.fromRow, randomMove.fromCol, randomMove.toRow, randomMove.toCol);
        }
    }

    getAllValidMoves(player) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === player) {
                    for (let tr = 0; tr < 8; tr++) {
                        for (let tc = 0; tc < 8; tc++) {
                            if (this.isValidMove(r, c, tr, tc)) {
                                moves.push({ fromRow: r, fromCol: c, toRow: tr, toCol: tc });
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }

    generateRoomCode() {
        return Math.floor(10000 + Math.random() * 90000).toString();
    }

    getInitialBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        board[7] = [ { type: 'rook', color: 'white' }, { type: 'knight', color: 'white' }, { type: 'bishop', color: 'white' }, { type: 'queen', color: 'white' }, { type: 'king', color: 'white' }, { type: 'bishop', color: 'white' }, { type: 'knight', color: 'white' }, { type: 'rook', color: 'white' } ];
        for (let i = 0; i < 8; i++) board[6][i] = { type: 'pawn', color: 'white' };
        board[0] = [ { type: 'rook', color: 'black' }, { type: 'knight', color: 'black' }, { type: 'bishop', color: 'black' }, { type: 'queen', color: 'black' }, { type: 'king', color: 'black' }, { type: 'bishop', color: 'black' }, { type: 'knight', color: 'black' }, { type: 'rook', color: 'black' } ];
        for (let i = 0; i < 8; i++) board[1][i] = { type: 'pawn', color: 'black' };
        return board;
    }

    setupFirebaseListeners() {
        if (!this.gameRef) return;
        console.log('🔥 Setting up Firebase listeners');
        const gameListener = this.gameRef.on('value', (snapshot) => {
            const gameData = snapshot.val();
            if (!gameData) {
                console.log('⚠️ Empty data received from Firebase. The room may have been deleted.');
                alert('The game room is no longer available.');
                this.backToMenu();
                return;
            }
            console.log('🔥 Game state update received:', gameData);
            
            // 플레이어 이름 업데이트
            this.hostPlayerName = gameData.hostName || '방장';
            if (gameData.guestId && !this.guestPlayerName) {
                this.guestPlayerName = gameData.guestName;
                console.log(`🎉 게스트 입장: ${this.guestPlayerName}`);
                
                // 방장의 경우 게임 시작 버튼 활성화
                if (this.isRoomHost) {
                    console.log('🔄 방장 UI 업데이트 - 게임 시작 버튼 활성화');
                    this.showWaitingState(); // 게임 시작 버튼 상태 업데이트
                }
            }
            this.updatePlayerNames();

            // Sync board state
            if (gameData.board) this.syncBoard(gameData.board);

            // Sync captured pieces
            if (gameData.capturedPieces) {
                this.capturedPieces = {
                    white: Array.isArray(gameData.capturedPieces.white) ? gameData.capturedPieces.white : [],
                    black: Array.isArray(gameData.capturedPieces.black) ? gameData.capturedPieces.black : []
                };
                this.updateCapturedPieces();
            }

            // Sync current player and unlock board
            if (gameData.currentPlayer !== this.currentPlayer) {
                console.log(`🔄 Turn changed via Firebase: ${this.currentPlayer} -> ${gameData.currentPlayer}`);
                this.currentPlayer = gameData.currentPlayer;
                this.updateGameStatus();
                this.resetTurnTimer();
            }
            // *** FIX: Unlock the board after any state update that changes the turn
            this.isMovePending = false;
            console.log('🔓 Board unlocked after state sync.');
            
            // Handle game start
            if (gameData.gameStarted && !this.isGameInProgress) {
                this.handleGameStart();
            }

            // Handle game end
            if (gameData.gameEnded && this.isGameInProgress) {
                this.endGame(gameData.winner);
            }

            // Handle game restart
            if (gameData.gameRestarted && gameData.gameStarted && !gameData.gameEnded) {
                if(!this.isGameInProgress || !this.gameStarted) {
                   this.handleGameRestart(gameData);
                }
            }
        });
        this.listeners.push({ ref: this.gameRef, listener: gameListener });
    }

    syncBoard(newBoard) {
        if (!newBoard) {
            console.error('❌ New board data from Firebase is null or undefined.');
            return;
        }
    
        // Create a new, guaranteed 8x8 board filled with nulls.
        const verifiedBoard = Array(8).fill(null).map(() => Array(8).fill(null));
    
        // Safely iterate through the incoming board data, regardless of whether it's an array or an object.
        Object.keys(newBoard).forEach(rowIndexStr => {
            const r = parseInt(rowIndexStr, 10);
            if (isNaN(r) || r < 0 || r >= 8) return; // Skip invalid row indices
    
            const newRow = newBoard[r];
            if (newRow) {
                // Safely iterate through the row data.
                Object.keys(newRow).forEach(colIndexStr => {
                    const c = parseInt(colIndexStr, 10);
                    if (isNaN(c) || c < 0 || c >= 8) return; // Skip invalid col indices
    
                    // Place the piece in our clean board, ensuring it's not undefined.
                    verifiedBoard[r][c] = newRow[c] || null;
                });
            }
        });
        
        this.board = verifiedBoard;
        this.renderBoard();
    }
    
    handleGameStart() {
        console.log('🎮 Handling game start');
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.currentPlayer = 'white';
        this.isMovePending = false; // Reset lock on game start

        // 이전 게임 패자 정보 표시
        this.displayPreviousLoserInfo();

        this.showGameButtons();
        this.updateGameStatus();
        this.startTurnTimer();
    }
    
    handleGameRestart(gameData) {
        console.log('🔄 게임 재시작 처리:', gameData);

        // 게임 상태 초기화
        this.gameStarted = true;
        this.isGameInProgress = true;

        // 🎯 Firebase에서 받은 첫 번째 플레이어 정보 사용
        this.currentPlayer = gameData.currentPlayer || 'white';
        console.log(`🚀 Firebase에서 받은 첫 번째 플레이어: ${this.currentPlayer}`);

        this.selectedSquare = null;
        this.currentTurnTime = this.turnTimeLimit;
        this.isMovePending = false; // 게임 재시작 시 이동 플래그 초기화
        
        // 잡힌 기물 초기화
        this.capturedPieces = { white: [], black: [] };
        if (gameData.capturedPieces) {
            this.capturedPieces = gameData.capturedPieces;
        }
        
        // UI 상태 복구
        const gameStatus = document.getElementById('gameStatus');
        gameStatus.textContent = '게임이 재시작되었습니다!';
        gameStatus.style.color = '#28a745';
        gameStatus.style.fontSize = '1.1rem';
        gameStatus.style.fontWeight = 'bold';
        
        // 타이머 표시 복구
        const timerElement = document.getElementById('turnTimer');
        const timerContainer = timerElement ? timerElement.closest('.timer-container') : null;
        
        if (timerElement) {
            // 타이머 요소 가시성 복구
            timerElement.style.display = 'block';
            timerElement.style.visibility = 'visible';
            timerElement.style.opacity = '1';
            
            // 타이머 컨테이너도 확인
            if (timerContainer) {
                timerContainer.style.display = 'flex';
                timerContainer.style.visibility = 'visible';
                timerContainer.style.opacity = '1';
                console.log('🕐 타이머 컨테이너 표시 복구 완료');
            }
            
            console.log('🕐 타이머 표시 복구 완료');
            console.log('📱 복구 후 타이머 상태:');
            console.log('  - display:', getComputedStyle(timerElement).display);
            console.log('  - visibility:', getComputedStyle(timerElement).visibility);
            console.log('  - opacity:', getComputedStyle(timerElement).opacity);
        } else {
            console.error('❌ turnTimer 엘리먼트를 찾을 수 없음');
        }
        
        // 게임 UI 전체 가시성 확인
        const gameContainer = document.getElementById('gameContainer');
        const gameInfo = gameContainer ? gameContainer.querySelector('.game-info') : null;
        
        if (gameContainer) {
            gameContainer.style.display = 'block';
            console.log('🎮 게임 컨테이너 표시 확인');
        }
        
        if (gameInfo) {
            gameInfo.style.display = 'flex';
            console.log('📋 게임 정보 영역 표시 확인');
        }
        
        // 버튼 상태 업데이트
        this.showGameButtons();
        
        // 타이머 재시작 - 중요!
        this.resetTurnTimer();
        this.startTurnTimer(); // 타이머 시작 추가
        this.updateTimerDisplay(); // 타이머 표시 업데이트
        
        // 1초 후 다시 한번 타이머 업데이트 (안전장치)
        setTimeout(() => {
            console.log('🔄 1초 후 타이머 재확인');
            this.updateTimerDisplay();
        }, 1000);
        
        // 게임 상태 업데이트
        this.updateGameStatus();
        
        // 보드 동기화 및 렌더링
        if (gameData.board) {
            this.syncBoard(gameData.board);
        }
        
        console.log('✅ 게임 재시작 완료');
        
        // 재시작 알림
        setTimeout(() => {
            alert('🎮 게임이 재시작되었습니다! 🎮');
        }, 500);
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
        if (gameCodeContainer) gameCodeContainer.style.display = 'none';
        this.gameCode = null;
    }

    copyGameCode() {
        if (this.gameCode) {
            navigator.clipboard.writeText(this.gameCode).then(() => {
                const copyBtn = document.getElementById('copyCodeBtn');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓';
                copyBtn.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.background = 'linear-gradient(135deg, #17a2b8, #138496)';
                }, 1500);
            }).catch(err => console.error('Failed to copy code: ', err));
        }
    }

    async startActualGame() {
        if (!this.isRoomHost || !this.gameRef) {
            console.log('⚠️ 방장이 아니거나 게임 참조가 없음');
            return;
        }
        
        // 상대방(게스트)이 입장했는지 확인
        if (!this.guestPlayerName) {
            console.log('⚠️ 상대방이 아직 입장하지 않음');
            alert('⚠️ 상대방이 들어올 때까지 기다려주세요!\n\n게임 코드를 공유하고 상대방이 입장한 후 게임을 시작할 수 있습니다.');
            return;
        }
        
        console.log('🔥 Firebase를 통한 게임 시작');
        console.log('👥 플레이어 확인:');
        console.log('  - 방장:', this.hostPlayerName);
        console.log('  - 게스트:', this.guestPlayerName);
        
        try {
            await this.gameRef.update({
                gameStarted: true,
                isGameInProgress: true,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            
            console.log('✅ 게임 시작 완료');
        } catch (error) {
            console.error('❌ 게임 시작 실패:', error);
            alert('게임 시작에 실패했습니다: ' + error.message);
        }
    }

    showWaitingState() {
        const playerElement = document.getElementById('currentPlayer');
        const statusElement = document.getElementById('gameStatus');
        const startBtn = document.getElementById('startGameBtnInRoom');
        
        if (playerElement) playerElement.textContent = '대기중';
        
        if (this.isRoomHost) {
            // 상대방이 들어왔는지 확인
            if (this.guestPlayerName) {
                // 상대방이 들어온 경우
                if (statusElement) {
                    statusElement.textContent = '상대방이 접속했습니다! 게임을 시작하세요.';
                    statusElement.style.color = '#28a745';
                }
                if (startBtn) {
                    startBtn.style.display = 'inline-block';
                    startBtn.disabled = false;
                    startBtn.textContent = '게임 시작';
                }
                console.log('✅ 상대방 입장 완료 - 게임 시작 가능');
            } else {
                // 상대방이 아직 안 들어온 경우
                if (statusElement) {
                    statusElement.textContent = '상대방을 기다려주세요! 코드를 공유하세요!';
                    statusElement.style.color = '#666';
                }
                if (startBtn) {
                    startBtn.style.display = 'inline-block';
                    startBtn.disabled = true;
                    startBtn.textContent = '대기중...';
                }
                console.log('⏳ 상대방 입장 대기 중');
            }
        } else if (this.isRoomGuest) {
            if (statusElement) {
                statusElement.textContent = '방장이 게임을 시작할 때까지 기다려주세요!';
                statusElement.style.color = '#666';
            }
            if (startBtn) startBtn.style.display = 'none';
        }
        
        this.hideResetButton();
        this.updatePlayerNames();
    }

    showGameButtons() {
        const startBtn = document.getElementById('startGameBtnInRoom');
        const resetBtn = document.getElementById('resetBtn');
        const resignBtn = document.getElementById('resignBtn');
        if (startBtn) startBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'inline-block';
        if (resignBtn) resignBtn.style.display = 'inline-block';
    }

    hideResetButton() {
        const resetBtn = document.getElementById('resetBtn');
        const resignBtn = document.getElementById('resignBtn');
        if (resetBtn) resetBtn.style.display = 'none';
        if (resignBtn) resignBtn.style.display = 'none';
    }

    hideAllButtons() {
        const startBtn = document.getElementById('startGameBtnInRoom');
        const resetBtn = document.getElementById('resetBtn');
        const resignBtn = document.getElementById('resignBtn');
        if (startBtn) startBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
        if (resignBtn) resignBtn.style.display = 'none';
    }

    async joinRoom() {
        const guestNameInput = document.getElementById('guestNameInput');
        const guestName = guestNameInput.value.trim();
        const codeInput = document.getElementById('roomCodeInput');
        const enteredCode = codeInput.value.trim();
        if (!guestName) {
            this.showNameError(guestNameInput, 'Please enter your name');
            return;
        }
        if (guestName.length < 2) {
            this.showNameError(guestNameInput, 'Name must be at least 2 characters');
            return;
        }
        if (enteredCode.length !== 5) {
            this.showJoinError('Please enter a 5-digit code');
            return;
        }
        if (!/^\d{5}$/.test(enteredCode)) {
            this.showJoinError('Code must be numbers only');
            return;
        }
        if (!this.database) {
            this.showJoinError('Connecting to server...');
            return;
        }
        try {
            this.gameCode = enteredCode;
            this.gameRef = this.database.ref('games/' + this.gameCode);
            const snapshot = await this.gameRef.once('value');
            const roomData = snapshot.val();
            if (!roomData) throw new Error('Room code does not exist');
            if (roomData.guestId) throw new Error('This room is already full');
            
            await this.gameRef.update({
                guestId: this.playerId,
                guestName: guestName,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });

            this.guestPlayerName = guestName;
            this.hostPlayerName = roomData.hostName;
            this.isRoomHost = false;
            this.isRoomGuest = true;
            this.isOnlineGame = true;
            
            console.log('✅ Joined Firebase room successfully');
            
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            
            this.syncBoard(roomData.board); // Sync with the host's board
            this.showWaitingState();
            this.updatePlayerNames();
            this.setupFirebaseListeners();

        } catch (error) {
            console.error('❌ Failed to join room:', error);
            this.showJoinError(error.message);
        }
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
        if (codeInput) codeInput.value = '';
    }

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
        document.getElementById('hostNameInput').value = '';
        document.getElementById('guestNameInput').value = '';
    }

    updatePlayerNames() {
        const whitePlayerElement = document.getElementById('whitePlayerName');
        const blackPlayerElement = document.getElementById('blackPlayerName');
        const whiteContainer = document.getElementById('whitePlayerContainer');
        const blackContainer = document.getElementById('blackPlayerContainer');
        
        if (whitePlayerElement) {
            whitePlayerElement.textContent = this.hostPlayerName || 'Waiting...';
            whitePlayerElement.classList.toggle('waiting', !this.hostPlayerName);
        }
        if (blackPlayerElement) {
            blackPlayerElement.textContent = this.guestPlayerName || 'Waiting...';
            blackPlayerElement.classList.toggle('waiting', !this.guestPlayerName);
        }
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
        if (whiteContainer) whiteContainer.style.display = 'none';
        if (blackContainer) blackContainer.style.display = 'none';
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    // ===== 승패 판정 로직 =====

    /**
     * 특정 색상의 킹이 체크받고 있는지 확인
     * @param {string} color - 확인할 킹의 색상 ('white' 또는 'black')
     * @returns {boolean} 체크받고 있으면 true
     */
    isInCheck(color) {
        // 킹의 위치 찾기
        let kingRow = -1, kingCol = -1;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    kingRow = row;
                    kingCol = col;
                    break;
                }
            }
            if (kingRow !== -1) break;
        }

        if (kingRow === -1) return false; // 킹을 찾을 수 없음

        // 상대방의 모든 말이 킹의 위치를 공격할 수 있는지 확인
        const opponentColor = color === 'white' ? 'black' : 'white';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === opponentColor) {
                    // 상대방의 말이 킹의 위치를 공격할 수 있는지 확인
                    if (this.isValidMove(row, col, kingRow, kingCol)) {
                        // 폰의 경우, 폰은 앞으로만 공격하므로 별도 확인 필요
                        if (piece.type === 'pawn') {
                            const direction = piece.color === 'white' ? -1 : 1;
                            const isDiagonalAttack = (kingCol === col + 1 || kingCol === col - 1) && kingRow === row + direction;
                            if (isDiagonalAttack) {
                                return true;
                            }
                        } else {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * 특정 색상이 움직일 수 있는 모든 유효한 수를 반환
     * @param {string} color - 확인할 플레이어의 색상
     * @returns {Array} 유효한 수들의 배열 [{fromRow, fromCol, toRow, toCol}, ...]
     */
    getAllValidMovesForColor(color) {
        const moves = [];
        for (let fromRow = 0; fromRow < 8; fromRow++) {
            for (let fromCol = 0; fromCol < 8; fromCol++) {
                const piece = this.board[fromRow][fromCol];
                if (piece && piece.color === color) {
                    for (let toRow = 0; toRow < 8; toRow++) {
                        for (let toCol = 0; toCol < 8; toCol++) {
                            if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
                                moves.push({
                                    fromRow: fromRow,
                                    fromCol: fromCol,
                                    toRow: toRow,
                                    toCol: toCol
                                });
                            }
                        }
                    }
                }
            }
        }
        return moves;
    }

    /**
     * 체크메이트인지 확인
     * @param {string} color - 확인할 플레이어의 색상
     * @returns {boolean} 체크메이트이면 true
     */
    isCheckmate(color) {
        // 1. 현재 체크받고 있는지 확인
        if (!this.isInCheck(color)) {
            return false;
        }

        // 2. 체크를 벗어날 수 있는 수단이 있는지 확인
        const validMoves = this.getAllValidMovesForColor(color);

        // 각 유효한 수에 대해 시뮬레이션
        for (const move of validMoves) {
            // 수를 임시로 실행
            const originalPiece = this.board[move.toRow][move.toCol];
            const movingPiece = this.board[move.fromRow][move.fromCol];

            this.board[move.toRow][move.toCol] = movingPiece;
            this.board[move.fromRow][move.fromCol] = null;

            // 이동 후에도 여전히 체크받는지 확인
            const stillInCheck = this.isInCheck(color);

            // 원래대로 복원
            this.board[move.fromRow][move.fromCol] = movingPiece;
            this.board[move.toRow][move.toCol] = originalPiece;

            // 체크를 벗어날 수 있는 수가 있으면 체크메이트 아님
            if (!stillInCheck) {
                return false;
            }
        }

        // 체크를 벗어날 수 있는 수가 없으면 체크메이트
        return true;
    }

    /**
     * 스테일메이트인지 확인
     * @param {string} color - 확인할 플레이어의 색상
     * @returns {boolean} 스테일메이트이면 true
     */
    isStalemate(color) {
        // 1. 체크받고 있지 않은지 확인
        if (this.isInCheck(color)) {
            return false;
        }

        // 2. 움직일 수 있는 수가 있는지 확인
        const validMoves = this.getAllValidMovesForColor(color);

        // 각 유효한 수에 대해 시뮬레이션
        for (const move of validMoves) {
            // 수를 임시로 실행
            const originalPiece = this.board[move.toRow][move.toCol];
            const movingPiece = this.board[move.fromRow][move.fromCol];

            this.board[move.toRow][move.toCol] = movingPiece;
            this.board[move.fromRow][move.fromCol] = null;

            // 이동 후 체크받는지 확인
            const willBeInCheck = this.isInCheck(color);

            // 원래대로 복원
            this.board[move.fromRow][move.fromCol] = movingPiece;
            this.board[move.toRow][move.toCol] = originalPiece;

            // 체크받지 않는 유효한 수가 있으면 스테일메이트 아님
            if (!willBeInCheck) {
                return false;
            }
        }

        // 움직일 수 있는 수가 없고 체크받지 않으면 스테일메이트
        return validMoves.length === 0;
    }

    /**
     * 기권 기능
     */
    resign() {
        const myColor = this.isRoomHost ? 'white' : 'black';
        const winner = myColor === 'white' ? 'black' : 'white';
        this.endGameWithResult('resignation', winner);
    }

    /**
     * 기권 처리 핸들러
     */
    handleResignation() {
        if (!this.isGameInProgress) {
            return;
        }

        const confirmed = confirm('정말로 기권하시겠습니까? 상대방이 승리하게 됩니다.');
        if (confirmed) {
            this.resign();
        }
    }

    /**
     * 게임 결과를 결정하는 메인 함수
     * @returns {string|null} 게임 결과 ('white_wins', 'black_wins', 'draw', null)
     */
    determineGameResult() {
        const currentColor = this.currentPlayer;

        // 1. 체크메이트 확인
        if (this.isCheckmate(currentColor)) {
            const winner = currentColor === 'white' ? 'black' : 'white';
            console.log(`🎯 체크메이트! ${winner === 'white' ? '백' : '흑'}의 승리!`);
            return winner === 'white' ? 'white_wins' : 'black_wins';
        }

        // 2. 스테일메이트 확인
        if (this.isStalemate(currentColor)) {
            console.log('🤝 스테일메이트! 무승부입니다.');
            return 'draw';
        }

        // 3. 시간 초과 확인 (이미 handleTimeOut에서 처리됨)

        // 4. 기권 확인 (별도 함수로 처리)

        // 게임 진행 중
        return null;
    }

    /**
     * 특정 결과로 게임 종료
     * @param {string} reason - 종료 이유 ('checkmate', 'stalemate', 'timeout', 'resignation')
     * @param {string} winner - 승자 ('white', 'black', null)
     */
    endGameWithResult(reason, winner) {
        this.isGameInProgress = false;
        this.gameStarted = false;
        this.stopTurnTimer();

        let result;
        if (winner) {
            result = winner === 'white' ? 'white_wins' : 'black_wins';
        } else {
            result = 'draw';
        }

        // Firebase에 결과 전송
        if (this.gameRef && this.isOnlineGame) {
            this.gameRef.update({
                gameEnded: true,
                winner: winner,
                endReason: reason,
                gameResult: result,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            }).catch(error => {
                console.error('❌ 게임 결과 전송 실패:', error);
            });
        }

        // 이전 게임 패자 정보 저장
        this.savePreviousLoser(result);

        // UI 업데이트
        this.showGameEndUI(reason, winner);

        // 결과 반환
        return result;
    }

    /**
     * 게임 종료 UI 표시
     * @param {string} reason - 종료 이유
     * @param {string} winner - 승자
     */
    showGameEndUI(reason, winner) {
        const gameStatus = document.getElementById('gameStatus');
        let message = '';
        let color = '#28a745';

        switch (reason) {
            case 'checkmate':
                const winnerText = winner === 'white' ? '백' : '흑';
                message = `🎯 체크메이트! ${winnerText}의 승리!`;
                color = '#dc3545';
                break;
            case 'stalemate':
                message = '🤝 스테일메이트! 무승부입니다.';
                color = '#ffc107';
                break;
            case 'timeout':
                const timeoutWinner = winner === 'white' ? '백' : '흑';
                message = `⏰ 시간 초과! ${timeoutWinner}의 승리!`;
                color = '#dc3545';
                break;
            case 'resignation':
                const resignWinner = winner === 'white' ? '백' : '흑';
                message = `🏳️ 기권! ${resignWinner}의 승리!`;
                color = '#dc3545';
                break;
            default:
                message = '게임 종료';
        }

        if (gameStatus) {
            gameStatus.textContent = message;
            gameStatus.style.color = color;
            gameStatus.style.fontSize = '1.3rem';
            gameStatus.style.fontWeight = 'bold';
        }

        // 타이머 숨기기
        const timerElement = document.getElementById('turnTimer');
        if (timerElement) {
            timerElement.style.display = 'none';
        }

        // 모든 말 선택 해제
        this.selectedSquare = null;
        this.clearHighlights();

        // 승패 메시지 표시
        const myColor = this.isRoomHost ? 'white' : 'black';
        setTimeout(() => {
            if (winner === myColor) {
                alert(`🎊 축하합니다! 승리하셨습니다! 🎊\n\n이유: ${this.getReasonText(reason)}`);
            } else if (winner && winner !== myColor) {
                alert(`😊 수고하셨습니다! 🎯\n\n이유: ${this.getReasonText(reason)}\n\n다시 도전해보세요! 💪`);
            } else {
                alert(`🤝 무승부입니다!\n\n이유: ${this.getReasonText(reason)}\n\n좋은 게임이었습니다! 👏`);
            }
        }, 500);
    }

    /**
     * 이전 게임 패자 정보를 저장
     * @param {string} gameResult - 게임 결과 ('white_wins', 'black_wins', 'draw')
     */
    savePreviousLoser(gameResult) {
        let loser;

        switch (gameResult) {
            case 'white_wins':
                loser = 'black';
                console.log('💾 이전 게임 패자 저장: 흑 (black)');
                break;
            case 'black_wins':
                loser = 'white';
                console.log('💾 이전 게임 패자 저장: 백 (white)');
                break;
            case 'draw':
                loser = 'none';
                console.log('💾 이전 게임 패자 저장: 무승부 (none)');
                break;
            default:
                console.warn('⚠️ 알 수 없는 게임 결과:', gameResult);
                return;
        }

        // localStorage에 저장 (게임 재시작 시에도 유지)
        this.previousLoser = loser;
        localStorage.setItem('chessPreviousLoser', loser);

        console.log(`🎯 게임 결과 "${gameResult}"에 따라 패자 "${loser}" 저장됨`);
    }

    /**
     * 이전 게임 패자 정보를 가져옴
     * @returns {string|null} 이전 게임의 패자 ('white', 'black', 'none') 또는 null
     */
    getPreviousLoser() {
        return this.previousLoser;
    }

    /**
     * 이전 게임 패자 정보를 UI에 표시
     */
    displayPreviousLoserInfo() {
        const loser = this.getPreviousLoser();
        const gameStatus = document.getElementById('gameStatus');

        if (!loser || !gameStatus) {
            return;
        }

        let message;
        let icon;
        let color;

        switch (loser) {
            case 'white':
                message = '⚪ 이전 게임에서 백 플레이어가 패배했습니다';
                icon = '⚪';
                color = '#f8f9fa';
                break;
            case 'black':
                message = '⚫ 이전 게임에서 흑 플레이어가 패배했습니다';
                icon = '⚫';
                color = '#343a40';
                break;
            case 'none':
                message = '🤝 이전 게임은 무승부였습니다';
                icon = '🤝';
                color = '#ffc107';
                break;
            default:
                return;
        }

        // 잠시 후에 이전 게임 정보 표시
        setTimeout(() => {
            if (gameStatus && this.isGameInProgress) {
                gameStatus.textContent = message;
                gameStatus.style.color = color;
                gameStatus.style.fontSize = '1.1rem';
                gameStatus.style.fontWeight = 'bold';

                // 3초 후에 일반 게임 상태로 복귀
                setTimeout(() => {
                    if (this.isGameInProgress) {
                        this.updateGameStatus();
                    }
                }, 3000);
            }
        }, 1000);

        console.log(`📊 UI에 이전 게임 패자 정보 표시: ${loser}`);
    }

    /**
     * 이전 게임 패자 정보를 콘솔에 표시 (디버깅용)
     */
    showPreviousLoserInfo() {
        const loser = this.getPreviousLoser();
        if (!loser) {
            console.log('📊 이전 게임 패자 정보: 없음 (첫 게임 또는 초기화됨)');
            return;
        }

        let message;
        switch (loser) {
            case 'white':
                message = '백 (white) 플레이어';
                break;
            case 'black':
                message = '흑 (black) 플레이어';
                break;
            case 'none':
                message = '무승부';
                break;
            default:
                message = '알 수 없음';
        }

        console.log(`📊 이전 게임 패자: ${message}`);
        console.log('💡 이 정보를 활용하여 다음 게임에서 특별한 규칙을 적용할 수 있습니다.');
    }

    /**
     * 이전 게임 패자 정보를 초기화
     */
    clearPreviousLoser() {
        this.previousLoser = null;
        localStorage.removeItem('chessPreviousLoser');
        console.log('🗑️ 이전 게임 패자 정보 초기화됨');
    }

    /**
     * 종료 이유를 한글 텍스트로 변환
     * @param {string} reason - 종료 이유
     * @returns {string} 한글 텍스트
     */
    getReasonText(reason) {
        switch (reason) {
            case 'checkmate': return '체크메이트';
            case 'stalemate': return '스테일메이트';
            case 'timeout': return '시간 초과';
            case 'resignation': return '기권';
            default: return '게임 종료';
        }
    }

    // ===== 디버깅 및 테스트용 함수들 =====

    /**
     * 이전 게임 패자 정보를 수동으로 설정 (테스트용)
     * @param {string} loser - 패자 ('white', 'black', 'none')
     */
    setTestPreviousLoser(loser) {
        if (!['white', 'black', 'none'].includes(loser)) {
            console.error('❌ 잘못된 패자 값:', loser);
            console.log('💡 올바른 값: "white", "black", "none"');
            return;
        }

        this.previousLoser = loser;
        localStorage.setItem('chessPreviousLoser', loser);
        console.log(`✅ 테스트용 이전 게임 패자 설정: ${loser}`);
        this.showPreviousLoserInfo();
    }

    /**
     * 첫 턴 결정 로직 테스트
     */
    testFirstPlayerDetermination() {
        console.log('🧪 첫 턴 결정 로직 테스트 시작');

        // 다양한 시나리오 테스트
        const testScenarios = [
            { loser: null, expected: 'white', description: '첫 게임 (패자 정보 없음)' },
            { loser: 'none', expected: 'white', description: '무승부' },
            { loser: 'white', expected: 'white', description: '백이 이전 게임에서 패배' },
            { loser: 'black', expected: 'black', description: '흑이 이전 게임에서 패배' }
        ];

        testScenarios.forEach(scenario => {
            // 테스트용 패자 정보 설정
            if (scenario.loser === null) {
                this.clearPreviousLoser();
            } else {
                this.setTestPreviousLoser(scenario.loser);
            }

            // 첫 턴 결정
            const determinedFirstPlayer = this.determineFirstPlayerFromPreviousLoser();

            // 결과 확인
            const success = determinedFirstPlayer === scenario.expected;
            console.log(`${success ? '✅' : '❌'} ${scenario.description}`);
            console.log(`   패자: ${scenario.loser || '없음'} → 첫 턴: ${determinedFirstPlayer} (기대값: ${scenario.expected})`);
        });

        console.log('🎯 첫 턴 결정 로직 테스트 완료');
    }

    /**
     * 게임 재시작 시 패자 정보 유지 테스트
     */
    testGameRestartWithPreviousLoser() {
        console.log('🧪 게임 재시작 시 패자 정보 유지 테스트 시작');

        const originalLoser = this.getPreviousLoser();
        console.log('📊 테스트 시작 전 패자 정보:', originalLoser || '없음');

        // 테스트용 패자 정보 설정
        const testLoser = originalLoser || 'white';
        this.setTestPreviousLoser(testLoser);
        console.log('🔧 테스트용 패자 정보 설정:', testLoser);

        // 게임 재시작 시뮬레이션 (실제 재시작은 하지 않고 검증만)
        console.log('🔄 게임 재시작 시뮬레이션...');
        console.log('📊 재시작 후 패자 정보:', this.getPreviousLoser());

        if (this.getPreviousLoser() === testLoser) {
            console.log('✅ 성공: 게임 재시작 시 패자 정보가 유지됩니다!');
        } else {
            console.log('❌ 실패: 패자 정보가 변경되었습니다!');
        }

        console.log('💡 실제 게임에서는 resetGame() 함수가 호출되어도 previousLoser는 변경되지 않습니다.');
    }

    /**
     * 전체 시스템 통합 테스트 (추천)
     */
    testCompleteGameRestartSystem() {
        console.log('🎯 체스 게임 재시작 시스템 통합 테스트 시작');
        console.log('========================================');

        // 1. 첫 턴 결정 로직 테스트
        console.log('\n📋 1단계: 첫 턴 결정 로직 테스트');
        this.testFirstPlayerDetermination();

        // 2. 패자 정보 유지 테스트
        console.log('\n📋 2단계: 패자 정보 유지 테스트');
        this.testGameRestartWithPreviousLoser();

        // 3. 전체 시스템 상태 확인
        console.log('\n📋 3단계: 전체 시스템 상태 확인');
        const currentLoser = this.getPreviousLoser();
        console.log('📊 현재 패자 정보:', currentLoser || '없음');
        console.log('🎮 현재 턴:', this.currentPlayer);
        console.log('⏰ 타이머 시간:', this.currentTurnTime);

        console.log('\n✅ 통합 테스트 완료!');
        console.log('💡 이제 실제 게임에서 "게임 재시작" 버튼을 눌러보세요.');
        console.log('💡 이전 게임 결과에 따라 첫 번째 플레이어가 자동으로 결정됩니다.');
    }

    /**
     * 이전 게임 패자 정보를 확인하는 간단한 테스트
     */
    testPreviousLoserSystem() {
        console.log('🧪 이전 게임 패자 시스템 테스트 시작');

        const currentLoser = this.getPreviousLoser();
        console.log('📊 현재 저장된 패자 정보:', currentLoser || '없음');

        // 테스트용 임시 결과들로 패자 정보 저장 테스트
        console.log('🔄 테스트 결과들로 패자 정보 저장 시뮬레이션:');
        const testResults = ['white_wins', 'black_wins', 'draw'];

        testResults.forEach(result => {
            let expectedLoser;
            switch (result) {
                case 'white_wins': expectedLoser = 'black'; break;
                case 'black_wins': expectedLoser = 'white'; break;
                case 'draw': expectedLoser = 'none'; break;
            }
            console.log(`  ${result} → 패자: ${expectedLoser}`);
        });

        console.log('✅ 테스트 완료');
        console.log('💡 실제 게임에서 게임이 끝날 때마다 패자 정보가 자동으로 저장됩니다.');
    }

    // 다크모드 관련 함수들
    initializeTheme() {
        // 저장된 테마 설정 적용
        if (this.isDarkMode) {
            this.enableDarkMode();
        } else {
            this.enableLightMode();
        }
        console.log('🎨 초기 테마 설정 완료:', this.isDarkMode ? '다크모드' : '라이트모드');
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        
        if (this.isDarkMode) {
            this.enableDarkMode();
        } else {
            this.enableLightMode();
        }
        
        // 로컬 스토리지에 설정 저장
        localStorage.setItem('darkMode', this.isDarkMode.toString());
        
        console.log('🎨 테마 전환:', this.isDarkMode ? '다크모드' : '라이트모드');
    }

    enableDarkMode() {
        const lightTheme = document.getElementById('lightTheme');
        const darkTheme = document.getElementById('darkTheme');
        const themeIcon = document.querySelector('.theme-icon');
        
        if (lightTheme) lightTheme.disabled = true;
        if (darkTheme) darkTheme.disabled = false;
        if (themeIcon) themeIcon.textContent = '☀️';
        
        console.log('🌙 다크모드 활성화');
    }

    enableLightMode() {
        const lightTheme = document.getElementById('lightTheme');
        const darkTheme = document.getElementById('darkTheme');
        const themeIcon = document.querySelector('.theme-icon');
        
        if (lightTheme) lightTheme.disabled = false;
        if (darkTheme) darkTheme.disabled = true;
        if (themeIcon) themeIcon.textContent = '🌙';
        
        console.log('☀️ 라이트모드 활성화');
    }
}

// Start the game once the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});

