class JanggiGame {
    constructor() {
        this.board = [];
        this.currentPlayer = 'cho'; // 장기는 초(楚)가 먼저 시작
        this.selectedSquare = null;
        this.gameStarted = false;
        this.capturedPieces = { cho: [], han: [] };

        // Timer properties
        this.turnTimeLimit = 40; // 40 seconds limit
        this.currentTurnTime = this.turnTimeLimit;
        this.timerInterval = null;

        // Online game properties
        this.gameCode = null;
        this.isOnlineGame = false;
        this.isRoomCreated = false;
        this.isGameInProgress = false;
        this.isRoomHost = false; // 방장은 '초(cho)'
        this.isRoomGuest = false; // 게스트는 '한(han)'
        this.isMovePending = false;

        // Player names
        this.hostPlayerName = ''; // 초(cho) 플레이어
        this.guestPlayerName = ''; // 한(han) 플레이어

        // Firebase real-time communication
        this.database = null;
        this.playerId = this.generatePlayerId();
        this.gameRef = null;
        this.listeners = [];
        
        // 다크모드 상태
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';

        // 장기 기물 (Unicode)
        this.pieces = {
            cho: { // 초(楚) - 녹색/파란색
                general: '楚', chariot: '車', cannon: '砲',
                horse: '馬', elephant: '象', guard: '士', soldier: '卒'
            },
            han: { // 한(漢) - 빨간색
                general: '漢', chariot: '車', cannon: '包',
                horse: '傌', elephant: '相', guard: '士', soldier: '兵'
            }
        };

        console.log('🔥 Firebase Janggi Game Initialization Started');
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
        if (!hostName) {
            this.showNameError(hostNameInput, '이름을 입력하세요');
            return;
        }
        if (hostName.length < 2) {
            this.showNameError(hostNameInput, '이름은 2자 이상이어야 합니다');
            return;
        }
        if (!this.database) {
            alert('서버 연결을 기다리고 있습니다. 잠시 후 다시 시도해주세요.');
            return;
        }
        try {
            this.gameCode = this.generateRoomCode();
            this.hostPlayerName = hostName;
            this.isRoomHost = true;
            this.isRoomGuest = false;
            this.isOnlineGame = true;
            console.log('🏠 방장 설정 완료 (초)');
            
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
            this.gameRef = this.database.ref('games/' + this.gameCode);
            await this.gameRef.set(roomData);
            
            console.log('✅ Firebase 방 생성:', this.gameCode);
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            
            this.showGameCode();
            this.initializeBoard();
            this.renderBoard();
            this.showWaitingState();
            this.updatePlayerNames();
            this.setupFirebaseListeners();
        } catch (error) {
            console.error('❌ 방 생성 실패:', error);
            alert('방 생성에 실패했습니다: ' + error.message);
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
            console.error('❌ 게임 재시작 실패:', error);
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
        this.board = Array(10).fill(null).map(() => Array(9).fill(null));
        const set = (r, c, type, color) => { this.board[r][c] = { type, color }; };

        set(0,0,'chariot','han'); set(0,8,'chariot','han'); set(0,1,'horse','han');   set(0,7,'horse','han');
        set(0,2,'elephant','han');set(0,6,'elephant','han');set(0,3,'guard','han');   set(0,5,'guard','han');
        set(1,4,'general','han'); set(2,1,'cannon','han');  set(2,7,'cannon','han');
        set(3,0,'soldier','han'); set(3,2,'soldier','han'); set(3,4,'soldier','han'); set(3,6,'soldier','han'); set(3,8,'soldier','han');

        set(9,0,'chariot','cho'); set(9,8,'chariot','cho'); set(9,1,'horse','cho');   set(9,7,'horse','cho');
        set(9,2,'elephant','cho');set(9,6,'elephant','cho');set(9,3,'guard','cho');   set(9,5,'guard','cho');
        set(8,4,'general','cho'); set(7,1,'cannon','cho');  set(7,7,'cannon','cho');
        set(6,0,'soldier','cho'); set(6,2,'soldier','cho'); set(6,4,'soldier','cho'); set(6,6,'soldier','cho'); set(6,8,'soldier','cho');
    }

    renderBoard() {
        const boardElement = document.getElementById('janggiboard');
        if (!boardElement) return;
        boardElement.innerHTML = '';
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const square = document.createElement('div');
                square.className = `square`;
                square.dataset.row = row;
                square.dataset.col = col;
                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${piece.color}`;
                    pieceElement.textContent = this.pieces[piece.color][piece.type];
                    square.appendChild(pieceElement);
                }
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }
        this.updateCapturedPieces();
    }

    async handleSquareClick(row, col) {
        if (!this.gameStarted || !this.isGameInProgress || this.isMovePending) return;

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
                }
                this.selectedSquare = null;
                this.clearHighlights();
            }
        }
    }

    highlightValidMoves(row, col) {
        this.clearHighlights();
        document.querySelector(`[data-row="${row}"][data-col="${col}"]`).classList.add('selected');
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.isValidMove(row, col, r, c)) {
                    const targetSquare = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    targetSquare.classList.add(this.board[r][c] ? 'capture' : 'valid-move');
                }
            }
        }
    }

    clearHighlights() {
        document.querySelectorAll('.square').forEach(s => s.classList.remove('selected', 'valid-move', 'capture'));
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        if (toRow<0 || toRow>=10 || toCol<0 || toCol>=9) return false;
        if (fromRow===toRow && fromCol===toCol) return false;
        const piece = this.board[fromRow][fromCol];
        const target = this.board[toRow][toCol];
        if (!piece) return false;
        if (target && target.color === piece.color) return false;

        switch (piece.type) {
            case 'general': case 'guard': return this.isValidPalaceMove(fromRow, fromCol, toRow, toCol);
            case 'horse': return this.isValidHorseMove(fromRow, fromCol, toRow, toCol);
            case 'elephant': return this.isValidElephantMove(fromRow, fromCol, toRow, toCol);
            case 'chariot': return this.isValidChariotMove(fromRow, fromCol, toRow, toCol);
            case 'cannon': return this.isValidCannonMove(fromRow, fromCol, toRow, toCol);
            case 'soldier': return this.isValidSoldierMove(fromRow, fromCol, toRow, toCol, piece.color);
            default: return false;
        }
    }

    isPalace(r, c) { return (r>=0&&r<=2&&c>=3&&c<=5) || (r>=7&&r<=9&&c>=3&&c<=5); }
    isValidPalaceMove(fR, fC, tR, tC) {
        if (!this.isPalace(tR, tC)) return false;
        const dR = Math.abs(tR-fR), dC = Math.abs(tC-fC);
        if (dR+dC === 1) return true;
        if (dR===1 && dC===1) {
            const centers = [[1,4],[8,4]];
            return centers.some(([r,c]) => (r===fR&&c===fC) || (r===tR&&c===tC));
        }
        return false;
    }
    isValidHorseMove(fR, fC, tR, tC) {
        const dR = Math.abs(tR-fR), dC = Math.abs(tC-fC);
        if (!((dR===2&&dC===1)||(dR===1&&dC===2))) return false;
        if (dR===2 && this.board[fR+Math.sign(tR-fR)][fC]) return false;
        if (dC===2 && this.board[fR][fC+Math.sign(tC-fC)]) return false;
        return true;
    }
    isValidElephantMove(fR, fC, tR, tC) {
        const dR = Math.abs(tR-fR), dC = Math.abs(tC-fC);
        if (!((dR===3&&dC===2)||(dR===2&&dC===3))) return false;
        const sR = Math.sign(tR-fR), sC = Math.sign(tC-fC);
        if (dR===3 && (this.board[fR+sR][fC] || this.board[fR+2*sR][fC+sC])) return false;
        if (dC===3 && (this.board[fR][fC+sC] || this.board[fR+sR][fC+2*sC])) return false;
        return true;
    }
    isValidChariotMove(fR, fC, tR, tC) {
        const isDiagonal = Math.abs(tR-fR)===Math.abs(tC-fC);
        if ((fR!==tR && fC!==tC && !isDiagonal) || (isDiagonal && !this.isPalace(fR,fC))) return false;
        
        const sR=Math.sign(tR-fR), sC=Math.sign(tC-fC);
        let r=fR+sR, c=fC+sC;
        while(r!==tR||c!==tC) {
            if(this.board[r][c]) return false;
            r+=sR; c+=sC;
        }
        return true;
    }
    isValidCannonMove(fR, fC, tR, tC) {
        const target = this.board[tR][tC];
        if(target && target.type === 'cannon') return false;
        
        let jump = 0;
        const isDiagonal = Math.abs(tR-fR)===Math.abs(tC-fC);
        if ((fR!==tR && fC!==tC && !isDiagonal) || (isDiagonal && !this.isPalace(fR,fC))) return false;
        
        const sR=Math.sign(tR-fR), sC=Math.sign(tC-fC);
        let r=fR+sR, c=fC+sC;
        while(r!==tR||c!==tC) {
            if(this.board[r][c]) {
                if(this.board[r][c].type==='cannon') return false; // 포는 포를 못넘음
                jump++;
            }
            r+=sR; c+=sC;
        }
        return jump === 1;
    }
    isValidSoldierMove(fR, fC, tR, tC, color) {
        const dir = color === 'cho' ? -1 : 1;
        if (tR===fR+dir && tC===fC) return true;
        if (tR===fR && Math.abs(tC-fC)===1) return true;
        if (this.isPalace(fR,fC) && tR===fR+dir && Math.abs(tC-fC)===1) return true;
        return false;
    }

    async makeMove(fromRow, fromCol, toRow, toCol) {
        this.isMovePending = true;
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow][toCol];
        let gameEnded = false, winner = null;

        if (captured) {
            this.capturedPieces[captured.color].push(captured);
            if (captured.type === 'general') {
                gameEnded = true;
                winner = piece.color;
            }
        }
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
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
                console.error('❌ 수 이동 실패:', error);
                this.isMovePending = false;
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
        
        setTimeout(() => {
            const myColor = this.isRoomHost ? 'cho' : 'han';
            alert(winner === myColor ? '🎊 축하합니다! 승리하셨습니다! 🎊' : '😊 수고하셨습니다! 😊');
        }, 500);
    }
    
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'cho' ? 'han' : 'cho';
        this.updateGameStatus();
        this.resetTurnTimer();
    }

    updateGameStatus() {
        const playerText = this.currentPlayer === 'cho' ? "초(楚)의 차례" : "한(漢)의 차례";                                                                                                                                      
        document.getElementById('currentPlayer').textContent = playerText;
    }

    updateCapturedPieces() {
        const capturedChoEl = document.getElementById('capturedCho');
        const capturedHanEl = document.getElementById('capturedHan');
        if (!this.capturedPieces) this.capturedPieces = { cho: [], han: [] };
        capturedChoEl.innerHTML = this.capturedPieces.cho.map(p => this.pieces.cho[p.type]).join(' ');
        capturedHanEl.innerHTML = this.capturedPieces.han.map(p => this.pieces.han[p.type]).join(' ');
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
    }

    resetTurnTimer() {
        this.stopTurnTimer();
        if(this.isGameInProgress) this.startTurnTimer();
    }
    
    updateTimerDisplay() {
        const timerElement = document.getElementById('turnTimer');
        if(timerElement) {
            timerElement.textContent = this.currentTurnTime;
            timerElement.classList.toggle('warning', this.currentTurnTime <= 5);
        }
    }
    
    async handleTimeOut() {
        this.stopTurnTimer();
        const myColor = this.isRoomHost ? 'cho' : 'han';
        if (this.currentPlayer === myColor) {
            alert('시간 초과! 무작위 수가 두어집니다.');
            const moves = this.getAllValidMoves(this.currentPlayer);
            if (moves.length > 0) {
                const rMove = moves[Math.floor(Math.random() * moves.length)];
                await this.makeMove(rMove.fR, rMove.fC, rMove.tR, rMove.tC);
            }
        }
    }

    getAllValidMoves(player) {
        const moves = [];
        for (let r=0; r<10; r++) for (let c=0; c<9; c++) {
            const piece = this.board[r][c];
            if (piece && piece.color === player) {
                for (let tr=0; tr<10; tr++) for (let tc=0; tc<9; tc++) {
                    if (this.isValidMove(r, c, tr, tc)) {
                        moves.push({ fR: r, fC: c, tR: tr, tC: tc });
                    }
                }
            }
        }
        return moves;
    }

    generateRoomCode() { return Math.floor(10000 + Math.random() * 90000).toString(); }
    getInitialBoard() {
        const board = new JanggiGame();
        board.initializeBoard();
        return board.board;
    }
    
    // --- 이하 Firebase 및 UI 제어 함수 (chess.js와 거의 동일, 텍스트만 수정) ---
    // (이 부분은 chess.js에서 가져와 white/black -> cho/han으로 수정한 완전한 버전입니다.)
    
    setupFirebaseListeners() {
        if (!this.gameRef) return;
        const gameListener = this.gameRef.on('value', (snapshot) => {
            const gameData = snapshot.val();
            if (!gameData) {
                alert('게임 방이 사라졌습니다.');
                this.backToMenu();
                return;
            }

            this.hostPlayerName = gameData.hostName;
            this.guestPlayerName = gameData.guestName;
            this.updatePlayerNames();

            if (gameData.guestId && this.isRoomHost && !this.isGameInProgress) {
                this.showWaitingState();
            }

            if (gameData.board) this.syncBoard(gameData.board);
            if (gameData.capturedPieces) {
                this.capturedPieces = gameData.capturedPieces;
                this.updateCapturedPieces();
            }

            if (gameData.currentPlayer !== this.currentPlayer) {
                this.currentPlayer = gameData.currentPlayer;
                this.updateGameStatus();
                this.resetTurnTimer();
            }
            this.isMovePending = false;
            
            if (gameData.gameStarted && !this.isGameInProgress) this.handleGameStart();
            if (gameData.gameEnded && this.isGameInProgress) this.endGame(gameData.winner);
            if (gameData.gameRestarted && gameData.gameStarted) {
                if(!this.isGameInProgress || !this.gameStarted) this.handleGameRestart(gameData);
            }
        });
        this.listeners.push({ ref: this.gameRef, listener: gameListener });
    }

    syncBoard(newBoard) {
        // Firebase에서 오는 데이터가 배열이 아닐 수 있으므로 안전하게 처리
        const verifiedBoard = Array(10).fill(null).map(() => Array(9).fill(null));
        if (newBoard && Array.isArray(newBoard)) {
            for (let r = 0; r < 10; r++) {
                if (newBoard[r] && Array.isArray(newBoard[r])) {
                    for (let c = 0; c < 9; c++) {
                        verifiedBoard[r][c] = newBoard[r][c] || null;
                    }
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
        this.syncBoard(gameData.board);
        this.capturedPieces = gameData.capturedPieces || { cho: [], han: [] };
        this.updateCapturedPieces();
        this.showGameButtons();
        this.resetTurnTimer();
        this.updateGameStatus();
        alert('🎮 게임이 재시작되었습니다! 🎮');
    }
    
    showGameCode() {
        document.getElementById('gameCode').textContent = this.gameCode;
        document.getElementById('gameCodeContainer').style.display = 'flex';
    }
    hideGameCode() { document.getElementById('gameCodeContainer').style.display = 'none'; }
    copyGameCode() {
        navigator.clipboard.writeText(this.gameCode).then(() => {
            const btn = document.getElementById('copyCodeBtn');
            btn.textContent = '✓';
            setTimeout(() => { btn.textContent = '📋'; }, 1500);
        });
    }

    async startActualGame() {
        if (!this.isRoomHost || !this.guestPlayerName) {
            alert('⚠️ 상대방이 들어올 때까지 기다려주세요!');
            return;
        }
        try {
            await this.gameRef.update({
                gameStarted: true,
                isGameInProgress: true,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            alert('게임 시작에 실패했습니다: ' + error.message);
        }
    }

    showWaitingState() {
        const statusEl = document.getElementById('gameStatus');
        const startBtn = document.getElementById('startGameBtnInRoom');
        document.getElementById('currentPlayer').textContent = '대기중';

        if (this.isRoomHost) {
            if (this.guestPlayerName) {
                statusEl.textContent = '상대방이 접속했습니다! 게임을 시작하세요.';
                startBtn.style.display = 'inline-block';
                startBtn.disabled = false;
            } else {
                statusEl.textContent = '상대방을 기다리고 있습니다. 코드를 공유하세요.';
                startBtn.style.display = 'inline-block';
                startBtn.disabled = true;
            }
        } else if (this.isRoomGuest) {
            statusEl.textContent = '방장이 게임을 시작할 때까지 기다려주세요.';
            startBtn.style.display = 'none';
        }
        this.hideResetButton();
    }

    showGameButtons() {
        document.getElementById('startGameBtnInRoom').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'inline-block';
    }
    hideResetButton() { document.getElementById('resetBtn').style.display = 'none'; }
    hideAllButtons() {
        document.getElementById('startGameBtnInRoom').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'none';
    }

    async joinRoom() {
        const guestNameInput = document.getElementById('guestNameInput');
        const guestName = guestNameInput.value.trim();
        const codeInput = document.getElementById('roomCodeInput');
        const code = codeInput.value.trim();
        if (!guestName || guestName.length < 2) {
            this.showNameError(guestNameInput, '이름을 2자 이상 입력하세요'); return;
        }
        if (code.length !== 5) {
            this.showJoinError('5자리 코드를 입력하세요'); return;
        }
        
        try {
            this.gameCode = code;
            this.gameRef = this.database.ref('games/' + this.gameCode);
            const snapshot = await this.gameRef.once('value');
            const roomData = snapshot.val();

            if (!roomData) throw new Error('방 코드가 존재하지 않습니다');
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
    
    clearRoomCodeInput() { document.getElementById('roomCodeInput').value = ''; }

    showNameError(input, message) {
        const originalPlaceholder = input.placeholder;
        input.placeholder = message;
        input.value = '';
        setTimeout(() => { input.placeholder = originalPlaceholder; }, 3000);
    }

    clearNameInputs() {
        document.getElementById('hostNameInput').value = '';
        document.getElementById('guestNameInput').value = '';
    }

    updatePlayerNames() {
        // HTML의 ID에 맞춰 수정 (choPlayerName, hanPlayerName)
        const choPlayerEl = document.getElementById('choPlayerName');
        const hanPlayerEl = document.getElementById('hanPlayerName');
        
        if (choPlayerEl) choPlayerEl.textContent = this.hostPlayerName || '대기중...';
        if (hanPlayerEl) hanPlayerEl.textContent = this.guestPlayerName || '대기중...';
        
        document.getElementById('choPlayerContainer').style.display = 'flex';
        document.getElementById('hanPlayerContainer').style.display = 'flex';
    }

    hidePlayerNames() {
        document.getElementById('choPlayerContainer').style.display = 'none';
        document.getElementById('hanPlayerContainer').style.display = 'none';
    }

    generatePlayerId() { return 'player_' + Math.random().toString(36).substr(2, 9); }

    // 다크모드 관련 함수 (기존과 동일)
    initializeTheme() {
        if (this.isDarkMode) this.enableDarkMode(); else this.enableLightMode();
    }
    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        if (this.isDarkMode) this.enableDarkMode(); else this.enableLightMode();
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
