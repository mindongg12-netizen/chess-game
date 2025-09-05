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

    async resetGameOnline() {
        if (!this.gameRef || !this.isOnlineGame) {
            console.log('⚠️ Not an online game - resetting locally');
            this.resetGame();
            return;
        }
        console.log('🔄 Requesting online game restart');
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
        console.log(`🎯 Game Over: ${winner} wins!`);
        this.isGameInProgress = false;
        this.gameStarted = false;
        this.stopTurnTimer();
        const gameStatus = document.getElementById('gameStatus');
        const winnerText = winner === 'white' ? 'White' : 'Black';
        gameStatus.textContent = `🎉 Game Over! ${winnerText} wins! 🎉`;
        gameStatus.style.color = '#dc3545';
        const timerElement = document.getElementById('turnTimer');
        if (timerElement) timerElement.style.display = 'none';
        this.selectedSquare = null;
        this.clearHighlights();
        setTimeout(() => {
            alert(`🎊 Congratulations! ${winnerText} has won the game! 🎊`);
        }, 500);
    }
    
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.updateGameStatus();
        this.resetTurnTimer();
    }

    updateGameStatus() {
        const playerText = this.currentPlayer === 'white' ? "White's Turn" : "Black's Turn";
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
            
            // Update player names
            this.hostPlayerName = gameData.hostName || 'Host';
            if (gameData.guestId && !this.guestPlayerName) {
                this.guestPlayerName = gameData.guestName;
                if (this.isRoomHost) {
                     const statusElement = document.getElementById('gameStatus');
                     if (statusElement) {
                        statusElement.textContent = 'Opponent has joined! Press Start Game.';
                        statusElement.style.color = '#28a745';
                     }
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
            console.error('❌ New board data is null or undefined');
            return;
        }
        let processedBoard = Array.isArray(newBoard) ? newBoard : this.convertObjectToArray(newBoard);
        for (let i = 0; i < 8; i++) {
             if (!processedBoard[i]) processedBoard[i] = new Array(8).fill(null);
             else if (!Array.isArray(processedBoard[i])) processedBoard[i] = this.convertObjectToArray(processedBoard[i]);
        }
        this.board = processedBoard;
        this.renderBoard();
    }
    
    convertObjectToArray(obj, expectedLength = 8) {
        if (!obj || typeof obj !== 'object') return new Array(expectedLength).fill(null);
        const arr = new Array(expectedLength).fill(null);
        Object.keys(obj).forEach(key => {
            const index = parseInt(key);
            if (!isNaN(index) && index >= 0 && index < expectedLength) arr[index] = obj[key];
        });
        return arr;
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
        console.log('🔄 Handling game restart:', gameData);
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.currentTurnTime = this.turnTimeLimit;
        this.isMovePending = false;
        this.capturedPieces = gameData.capturedPieces || { white: [], black: [] };
        
        const gameStatus = document.getElementById('gameStatus');
        gameStatus.textContent = 'Game has been restarted!';
        gameStatus.style.color = '#28a745';
        
        const timerElement = document.getElementById('turnTimer');
        if (timerElement) timerElement.style.display = 'block';
        
        this.showGameButtons();
        this.resetTurnTimer();
        
        if (gameData.board) this.syncBoard(gameData.board);
        
        console.log('✅ Game restart complete');
        setTimeout(() => alert('🎮 The game has been restarted! 🎮'), 500);
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
        if (!this.isRoomHost || !this.gameRef) return;
        console.log('🔥 Starting game via Firebase');
        try {
            await this.gameRef.update({
                gameStarted: true,
                isGameInProgress: true, // Also set this to ensure state is correct
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('❌ Failed to start game:', error);
        }
    }

    showWaitingState() {
        const playerElement = document.getElementById('currentPlayer');
        const statusElement = document.getElementById('gameStatus');
        const startBtn = document.getElementById('startGameBtnInRoom');
        
        if (playerElement) playerElement.textContent = 'Waiting';
        
        if (this.isRoomHost) {
            if (statusElement) statusElement.textContent = 'Waiting for opponent... Share the code!';
            if (startBtn) startBtn.style.display = 'inline-block';
        } else if (this.isRoomGuest) {
            if (statusElement) statusElement.textContent = 'Waiting for the host to start the game';
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
}

// Start the game once the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});
