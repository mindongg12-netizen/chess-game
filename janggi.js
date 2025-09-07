    class JanggiGame {
    constructor() {
        // 장기판은 10행 9열
        this.board = [];
        this.rows = 10;
        this.cols = 9;

        // 초나라가 먼저 시작
        this.currentPlayer = 'cho';
        this.selectedSquare = null;
        this.gameStarted = false;
        this.capturedPieces = { cho: [], han: [] };

        // 타이머 속성
        this.turnTimeLimit = 40; 
        this.currentTurnTime = this.turnTimeLimit;
        this.timerInterval = null;

        // 온라인 게임 속성
        this.gameCode = null;
        this.isOnlineGame = false;
        this.isGameInProgress = false;
        this.isRoomHost = false; // 초(楚)
        this.isRoomGuest = false; // 한(漢)
        this.isMovePending = false; 

        // 플레이어 이름
        this.hostPlayerName = '';
        this.guestPlayerName = '';

        // Firebase 실시간 통신
        this.database = null;
        this.playerId = this.generatePlayerId();
        this.gameRef = null;
        this.listeners = [];
        
        // 다크모드 상태
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';

        // 장기 기물 (Unicode)
        this.pieces = {
            cho: { // 초 (녹색/파란색)
                king: '楚', chariot: '車', cannon: '包', horse: '馬', elephant: '象', guard: '士', soldier: '卒'
            },
            han: { // 한 (빨간색)
                king: '漢', chariot: '車', cannon: '包', horse: '馬', elephant: '象', guard: '士', soldier: '兵'
            }
        };

        console.log('🔥 Janggi Game Initialization Started');
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
        this.initializeTheme();
    }

    async startGame() {
        const hostNameInput = document.getElementById('hostNameInput');
        const hostName = hostNameInput.value.trim();
        if (!hostName || hostName.length < 2) {
            this.showNameError(hostNameInput, '이름을 2자 이상 입력하세요');
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
                currentPlayer: 'cho',
                board: this.getInitialBoard(),
                capturedPieces: { cho: [], han: [] },
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            };
            this.gameRef = this.database.ref('janggi_games/' + this.gameCode);
            await this.gameRef.set(roomData);
            
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
            alert('방 만들기에 실패했습니다: ' + error.message);
        }
    }

    async resetGameOnline() {
        if (!this.gameRef || !this.isOnlineGame) {
            this.resetGame();
            return;
        }
        try {
            await this.gameRef.update({
                board: this.getInitialBoard(),
                currentPlayer: 'cho',
                capturedPieces: { cho: [], han: [] },
                gameStarted: true,
                isGameInProgress: true,
                gameEnded: false,
                winner: null,
                gameRestarted: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('❌ Game restart failed:', error);
            alert('게임 재시작에 실패했습니다: ' + error.message);
        }
    }

    resetGame() {
        this.stopTurnTimer();
        this.currentPlayer = 'cho';
        this.selectedSquare = null;
        this.capturedPieces = { cho: [], han: [] };
        this.currentTurnTime = this.turnTimeLimit;
        this.isGameInProgress = false;
        this.isMovePending = false;
        
        // 보드 완전히 초기화
        const boardElement = document.getElementById('janggiboard');
        if (boardElement) {
            boardElement.innerHTML = '';
        }
        
        this.initializeBoard();
        
        // (4,4) 위치 특별 정리
        setTimeout(() => {
            this.cleanupSpecificSquare(4, 4);
        }, 100);
        
        this.renderBoard();
        this.showWaitingState();
    }
    
    backToMenu() {
        // Clean up Firebase listeners to prevent memory leaks
        if (this.gameRef && this.listeners.length > 0) {
            this.listeners.forEach(({ ref, listener }) => ref.off('value', listener));
            this.listeners = [];
            this.gameRef = null;
        }

        this.stopTurnTimer();
        this.hideGameCode();
        this.hideAllButtons();
        this.clearRoomCodeInput();
        this.clearNameInputs();
        this.hidePlayerNames();
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('gameMenu').style.display = 'block';
        this.gameStarted = false;
        this.isGameInProgress = false;
        this.isRoomHost = false;
        this.isRoomGuest = false;
        this.isOnlineGame = false;
        this.hostPlayerName = '';
        this.guestPlayerName = '';
        document.getElementById('janggiboard').innerHTML = '';
    }

    initializeBoard() {
        this.board = this.getInitialBoard();
    }
    
    getInitialBoard() {
        const board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));
        // 한나라 (Red)
        board[0][0] = { type: 'chariot', color: 'han' };
        board[0][1] = { type: 'elephant', color: 'han' };
        board[0][2] = { type: 'horse', color: 'han' };
        board[0][3] = { type: 'guard', color: 'han' };
        board[0][5] = { type: 'guard', color: 'han' };
        board[0][6] = { type: 'elephant', color: 'han' };
        board[0][7] = { type: 'horse', color: 'han' };
        board[0][8] = { type: 'chariot', color: 'han' };
        board[1][4] = { type: 'king', color: 'han' };
        board[2][1] = { type: 'cannon', color: 'han' };
        board[2][7] = { type: 'cannon', color: 'han' };
        board[3][0] = { type: 'soldier', color: 'han' };
        board[3][2] = { type: 'soldier', color: 'han' };
        board[3][4] = { type: 'soldier', color: 'han' };
        board[3][6] = { type: 'soldier', color: 'han' };
        board[3][8] = { type: 'soldier', color: 'han' };

        // 초나라 (Blue/Green)
        board[9][0] = { type: 'chariot', color: 'cho' };
        board[9][1] = { type: 'elephant', color: 'cho' };
        board[9][2] = { type: 'horse', color: 'cho' };
        board[9][3] = { type: 'guard', color: 'cho' };
        board[9][5] = { type: 'guard', color: 'cho' };
        board[9][6] = { type: 'elephant', color: 'cho' };
        board[9][7] = { type: 'horse', color: 'cho' };
        board[9][8] = { type: 'chariot', color: 'cho' };
        board[8][4] = { type: 'king', color: 'cho' };
        board[7][1] = { type: 'cannon', color: 'cho' };
        board[7][7] = { type: 'cannon', color: 'cho' };
        board[6][0] = { type: 'soldier', color: 'cho' };
        board[6][2] = { type: 'soldier', color: 'cho' };
        board[6][4] = { type: 'soldier', color: 'cho' };
        board[6][6] = { type: 'soldier', color: 'cho' };
        board[6][8] = { type: 'soldier', color: 'cho' };
        return board;
    }

    renderBoard() {
        const boardElement = document.getElementById('janggiboard');
        if (!boardElement) return;
        
        // 완전히 초기화하여 중복 말 문제 해결
        boardElement.innerHTML = '';
        
        // 기존 이벤트 리스너도 모두 제거
        const existingSquares = boardElement.querySelectorAll('.square');
        existingSquares.forEach(square => {
            square.removeEventListener('click', square.clickHandler);
        });
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.dataset.row = row;
                square.dataset.col = col;
                
                // 특정 위치 (4,4) 디버깅
                if (row === 4 && col === 4) {
                    console.log(`🔍 Rendering position (4,4), piece:`, this.board[row][col]);
                }
                
                // 기존 piece 요소들 완전히 제거
                const existingPieces = square.querySelectorAll('.piece');
                existingPieces.forEach(piece => piece.remove());
                
                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.color}`;
                    pieceElement.textContent = this.pieces[piece.color][piece.type];
                    square.appendChild(pieceElement);
                    
                    // 특정 위치 (4,4) 디버깅
                    if (row === 4 && col === 4) {
                        console.log(`✅ Piece added to (4,4):`, pieceElement);
                    }
                }
                
                // 이벤트 리스너 저장하여 나중에 제거할 수 있도록 함
                const clickHandler = () => this.handleSquareClick(row, col);
                square.clickHandler = clickHandler;
                square.addEventListener('click', clickHandler);
                
                boardElement.appendChild(square);
            }
        }
        
        // 렌더링 완료 후 (4,4) 위치 강제 검증
        setTimeout(() => {
            this.validateSpecificSquare(4, 4);
        }, 50);
        
        this.updateCapturedPieces();
    }
    
    validateSpecificSquare(row, col) {
        const targetSquare = document.querySelector(`.square[data-row='${row}'][data-col='${col}']`);
        const boardPiece = this.board[row][col];
        
        if (targetSquare) {
            const domPieces = targetSquare.querySelectorAll('.piece');
            
            if (boardPiece && domPieces.length === 0) {
                // 보드에는 말이 있는데 DOM에는 없는 경우
                console.log(`⚠️ Missing piece in DOM at (${row},${col}), adding:`, boardPiece);
                const pieceElement = document.createElement('div');
                pieceElement.className = `piece ${boardPiece.color}`;
                pieceElement.textContent = this.pieces[boardPiece.color][boardPiece.type];
                targetSquare.appendChild(pieceElement);
            } else if (!boardPiece && domPieces.length > 0) {
                // 보드에는 말이 없는데 DOM에는 있는 경우
                console.log(`⚠️ Extra pieces in DOM at (${row},${col}), removing:`, domPieces.length);
                domPieces.forEach(piece => piece.remove());
            } else if (boardPiece && domPieces.length > 1) {
                // 중복된 말들이 있는 경우
                console.log(`⚠️ Duplicate pieces in DOM at (${row},${col}), cleaning up`);
                domPieces.forEach((piece, index) => {
                    if (index > 0) piece.remove(); // 첫 번째만 남기고 제거
                });
            }
        }
    }

    async handleSquareClick(row, col) {
        if (!this.gameStarted || !this.isGameInProgress || this.isMovePending) {
            return;
        }
        
        const myColor = this.isRoomHost ? 'cho' : 'han';
        if (this.currentPlayer !== myColor) {
            alert("상대방의 차례입니다.");
            return;
        }
        
        const piece = this.board[row][col];
        
        if (!this.selectedSquare) {
            if (piece && piece.color === this.currentPlayer) {
                this.selectedSquare = { row, col };
                this.highlightValidMoves(row, col);
            }
        } else {
            const fromRow = this.selectedSquare.row;
            const fromCol = this.selectedSquare.col;

            if (fromRow === row && fromCol === col) {
                this.selectedSquare = null;
                this.clearHighlights();
            } else if (piece && piece.color === this.currentPlayer) {
                this.selectedSquare = { row, col };
                this.clearHighlights();
                this.highlightValidMoves(row, col);
            } else {
                if (this.isValidMove(fromRow, fromCol, row, col)) {
                    await this.makeMove(fromRow, fromCol, row, col);
                }
                this.selectedSquare = null;
                this.clearHighlights();
            }
        }
    }

    highlightValidMoves(row, col) {
        this.clearHighlights();
        document.querySelector(`.square[data-row='${row}'][data-col='${col}']`).classList.add('selected');
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.isValidMove(row, col, r, c)) {
                    const targetSquare = document.querySelector(`.square[data-row='${r}'][data-col='${c}']`);
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
        document.querySelectorAll('.square').forEach(s => s.classList.remove('selected', 'valid-move', 'capture'));
    }
    
    cleanupSpecificSquare(row, col) {
        // 특정 위치의 DOM square를 강제로 정리
        const targetSquare = document.querySelector(`.square[data-row='${row}'][data-col='${col}']`);
        if (targetSquare) {
            // 기존 piece 요소들 모두 제거
            const pieces = targetSquare.querySelectorAll('.piece');
            pieces.forEach(piece => {
                console.log(`🧹 Removing piece from (${row},${col}):`, piece);
                piece.remove();
            });
            
            // 보드 데이터와 일치하지 않는 경우 강제 동기화
            const boardPiece = this.board[row][col];
            if (boardPiece && pieces.length === 0) {
                console.log(`🔧 Adding missing piece to (${row},${col}):`, boardPiece);
                const pieceElement = document.createElement('div');
                pieceElement.className = `piece ${boardPiece.color}`;
                pieceElement.textContent = this.pieces[boardPiece.color][boardPiece.type];
                targetSquare.appendChild(pieceElement);
            } else if (!boardPiece && pieces.length > 0) {
                console.log(`🗑️ Removing extra pieces from (${row},${col})`);
                pieces.forEach(piece => piece.remove());
            }
        }
    }

    // ### 장기 행마법 (핵심 로직) ###
    isValidMove(fromRow, fromCol, toRow, toCol) {
        if (toRow < 0 || toRow >= this.rows || toCol < 0 || toCol >= this.cols) return false;
        
        const piece = this.board[fromRow][fromCol];
        const targetPiece = this.board[toRow][toCol];

        if (!piece) return false;
        if (targetPiece && targetPiece.color === piece.color) return false;

        switch (piece.type) {
            case 'king':
            case 'guard':
                return this.isPalaceMove(fromRow, fromCol, toRow, toCol, piece.color);
            case 'horse':
                return this.isHorseMove(fromRow, fromCol, toRow, toCol);
            case 'elephant':
                 return this.isElephantMove(fromRow, fromCol, toRow, toCol);
            case 'chariot':
                return this.isChariotMove(fromRow, fromCol, toRow, toCol);
            case 'cannon':
                return this.isCannonMove(fromRow, fromCol, toRow, toCol);
            case 'soldier':
                return this.isSoldierMove(fromRow, fromCol, toRow, toCol, piece.color);
            default:
                return false;
        }
    }

    isPalace(row, col) {
        const isHanPalace = (row >= 0 && row <= 2) && (col >= 3 && col <= 5);
        const isChoPalace = (row >= 7 && row <= 9) && (col >= 3 && col <= 5);
        return { isHanPalace, isChoPalace };
    }

    isPalaceMove(fromRow, fromCol, toRow, toCol, color) {
        const { isHanPalace, isChoPalace } = this.isPalace(toRow, toCol);
        if (color === 'han' && !isHanPalace) return false;
        if (color === 'cho' && !isChoPalace) return false;
        
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        
        // 궁성 내 대각선 길 위치
        const diagonalPoints = {
            han: [[0, 3], [1, 4], [2, 5], [0, 5], [2, 3]],
            cho: [[7, 3], [8, 4], [9, 5], [7, 5], [9, 3]]
        };
        const palace = color === 'han' ? diagonalPoints.han : diagonalPoints.cho;
        const isFromDiagonal = palace.some(p => p[0] === fromRow && p[1] === fromCol);
        const isToDiagonal = palace.some(p => p[0] === toRow && p[1] === toCol);
        
        if (rowDiff === 1 && colDiff === 1 && isFromDiagonal && isToDiagonal) return true;
        if (rowDiff + colDiff === 1) return true;
        
        return false;
    }

    isChariotMove(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        
        // 직선 이동
        if ((rowDiff > 0 && colDiff === 0) || (rowDiff === 0 && colDiff > 0)) {
            return this.countPiecesOnPath(fromRow, fromCol, toRow, toCol) === 0;
        }
        
        // 궁성 내 대각선 이동
        const { isHanPalace: fromHan } = this.isPalace(fromRow, fromCol);
        const { isHanPalace: toHan } = this.isPalace(toRow, toCol);
        const { isChoPalace: fromCho } = this.isPalace(fromRow, fromCol);
        const { isChoPalace: toCho } = this.isPalace(toRow, toCol);

        if ((fromHan && toHan) || (fromCho && toCho)) {
             if (rowDiff === 1 && colDiff === 1) return true; // 한 칸 대각선 이동
             if (rowDiff === 2 && colDiff === 2 && (fromRow+fromCol)%2 === 0 ) { // 두 칸 대각선 이동
                 const midRow = (fromRow + toRow) / 2;
                 const midCol = (fromCol + toCol) / 2;
                 if (midRow === 1 || midRow === 8) { // 궁 중앙
                    return this.board[midRow][midCol] === null;
                 }
             }
        }
        return false;
    }

    isHorseMove(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        if (!((rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2))) return false;

        if (rowDiff === 2) { // 세로로 2칸 이동
            if (this.board[fromRow + Math.sign(toRow - fromRow)][fromCol]) return false;
        } else { // 가로로 2칸 이동
            if (this.board[fromRow][fromCol + Math.sign(toCol - fromCol)]) return false;
        }
        return true;
    }
    
    isElephantMove(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        if (!((rowDiff === 3 && colDiff === 2) || (rowDiff === 2 && colDiff === 3))) return false;

        let block1_r, block1_c, block2_r, block2_c;
        const r_sign = Math.sign(toRow - fromRow);
        const c_sign = Math.sign(toCol - fromCol);

        if(rowDiff === 3) { // 세로 3칸
            block1_r = fromRow + r_sign;
            block1_c = fromCol;
            block2_r = fromRow + 2 * r_sign;
            block2_c = fromCol + c_sign;
        } else { // 가로 3칸
            block1_r = fromRow;
            block1_c = fromCol + c_sign;
            block2_r = fromRow + r_sign;
            block2_c = fromCol + 2 * c_sign;
        }
        
        if (this.board[block1_r][block1_c] || this.board[block2_r][block2_c]) return false;

        return true;
    }

    isCannonMove(fromRow, fromCol, toRow, toCol) {
        const target = this.board[toRow][toCol];
        if (target && target.type === 'cannon') return false;

        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);

        if ((rowDiff > 0 && colDiff > 0)) return false; // 대각선 이동 불가

        const jumpCount = this.countPiecesOnPath(fromRow, fromCol, toRow, toCol);
        if (jumpCount !== 1) return false;
        
        // 포는 포를 뛰어넘을 수 없음
        const stepR = Math.sign(toRow - fromRow);
        const stepC = Math.sign(toCol - fromCol);
        let r = fromRow + stepR;
        let c = fromCol + stepC;
        while (r !== toRow || c !== toCol) {
            if (this.board[r][c] && this.board[r][c].type === 'cannon') {
                return false;
            }
            r += stepR;
            c += stepC;
        }
        return true;
    }

    isSoldierMove(fromRow, fromCol, toRow, toCol, color) {
        const direction = color === 'cho' ? -1 : 1;
        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);

        // 직진
        if (rowDiff === direction && colDiff === 0) return true;
        // 옆으로
        if (rowDiff === 0 && colDiff === 1) return true;
        
        // 궁성 내 대각선
        const { isHanPalace, isChoPalace } = this.isPalace(fromRow, fromCol);
        const enemyPalace = color === 'cho' ? isHanPalace : isChoPalace;
        
        if (enemyPalace && rowDiff === direction && colDiff === 1) return true;
        
        return false;
    }

    countPiecesOnPath(fromRow, fromCol, toRow, toCol) {
        let count = 0;
        const stepR = Math.sign(toRow - fromRow);
        const stepC = Math.sign(toCol - fromCol);
        let r = fromRow + stepR;
        let c = fromCol + stepC;
        while (r !== toRow || c !== toCol) {
            if (this.board[r][c]) count++;
            r += stepR;
            c += stepC;
        }
        return count;
    }

    // ### 행마법 끝 ###

    async makeMove(fromRow, fromCol, toRow, toCol) {
        this.isMovePending = true;

        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        let gameEnded = false;
        let winner = null;

        // 특정 위치 (4,4) 디버깅
        if (toRow === 4 && toCol === 4) {
            console.log(`🎯 Move to (4,4): piece=${piece?.type}, capturedPiece=${capturedPiece?.type}`);
            console.log(`🎯 Board before move at (4,4):`, this.board[4][4]);
        }
        if (fromRow === 4 && fromCol === 4) {
            console.log(`🔄 Move from (4,4): piece=${piece?.type}`);
        }

        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
            console.log(`🎯 Piece captured: ${capturedPiece.color} ${capturedPiece.type} at (${toRow},${toCol})`);
            console.log(`📦 Total captured pieces:`, this.capturedPieces);
            if (capturedPiece.type === 'king') {
                gameEnded = true;
                winner = piece.color;
            }
        }
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // 특정 위치 (4,4) 디버깅 - 이동 후
        if (toRow === 4 && toCol === 4) {
            console.log(`✅ Board after move to (4,4):`, this.board[4][4]);
        }
        if (fromRow === 4 && fromCol === 4) {
            console.log(`✅ Board after move from (4,4):`, this.board[4][4]);
        }
        
        // (4,4) 위치 강제 정리
        this.cleanupSpecificSquare(4, 4);
        
        this.renderBoard();
        
        if (this.gameRef && this.isOnlineGame) {
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
                    updateData.currentPlayer = this.currentPlayer === 'cho' ? 'han' : 'cho';
                }
                await this.gameRef.update(updateData);
            } catch (error) {
                console.error('❌ Failed to send move:', error);
                this.isMovePending = false;
                alert('수를 전송하는 데 오류가 발생했습니다. 다시 시도해주세요.');
            }
        }
    }
    
    endGame(winner) {
        this.isGameInProgress = false;
        this.gameStarted = false;
        this.stopTurnTimer();
        
        const gameStatus = document.getElementById('gameStatus');
        const winnerText = winner === 'cho' ? '초(楚)' : '한(漢)';
        gameStatus.textContent = `🎉 게임 종료! ${winnerText}의 승리! 🎉`;
        
        const myColor = this.isRoomHost ? 'cho' : 'han';
        setTimeout(() => {
            if (winner === myColor) {
                alert(`🎊 축하합니다! 승리하셨습니다! 🎊`);
            } else {
                alert(`😊 수고하셨습니다! 다시 도전해보세요! 💪`);
            }
        }, 500);
    }

    updateGameStatus() {
        const playerText = this.currentPlayer === 'cho' ? "초(楚)의 차례" : "한(漢)의 차례";                                                                                                                                      
        document.getElementById('currentPlayer').textContent = playerText;
        if (this.isGameInProgress) document.getElementById('gameStatus').textContent = '게임 진행 중';
        this.updateTimerDisplay();
    }

    updateCapturedPieces() {
        const capturedChoEl = document.getElementById('capturedCho');
        const capturedHanEl = document.getElementById('capturedHan');
        if (!this.capturedPieces) this.capturedPieces = { cho: [], han: [] };
        
        // 잡힌 기물용 별도 CSS 클래스 사용하여 위치 문제 해결
        capturedChoEl.innerHTML = this.capturedPieces.cho.map(p => 
            `<span class="captured-piece cho">${this.pieces.cho[p.type]}</span>`
        ).join(' ');
        capturedHanEl.innerHTML = this.capturedPieces.han.map(p => 
            `<span class="captured-piece han">${this.pieces.han[p.type]}</span>`
        ).join(' ');
        
        console.log(`📊 Captured pieces updated - 초: ${this.capturedPieces.cho.length}, 한: ${this.capturedPieces.han.length}`);
    }

    // --- 이하 코드는 체스 게임과 거의 동일한 UI/온라인 로직 ---
    
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
        clearInterval(this.timerInterval);
        this.timerInterval = null;
    }

    resetTurnTimer() {
        this.stopTurnTimer();
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
        const myColor = this.isRoomHost ? 'cho' : 'han';
        if (this.currentPlayer === myColor) {
            alert('시간 종료! 임의의 수가 두어집니다.');
            const validMoves = this.getAllValidMoves(this.currentPlayer);
            if (validMoves.length > 0) {
                const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
                await this.makeMove(randomMove.fromRow, randomMove.fromCol, randomMove.toRow, randomMove.toCol);
            }
        }
    }

    getAllValidMoves(player) {
        const moves = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === player) {
                    for (let tr = 0; tr < this.rows; tr++) {
                        for (let tc = 0; tc < this.cols; tc++) {
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
            this.updatePlayerNames();

            if (gameData.board) this.syncBoard(gameData.board);

            if (gameData.capturedPieces) {
                this.capturedPieces = {
                    cho: Array.isArray(gameData.capturedPieces.cho) ? gameData.capturedPieces.cho : [],
                    han: Array.isArray(gameData.capturedPieces.han) ? gameData.capturedPieces.han : []
                };
                this.updateCapturedPieces();
            }

            if (gameData.currentPlayer !== this.currentPlayer) {
                this.currentPlayer = gameData.currentPlayer;
                this.updateGameStatus();
                this.resetTurnTimer();
            }
            
            this.isMovePending = false;
            
            if (gameData.gameStarted && !this.isGameInProgress) {
                this.handleGameStart();
            }
            if (gameData.gameEnded && this.isGameInProgress) {
                this.endGame(gameData.winner);
            }
            if (gameData.gameRestarted && gameData.gameStarted && !gameData.gameEnded) {
                 if(!this.isGameInProgress || !this.gameStarted) {
                   this.handleGameRestart(gameData);
                }
            }
        });
        this.listeners.push({ ref: this.gameRef, listener: gameListener });
    }

    syncBoard(newBoard) {
        if (!newBoard) return;
        const verifiedBoard = Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));
        for (let r = 0; r < this.rows; r++) {
            if (newBoard[r]) {
                for (let c = 0; c < this.cols; c++) {
                    verifiedBoard[r][c] = newBoard[r][c] || null;
                }
            }
        }
        this.board = verifiedBoard;
        this.renderBoard();
    }
    
    handleGameStart() {
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.currentPlayer = 'cho';
        this.isMovePending = false;
        this.showGameButtons();
        this.updateGameStatus();
        this.startTurnTimer();
    }

    handleGameRestart(gameData) {
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.currentPlayer = 'cho';
        this.selectedSquare = null;
        this.currentTurnTime = this.turnTimeLimit;
        this.isMovePending = false;
        
        this.capturedPieces = gameData.capturedPieces || { cho: [], han: [] };
        
        document.getElementById('gameStatus').textContent = '게임이 재시작되었습니다!';
        
        this.showGameButtons();
        this.resetTurnTimer();
        this.updateGameStatus();
        
        if (gameData.board) {
            this.syncBoard(gameData.board);
        }
        
        setTimeout(() => alert('🎮 게임이 재시작되었습니다! 🎮'), 500);
    }
    
    generateRoomCode() {
        return Math.floor(10000 + Math.random() * 90000).toString();
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
        document.getElementById('gameCodeContainer').style.display = 'none';
        this.gameCode = null;
    }
    
    copyGameCode() {
        if (this.gameCode) {
            navigator.clipboard.writeText(this.gameCode).then(() => {
                const copyBtn = document.getElementById('copyCodeBtn');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓';
                setTimeout(() => { copyBtn.textContent = originalText; }, 1500);
            }).catch(err => console.error('Failed to copy code: ', err));
        }
    }
    
    async startActualGame() {
        if (!this.isRoomHost || !this.gameRef) return;
        if (!this.guestPlayerName) {
            alert('상대방이 들어올 때까지 기다려주세요!');
            return;
        }
        try {
            await this.gameRef.update({
                gameStarted: true,
                isGameInProgress: true,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('❌ 게임 시작 실패:', error);
            alert('게임 시작에 실패했습니다: ' + error.message);
        }
    }
    
    showWaitingState() {
        const playerElement = document.getElementById('currentPlayer');
        const statusElement = document.getElementById('gameStatus');
        const startBtn = document.getElementById('startGameBtnInRoom');
        
        playerElement.textContent = '대기중';
        
        if (this.isRoomHost) {
            if (this.guestPlayerName) {
                statusElement.textContent = '상대방이 접속했습니다! 게임을 시작하세요.';
                startBtn.style.display = 'inline-block';
                startBtn.disabled = false;
                startBtn.textContent = '게임 시작';
            } else {
                statusElement.textContent = '상대방을 기다리는 중... 코드를 공유하세요!';
                startBtn.style.display = 'inline-block';
                startBtn.disabled = true;
                startBtn.textContent = '대기중...';
            }
        } else if (this.isRoomGuest) {
            statusElement.textContent = '방장이 게임을 시작할 때까지 기다려주세요!';
            startBtn.style.display = 'none';
        }
        
        this.hideResetButton();
        this.updatePlayerNames();
    }
    
    showGameButtons() {
        document.getElementById('startGameBtnInRoom').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'inline-block';
    }
    
    hideResetButton() {
        document.getElementById('resetBtn').style.display = 'none';
    }
    
    hideAllButtons() {
        document.getElementById('startGameBtnInRoom').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'none';
    }
    
    async joinRoom() {
        const guestNameInput = document.getElementById('guestNameInput');
        const guestName = guestNameInput.value.trim();
        const codeInput = document.getElementById('roomCodeInput');
        const enteredCode = codeInput.value.trim();
        if (guestName.length < 2) {
            this.showNameError(guestNameInput, '이름을 2자 이상 입력하세요');
            return;
        }
        if (enteredCode.length !== 5 || !/^\d{5}$/.test(enteredCode)) {
            this.showJoinError('5자리 숫자 코드를 입력하세요');
            return;
        }
        if (!this.database) {
            this.showJoinError('서버 연결 중...');
            return;
        }
        try {
            this.gameCode = enteredCode;
            this.gameRef = this.database.ref('janggi_games/' + this.gameCode);
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
            this.hostPlayerName = roomData.hostName;
            this.isRoomHost = false;
            this.isRoomGuest = true;
            this.isOnlineGame = true;
            
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            
            this.syncBoard(roomData.board);
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
        joinBtn.disabled = true;
        setTimeout(() => {
            joinBtn.textContent = originalText;
            joinBtn.disabled = false;
        }, 2000);
    }
    
    clearRoomCodeInput() {
        document.getElementById('roomCodeInput').value = '';
    }
    
    showNameError(inputElement, message) {
        const originalPlaceholder = inputElement.placeholder;
        inputElement.placeholder = message;
        inputElement.value = '';
        inputElement.classList.add('error');
        setTimeout(() => {
            inputElement.placeholder = originalPlaceholder;
            inputElement.classList.remove('error');
        }, 3000);
    }
    
    clearNameInputs() {
        document.getElementById('hostNameInput').value = '';
        document.getElementById('guestNameInput').value = '';
    }

    updatePlayerNames() {
        const choPlayerElement = document.getElementById('choPlayerName');
        const hanPlayerElement = document.getElementById('hanPlayerName');
        const choContainer = document.getElementById('choPlayerContainer');
        const hanContainer = document.getElementById('hanPlayerContainer');
        
        choPlayerElement.textContent = this.hostPlayerName || '대기중...';
        hanPlayerElement.textContent = this.guestPlayerName || '대기중...';
        
        if (this.isRoomHost || this.isRoomGuest) {
            choContainer.style.display = 'flex';
            hanContainer.style.display = 'flex';
        }
    }

    hidePlayerNames() {
        document.getElementById('choPlayerContainer').style.display = 'none';
        document.getElementById('hanPlayerContainer').style.display = 'none';
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    initializeTheme() {
        if (this.isDarkMode) this.enableDarkMode();
        else this.enableLightMode();
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        if (this.isDarkMode) this.enableDarkMode();
        else this.enableLightMode();
        localStorage.setItem('darkMode', this.isDarkMode.toString());
    }

    enableDarkMode() {
        document.getElementById('lightTheme').disabled = true;
        document.getElementById('darkTheme').disabled = false;
        document.querySelector('.theme-icon').textContent = '☀️';
    }

    enableLightMode() {
        document.getElementById('lightTheme').disabled = false;
        document.getElementById('darkTheme').disabled = true;
        document.querySelector('.theme-icon').textContent = '🌙';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new JanggiGame();
});
