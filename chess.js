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

        // 승자 기록 (턴 스왑을 위한)
        this.lastWinner = null; 

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
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGameOnline());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.backToMenu());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyGameCode());
        document.getElementById('startGameBtnInRoom').addEventListener('click', () => this.startActualGame());
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
                lastWinner: null,  // 턴 스왑을 위한 승자 기록 초기화
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

    async resetGameOnline() {
        if (!this.gameRef || !this.isOnlineGame) {
            console.log('⚠️ Not an online game - resetting locally');
            this.resetGame();
            return;
        }
        console.log('🔄 Requesting online game restart');

        // 턴 스왑 로직: 패배한 사람이 white가 되도록 결정
        let startingPlayer = 'white'; // 기본값
        if (this.lastWinner === 'white') {
            // white가 이겼다면 black(패자)이 먼저 시작
            startingPlayer = 'black';
            console.log('🔄 턴 스왑 결정: white 승리 → black(패자)가 먼저 시작');
        } else if (this.lastWinner === 'black') {
            // black가 이겼다면 white(패자)이 먼저 시작
            startingPlayer = 'white';
            console.log('🔄 턴 스왑 결정: black 승리 → white(패자)가 먼저 시작');
        } else {
            console.log('🔄 턴 스왑 결정: 첫 게임 → white부터 시작');
        }

        try {
            const initialBoard = this.getInitialBoard();
            await this.gameRef.update({
                board: initialBoard,
                currentPlayer: startingPlayer,  // 턴 스왑 적용
                capturedPieces: { white: [], black: [] },
                gameStarted: true,
                isGameInProgress: true,
                gameEnded: false,
                winner: null,
                lastWinner: this.lastWinner,  // 마지막 승자 정보 저장
                gameRestarted: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            console.log('✅ Game restart signal sent to Firebase');
        } catch (error) {
            console.error('❌ Game restart failed:', error);
            alert('Failed to restart game: ' + error.message);
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

        // 턴 스왑을 위한 승자 기록 초기화
        this.lastWinner = null;
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
        let gameEnded = false;
        let winner = null;

        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
            if (capturedPiece.type === 'king') {
                gameEnded = true;
                winner = piece.color;
            }
        }
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // This is a local render for immediate feedback
        this.renderBoard();
        
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
                    updateData.isGameInProgress = false; 
                } else {
                    updateData.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
                }
                await this.gameRef.update(updateData);
                console.log('✅ Move successfully sent to Firebase.');
            } catch (error) {
                console.error('❌ Failed to send move:', error);
                // *** FIX: Unlock board on failure
                this.isMovePending = false;
                console.log('🔓 Board unlocked due to error.');
                alert('An error occurred while sending your move. Please try again.');
                // Revert move locally? (optional, depends on desired UX)
            }
        }
    }

    endGame(winner) {
        console.log(`🎯 게임 종료: ${winner} 승리!`);

        // 승자 기록 (턴 스왑을 위해)
        this.lastWinner = winner;

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
        // Only the player whose turn it is should make a random move.
        if (this.currentPlayer === myColor) {
            alert('Time is up! A random move will be made for you.');
            await this.makeRandomMove();
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

            // 마지막 승자 정보 동기화 (턴 스왑을 위해)
            if (gameData.lastWinner !== undefined) {
                this.lastWinner = gameData.lastWinner;
                console.log('🔄 마지막 승자 정보 동기화:', this.lastWinner);
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
        this.showGameButtons();
        this.updateGameStatus();
        this.startTurnTimer();
    }
    
    handleGameRestart(gameData) {
        console.log('🔄 게임 재시작 처리:', gameData);

        // 게임 상태 초기화
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.selectedSquare = null;
        this.currentTurnTime = this.turnTimeLimit;
        this.isMovePending = false; // 게임 재시작 시 이동 플래그 초기화

        // 턴 스왑 로직: 패배한 사람이 white가 되도록 설정
        if (this.lastWinner === 'white') {
            // white가 이겼다면 다음 게임은 black(패자)이 white가 되게
            this.currentPlayer = 'black';  // 패배자가 먼저 시작
            console.log('🔄 턴 스왑: white 승리 → black(패자)가 먼저 시작');
        } else if (this.lastWinner === 'black') {
            // black가 이겼다면 다음 게임은 white(패자)이 white로 시작
            this.currentPlayer = 'white';  // 패배자가 먼저 시작
            console.log('🔄 턴 스왑: black 승리 → white(패자)가 먼저 시작');
        } else {
            // 첫 게임이거나 winner 정보가 없는 경우
            this.currentPlayer = 'white';
            console.log('🔄 첫 게임: white부터 시작');
        }

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
        if (startBtn) startBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'inline-block';
    }

    hideResetButton() {
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) resetBtn.style.display = 'none';
    }

    hideAllButtons() {
        const startBtn = document.getElementById('startGameBtnInRoom');
        const resetBtn = document.getElementById('resetBtn');
        if (startBtn) startBtn.style.display = 'none';
        if (resetBtn) resetBtn.style.display = 'none';
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

