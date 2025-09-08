class OmokGame {
    constructor() {
        // ?�목?��? 15x15
        this.board = [];
        this.rows = 15;
        this.cols = 15;

        // ?�돌??먼�? ?�작
        this.currentPlayer = 'black';
        this.lastMove = null;
        this.gameStarted = false;

        // ?�?�머
        this.turnTimeLimit = 40; 
        this.currentTurnTime = this.turnTimeLimit;
        this.timerInterval = null;

        // ?�라??게임 ?�성
        this.gameCode = null;
        this.isOnlineGame = false;
        this.isGameInProgress = false;
        this.isRoomHost = false; // ??�?
        this.isRoomGuest = false; // �???
        this.isMovePending = false; 

        // ?�레?�어 ?�름
        this.hostPlayerName = '';
        this.guestPlayerName = '';

        // Firebase (?�목?�?로컬 게임?��?�?비활?�화)
        this.database = null;
        this.playerId = this.generatePlayerId();
        this.gameRef = null;
        this.listeners = [];
        
        // ?�크모드
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';

        console.log('?�� Omok Game Initializing');
        this.initializeEventListeners();
        this.initializeTheme();
        this.initializeFirebase();
    }

    initializeEventListeners() {
        console.log('?�� Setting up event listeners...');
        
        const createRoomBtn = document.getElementById('createRoomBtn');
        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => {
                console.log('?�� Create Room button clicked');
                this.createRoom();
            });
            console.log('??createRoomBtn event listener added');
        } else {
            console.error('??createRoomBtn element not found');
        }
        
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGameOnline());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.backToMenu());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyGameCode());
        document.getElementById('startGameBtnInRoom').addEventListener('click', () => this.startActualGame());
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.joinRoom());
        
        // ?�크모드 ?��? ?�벤??리스??
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('roomCodeInput').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
    }

    initializeFirebase() {
        if (window.firebaseReady && window.database) {
            this.database = window.database;
            console.log('?�� Firebase Connection Complete');
        } else {
            console.log('??Waiting for Firebase to load...');
            document.addEventListener('firebaseReady', () => {
                this.database = window.database;
                console.log('?�� Firebase Connection Complete (Event)');
            });
        }
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    generateRoomCode() {
        return Math.floor(10000 + Math.random() * 90000).toString();
    }

    initializeTheme() {
        if (this.isDarkMode) {
            this.enableDarkMode();
        } else {
            this.enableLightMode();
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode.toString());
        if (this.isDarkMode) {
            this.enableDarkMode();
        } else {
            this.enableLightMode();
        }
    }

    enableDarkMode() {
        document.getElementById('lightTheme').disabled = true;
        document.getElementById('darkTheme').disabled = false;
        document.querySelector('.theme-icon').textContent = '?��?;
    }

    enableLightMode() {
        document.getElementById('lightTheme').disabled = false;
        document.getElementById('darkTheme').disabled = true;
        document.querySelector('.theme-icon').textContent = '?��';
    }

    getInitialBoard() {
        // 15x15 �??�목???�성
        const board = [];
        for (let i = 0; i < this.rows; i++) {
            board[i] = [];
            for (let j = 0; j < this.cols; j++) {
                board[i][j] = null;
            }
        }
        console.log('?�� Initial board created:', board.length + 'x' + (board[0] ? board[0].length : 0));
        return board;
    }

    showNameError(inputEl, message) {
        const originalPlaceholder = inputEl.placeholder;
        inputEl.placeholder = message;
        inputEl.value = '';
        inputEl.classList.add('error');
        setTimeout(() => {
            inputEl.placeholder = originalPlaceholder;
            inputEl.classList.remove('error');
        }, 3000);
    }

    async createRoom() {
        console.log('?�� createRoom function called');
        
        const hostNameInput = document.getElementById('hostNameInput');
        console.log('?�� hostNameInput element:', hostNameInput);
        
        const hostName = hostNameInput ? hostNameInput.value.trim() : '';
        console.log('?�� Host name:', hostName);
        
        if (!hostName) {
            console.log('?�️ No host name provided');
            this.showNameError(hostNameInput, '?�름???�력?�주?�요');
            return;
        }
        if (hostName.length < 2) {
            console.log('?�️ Host name too short');
            this.showNameError(hostNameInput, '최소 2글???�상 ?�력?�주?�요');
            return;
        }
        
        console.log('?�� Starting Firebase room creation - Host:', hostName);
        console.log('?�� Database connection:', this.database);
        
        if (!this.database) {
            console.error('??No database connection');
            alert('Firebase???�결 중입?�다. ?�시 ???�시 ?�도?�주?�요.');
            return;
        }
        
        try {
            this.gameCode = this.generateRoomCode();
            this.hostPlayerName = hostName;
            this.isRoomHost = true;
            this.isRoomGuest = false;
            this.isOnlineGame = true;
            
            const initialBoard = this.getInitialBoard();
            this.gameRef = this.database.ref(`omokGames/${this.gameCode}`);
            
            await this.gameRef.set({
                hostId: this.playerId,
                hostName: hostName,
                guestId: null,
                guestName: null,
                board: initialBoard,
                currentPlayer: 'black',
                gameStarted: false,
                isGameInProgress: false,
                gameEnded: false,
                winner: null,
                lastMove: null,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            this.showGameCode();
            this.showWaitingState();
            this.updatePlayerNames();
            this.setupFirebaseListeners();
        } catch (error) {
            console.error('??Room creation failed:', error);
            alert('�??�성???�패?�습?�다: ' + error.message);
        }
    }

    async joinRoom() {
        const guestNameInput = document.getElementById('guestNameInput');
        const roomCodeInput = document.getElementById('roomCodeInput');
        const guestName = guestNameInput.value.trim();
        const roomCode = roomCodeInput.value.trim();
        
        if (!guestName) {
            this.showNameError(guestNameInput, '?�름???�력?�주?�요');
            return;
        }
        if (!roomCode || roomCode.length !== 5) {
            this.showJoinError('5?�리 �?코드�??�력?�주?�요');
            return;
        }
        
        try {
            this.gameRef = this.database.ref(`omokGames/${roomCode}`);
            const snapshot = await this.gameRef.once('value');
            const roomData = snapshot.val();
            
            if (!roomData) {
                this.showJoinError('존재?��? ?�는 방입?�다');
                return;
            }
            if (roomData.guestId) {
                this.showJoinError('?��? 가??�?방입?�다');
                return;
            }
            
            this.gameCode = roomCode;
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
            
            this.board = roomData.board || this.getInitialBoard();
            this.lastMove = roomData.lastMove;
            this.renderBoard();
            this.showWaitingState();
            this.updatePlayerNames();
            this.setupFirebaseListeners();
        } catch (error) {
            this.showJoinError('�?참�????�패?�습?�다');
            console.error('??Join room failed:', error);
        }
    }

    setupFirebaseListeners() {
        if (!this.gameRef) return;
        
        const listener = this.gameRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            
            console.log('?�� Firebase data received:', data);
            
            // ?��?방이 참�??�을 ??
            if (this.isRoomHost && data.guestName && !this.guestPlayerName) {
                this.guestPlayerName = data.guestName;
                this.updatePlayerNames();
                this.showStartGameButton();
            }
            
            // 게임 ?�작 ?�태 ?�기??
            if (data.gameStarted && !this.gameStarted) {
                this.gameStarted = true;
                this.isGameInProgress = true;
                this.startTurnTimer();
                this.hideAllButtons();
                document.getElementById('resetBtn').style.display = 'inline-block';
            }
            
            // 보드 ?�태 ?�기??
            if (data.board) {
                this.board = data.board;
                this.lastMove = data.lastMove;
                this.currentPlayer = data.currentPlayer || 'black';
                this.renderBoard();
                this.updateGameStatus();
            }
            
            // 게임 종료 처리
            if (data.gameEnded && data.winner) {
                this.endGame(data.winner);
            }
            
            // 게임 ?�시??처리
            if (data.gameRestarted && data.gameRestarted !== this.lastRestartTime) {
                this.lastRestartTime = data.gameRestarted;
                this.handleGameRestart();
            }
            
            this.isMovePending = false;
        });
        
        this.listeners.push({ ref: this.gameRef, listener });
    }

    async createRoom() {
        console.log('?�� createRoom function called');
        
        const hostNameInput = document.getElementById('hostNameInput');
        console.log('?�� hostNameInput element:', hostNameInput);
        
        const hostName = hostNameInput ? hostNameInput.value.trim() : '';
        console.log('?�� Host name:', hostName);
        
        if (!hostName) {
            console.log('?�️ No host name provided');
            this.showNameError(hostNameInput, '?�름???�력?�주?�요');
            return;
        }
        if (hostName.length < 2) {
            console.log('?�️ Host name too short');
            this.showNameError(hostNameInput, '최소 2글???�상 ?�력?�주?�요');
            return;
        }
        
        console.log('?�� Starting Firebase room creation - Host:', hostName);
        console.log('?�� Database connection:', this.database);
        
        if (!this.database) {
            console.error('??No database connection');
            alert('Firebase???�결 중입?�다. ?�시 ???�시 ?�도?�주?�요.');
            return;
        }
        
        try {
            this.gameCode = this.generateRoomCode();
            this.hostPlayerName = hostName;
            this.isRoomHost = true;
            this.isRoomGuest = false;
            this.isOnlineGame = true;
            
            const initialBoard = this.getInitialBoard();
            this.gameRef = this.database.ref(`omokGames/${this.gameCode}`);
            
            await this.gameRef.set({
                hostId: this.playerId,
                hostName: hostName,
                guestId: null,
                guestName: null,
                board: initialBoard,
                currentPlayer: 'black',
                gameStarted: false,
                isGameInProgress: false,
                gameEnded: false,
                winner: null,
                lastMove: null,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            
            console.log('??Room created successfully with code:', this.gameCode);
            
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            this.showGameCode();
            this.showWaitingState();
            this.updatePlayerNames();
            this.setupFirebaseListeners();
        } catch (error) {
            console.error('??Room creation failed:', error);
            alert('�??�성???�패?�습?�다: ' + error.message);
        }
    }

    async resetGameOnline() {
        if (!this.gameRef || !this.isOnlineGame) return;
        
        try {
            this.initializeBoard();
            await this.gameRef.update({
                board: this.board,
                currentPlayer: 'black',
                lastMove: null,
                gameStarted: true,
                isGameInProgress: true,
                gameEnded: false,
                winner: null,
                gameRestarted: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('??Game restart failed:', error);
            alert('게임 ?�시?�에 ?�패?�습?�다: ' + error.message);
        }
    }
    
    backToMenu() {
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
        document.getElementById('omokboard').innerHTML = '';
    }

    initializeBoard() {
        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(null));
        this.lastMove = null;
    }
    
    renderBoard() {
        const boardElement = document.getElementById('omokboard');
        if (!boardElement) return;
        
        boardElement.innerHTML = '';
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.dataset.row = row;
                square.dataset.col = col;
                
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                
                const pieceData = this.board[row][col];
                if (pieceData) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece ${pieceData}`;
                    if(this.lastMove && this.lastMove.row === row && this.lastMove.col === col) {
                        pieceElement.classList.add('last-move');
                    }
                    square.appendChild(pieceElement);
                }
                
                boardElement.appendChild(square);
            }
        }
    }

    async handleSquareClick(row, col) {
        if (!this.gameStarted || !this.isGameInProgress || this.isMovePending) return;
        
        const myColor = this.isRoomHost ? 'black' : 'white';
        if (this.currentPlayer !== myColor) {
            alert("?��?방의 차�??�니??");
            return;
        }
        
        if (this.board[row][col]) return; // ?��? ?�이 ?�는 곳�? ?�릭 불�?

        this.isMovePending = true;
        
        // 로컬?�서 먼�? ?�태 ?�데?�트
        this.board[row][col] = this.currentPlayer;
        this.lastMove = { row, col };
        
        this.renderBoard();
        
        const isWin = this.checkForWin(row, col);
        let gameEnded = false;
        let winner = null;
        
        if (isWin) {
            gameEnded = true;
            winner = this.currentPlayer;
        }

        if (this.gameRef && this.isOnlineGame) {
            try {
                const updateData = {
                    board: this.board,
                    lastMove: this.lastMove,
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                };
                if (gameEnded) {
                    updateData.gameEnded = true;
                    updateData.winner = winner;
                    updateData.isGameInProgress = false; 
                } else {
                    updateData.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
                }
                await this.gameRef.update(updateData);
            } catch (error) {
                console.error('??Failed to send move:', error);
                this.isMovePending = false;
                alert('?��? ?�송?�는 ???�류가 발생?�습?�다. ?�시 ?�도?�주?�요.');
            }
        }
    }
    
    checkForWin(row, col) {
        const player = this.board[row][col];
        if (!player) return false;

        const directions = [
            { r: 0, c: 1 },  // 가�?
            { r: 1, c: 0 },  // ?�로
            { r: 1, c: 1 },  // ?�각??\
            { r: 1, c: -1 }  // ?�각??/
        ];

        for (const dir of directions) {
            let count = 1;
            // ??방향?�로 체크
            for (let i = 1; i < 5; i++) {
                const newRow = row + i * dir.r;
                const newCol = col + i * dir.c;
                if (newRow >= 0 && newRow < this.rows && newCol >= 0 && newCol < this.cols && this.board[newRow][newCol] === player) {
                    count++;
                } else {
                    break;
                }
            }
            // 반�? 방향?�로 체크
            for (let i = 1; i < 5; i++) {
                const newRow = row - i * dir.r;
                const newCol = col - i * dir.c;
                if (newRow >= 0 && newRow < this.rows && newCol >= 0 && newCol < this.cols && this.board[newRow][newCol] === player) {
                    count++;
                } else {
                    break;
                }
            }
            if (count >= 5) return true;
        }
        return false;
    }

    endGame(winner) {
        this.isGameInProgress = false;
        this.gameStarted = false;
        this.stopTurnTimer();
        
        const gameStatus = document.getElementById('gameStatus');
        const winnerText = winner === 'black' ? '??�?' : '�???';
        gameStatus.textContent = `?�� 게임 종료! ${winnerText}???�리! ?��`;
        
        const myColor = this.isRoomHost ? 'black' : 'white';
        setTimeout(() => {
            if (winner === myColor) {
                alert(`?�� 축하?�니?? ?�리?�셨?�니?? ?��`);
            } else {
                alert(`?�� ?�고?�셨?�니?? ?�시 ?�전?�보?�요! ?��`);
            }
        }, 500);
    }

    updateGameStatus() {
        const playerText = this.currentPlayer === 'black' ? "??�???차�?" : "�?????차�?";                                                                                                                                      
        document.getElementById('currentPlayer').textContent = playerText;
        if (this.isGameInProgress) document.getElementById('gameStatus').textContent = '게임 진행 �?;
        this.updateTimerDisplay();
    }
    
    // --- ?�?�머 �??�라??로직 (?�기 게임�?거의 ?�일) ---
    
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

    stopTurnTimer() { clearInterval(this.timerInterval); this.timerInterval = null; }
    resetTurnTimer() { this.stopTurnTimer(); if(this.isGameInProgress) this.startTurnTimer(); }
    
    updateTimerDisplay() {
        const timerElement = document.getElementById('turnTimer');
        if (timerElement) {
            timerElement.textContent = this.currentTurnTime;
            timerElement.classList.toggle('warning', this.currentTurnTime <= 5);
        }
    }
    
    async handleTimeOut() {
        this.stopTurnTimer();
        const myColor = this.isRoomHost ? 'black' : 'white';
        if (this.currentPlayer === myColor) {
            alert('?�간 종료! ?�의???�치???�어집니??');
            // 비어?�는 �?�??�나�?무작?�로 ?�택
            const emptySquares = [];
            for(let r=0; r<this.rows; r++) {
                for(let c=0; c<this.cols; c++) {
                    if(!this.board[r][c]) emptySquares.push({r, c});
                }
            }
            if(emptySquares.length > 0) {
                const randomSquare = emptySquares[Math.floor(Math.random() * emptySquares.length)];
                await this.handleSquareClick(randomSquare.r, randomSquare.c);
            }
        }
    }
    
    setupFirebaseListeners() {
        if (!this.gameRef) return;
        const gameListener = this.gameRef.on('value', (snapshot) => {
            const gameData = snapshot.val();
            if (!gameData) {
                alert('게임 방이 ?�라졌습?�다. 메인 메뉴�??�아갑니??');
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

            if (gameData.board) this.syncBoard(gameData.board, gameData.lastMove);

            if (gameData.currentPlayer !== this.currentPlayer) {
                this.currentPlayer = gameData.currentPlayer;
                this.updateGameStatus();
                this.resetTurnTimer();
            }
            
            this.isMovePending = false;
            
            if (gameData.gameStarted && !this.isGameInProgress) this.handleGameStart();
            if (gameData.gameEnded && this.isGameInProgress) this.endGame(gameData.winner);
            if (gameData.gameRestarted && gameData.gameStarted && !gameData.gameEnded) {
                if(!this.isGameInProgress || !this.gameStarted) this.handleGameRestart(gameData);
            }
        });
        this.listeners.push({ ref: this.gameRef, listener: gameListener });
    }

    syncBoard(newBoard, lastMove) {
        if (!newBoard) return;
        this.board = newBoard;
        this.lastMove = lastMove;
        this.renderBoard();
    }
    
    handleGameStart() {
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.currentPlayer = 'black';
        this.isMovePending = false;
        this.showGameButtons();
        this.updateGameStatus();
        this.startTurnTimer();
    }

    handleGameRestart(gameData) {
        this.gameStarted = true;
        this.isGameInProgress = true;
        this.currentPlayer = 'black';
        this.currentTurnTime = this.turnTimeLimit;
        this.isMovePending = false;
        
        document.getElementById('gameStatus').textContent = '게임???�시?�되?�습?�다!';
        this.showGameButtons();
        this.resetTurnTimer();
        this.updateGameStatus();
        
        if (gameData.board) this.syncBoard(gameData.board, gameData.lastMove);
        
        setTimeout(() => alert('?�� 게임???�시?�되?�습?�다! ?��'), 500);
    }
    
    generateRoomCode() { return Math.floor(10000 + Math.random() * 90000).toString(); }
    showGameCode() {
        const gameCodeContainer = document.getElementById('gameCodeContainer');
        const gameCodeElement = document.getElementById('gameCode');
        if (gameCodeContainer && gameCodeElement && this.gameCode) {
            gameCodeElement.textContent = this.gameCode;
            gameCodeContainer.style.display = 'flex';
        }
    }
    hideGameCode() { document.getElementById('gameCodeContainer').style.display = 'none'; this.gameCode = null; }
    copyGameCode() {
        if (this.gameCode) {
            navigator.clipboard.writeText(this.gameCode).then(() => {
                const copyBtn = document.getElementById('copyCodeBtn');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '??;
                setTimeout(() => { copyBtn.textContent = originalText; }, 1500);
            }).catch(err => console.error('Failed to copy code: ', err));
        }
    }
    
    async startActualGame() {
        if (!this.isRoomHost || !this.gameRef || !this.guestPlayerName) return;
        try {
            await this.gameRef.update({
                gameStarted: true,
                isGameInProgress: true,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) { console.error('??게임 ?�작 ?�패:', error); }
    }
    
    showWaitingState() {
        const playerEl = document.getElementById('currentPlayer');
        const statusEl = document.getElementById('gameStatus');
        const startBtn = document.getElementById('startGameBtnInRoom');
        
        playerEl.textContent = '?�기�?;
        
        if (this.isRoomHost) {
            if (this.guestPlayerName) {
                statusEl.textContent = '?��?방이 ?�속?�습?�다! 게임???�작?�세??';
                startBtn.style.display = 'inline-block';
                startBtn.disabled = false;
                startBtn.textContent = '게임 ?�작';
            } else {
                statusEl.textContent = '?��?방을 기다리는 �?.. 코드�?공유?�세??';
                startBtn.style.display = 'inline-block';
                startBtn.disabled = true;
                startBtn.textContent = '?�기�?..';
            }
        } else if (this.isRoomGuest) {
            statusEl.textContent = '방장??게임???�작???�까지 기다?�주?�요!';
            startBtn.style.display = 'none';
        }
        
        this.hideResetButton();
        this.updatePlayerNames();
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
        const enteredCode = codeInput.value.trim();
        if (guestName.length < 2) return this.showNameError(guestNameInput, '?�름??2???�상 ?�력?�세??);
        if (enteredCode.length !== 5) return this.showJoinError('5?�리 ?�자 코드�??�력?�세??);
        if (!this.database) return this.showJoinError('?�버 ?�결 �?..');

        try {
            this.gameCode = enteredCode;
            this.gameRef = this.database.ref('omok_games/' + this.gameCode);
            const snapshot = await this.gameRef.once('value');
            const roomData = snapshot.val();
            if (!roomData) throw new Error('존재?��? ?�는 방입?�다');
            if (roomData.guestId) throw new Error('방이 가??찼습?�다');
            
            await this.gameRef.update({
                guestId: this.playerId, guestName: guestName,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });

            this.guestPlayerName = guestName;
            this.hostPlayerName = roomData.hostName;
            this.isRoomHost = false;
            this.isRoomGuest = true;
            this.isOnlineGame = true;
            
            document.getElementById('gameMenu').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            
            this.syncBoard(roomData.board, roomData.lastMove);
            this.showWaitingState();
            this.updatePlayerNames();
            this.setupFirebaseListeners();
        } catch (error) { this.showJoinError(error.message); }
    }
    
    showJoinError(message) {
        const joinBtn = document.getElementById('joinRoomBtn');
        const originalText = joinBtn.textContent;
        joinBtn.textContent = message; joinBtn.disabled = true;
        setTimeout(() => { joinBtn.textContent = originalText; joinBtn.disabled = false; }, 2000);
    }
    clearRoomCodeInput() { document.getElementById('roomCodeInput').value = ''; }
    
    showNameError(inputEl, message) {
        const originalPlaceholder = inputEl.placeholder;
        inputEl.placeholder = message; inputEl.value = ''; inputEl.classList.add('error');
        setTimeout(() => { inputEl.placeholder = originalPlaceholder; inputEl.classList.remove('error'); }, 3000);
    }
    
    clearNameInputs() {
        document.getElementById('hostNameInput').value = '';
        document.getElementById('guestNameInput').value = '';
    }

    updatePlayerNames() {
        document.getElementById('blackPlayerName').textContent = this.hostPlayerName || '?�기�?..';
        document.getElementById('whitePlayerName').textContent = this.guestPlayerName || '?�기�?..';
        
        if (this.isRoomHost || this.isRoomGuest) {
            document.getElementById('blackPlayerContainer').style.display = 'flex';
            document.getElementById('whitePlayerContainer').style.display = 'flex';
        }
    }

    hidePlayerNames() {
        document.getElementById('blackPlayerContainer').style.display = 'none';
        document.getElementById('whitePlayerContainer').style.display = 'none';
    }

    generatePlayerId() { return 'player_' + Math.random().toString(36).substr(2, 9); }

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
        document.querySelector('.theme-icon').textContent = '?��?;
    }

    enableLightMode() {
        document.getElementById('lightTheme').disabled = false;
        document.getElementById('darkTheme').disabled = true;
        document.querySelector('.theme-icon').textContent = '?��';
    }

    showGameCode() {
        document.getElementById('gameCode').textContent = this.gameCode;
        document.getElementById('gameCodeContainer').style.display = 'block';
    }

    hideGameCode() {
        document.getElementById('gameCodeContainer').style.display = 'none';
    }

    showStartGameButton() {
        document.getElementById('startGameBtnInRoom').style.display = 'inline-block';
    }

    copyGameCode() {
        navigator.clipboard.writeText(this.gameCode).then(() => {
            const btn = document.getElementById('copyCodeBtn');
            const originalText = btn.textContent;
            btn.textContent = '복사??';
            setTimeout(() => { btn.textContent = originalText; }, 1000);
        });
    }

    async startActualGame() {
        if (!this.isRoomHost) return;
        if (!this.guestPlayerName) {
            alert('?��?방이 참�????�까지 기다?�주?�요.');
            return;
        }
        
        try {
            await this.gameRef.update({
                gameStarted: true,
                isGameInProgress: true,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('??Game start failed:', error);
        }
    }

    async resetGameOnline() {
        if (!this.isRoomHost || !this.gameRef) {
            this.resetGame();
            return;
        }
        
        try {
            const initialBoard = this.getInitialBoard();
            await this.gameRef.update({
                board: initialBoard,
                currentPlayer: 'black',
                gameStarted: false,
                isGameInProgress: false,
                gameEnded: false,
                winner: null,
                lastMove: null,
                gameRestarted: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            console.error('??Game restart failed:', error);
            alert('게임 ?�시?�에 ?�패?�습?�다: ' + error.message);
        }
    }

    handleGameRestart() {
        this.board = this.getInitialBoard();
        this.currentPlayer = 'black';
        this.lastMove = null;
        this.gameStarted = false;
        this.isGameInProgress = false;
        this.isMovePending = false;
        this.stopTurnTimer();
        this.renderBoard();
        this.showWaitingState();
        this.updateGameStatus();
    }

    hideAllButtons() {
        document.getElementById('startGameBtnInRoom').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'none';
    }

    updateGameStatus() {
        const playerText = this.currentPlayer === 'black' ? '?�돌??차�?' : '백돌??차�?';
        document.getElementById('currentPlayer').textContent = playerText;
        if (this.isGameInProgress) document.getElementById('gameStatus').textContent = '게임 진행 �?;
        this.updateTimerDisplay();
    }

    initializeBoard() {
        this.board = this.getInitialBoard();
    }

    renderBoard() {
        const boardElement = document.getElementById('omokboard');
        if (!boardElement) {
            console.error('??omokboard element not found');
            return;
        }
        
        boardElement.innerHTML = '';
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.dataset.row = row;
                square.dataset.col = col;
                
                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `stone ${piece}`;
                    pieceElement.textContent = piece === 'black' ? '?? : '??;
                    square.appendChild(pieceElement);
                }
                
                // 마�?�????�시
                if (this.lastMove && this.lastMove.row === row && this.lastMove.col === col) {
                    square.classList.add('last-move');
                }
                
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }
    }

    showWaitingState() {
        if (this.isRoomHost) {
            document.getElementById('gameStatus').textContent = '?��?방을 기다리는 �?..';
            document.getElementById('startGameBtnInRoom').style.display = this.guestPlayerName ? 'inline-block' : 'none';
        } else {
            document.getElementById('gameStatus').textContent = '?�스?��? 게임???�작?�기�?기다리는 �?..';
            document.getElementById('startGameBtnInRoom').style.display = 'none';
        }
        document.getElementById('resetBtn').style.display = 'none';
    }

    async handleSquareClick(row, col) {
        if (!this.gameStarted || !this.isGameInProgress || this.isMovePending) {
            return;
        }
        
        const myColor = this.isRoomHost ? 'black' : 'white';
        if (this.currentPlayer !== myColor) {
            alert("?��?방의 차�??�니??");
            return;
        }
        
        if (this.board[row][col]) {
            return; // ?��? ?�이 ?�여?�음
        }
        
        // ???�기
        this.board[row][col] = this.currentPlayer;
        this.lastMove = { row, col };
        this.isMovePending = true;
        
        // Firebase ?�데?�트
        if (this.gameRef && this.isOnlineGame) {
            try {
                await this.gameRef.update({
                    board: this.board,
                    currentPlayer: this.currentPlayer === 'black' ? 'white' : 'black',
                    lastMove: this.lastMove,
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (error) {
                console.error('??Failed to send move:', error);
                this.isMovePending = false;
                alert('?��? ?�송?�는 ???�류가 발생?�습?�다. ?�시 ?�도?�주?�요.');
            }
        }
        
        this.renderBoard();
        
        // ?�리 체크 (추후 구현)
        // if (this.checkWin(row, col)) {
        //     this.endGame(this.currentPlayer);
        // }
    }

    resetGame() {
        this.stopTurnTimer();
        this.currentPlayer = 'black';
        this.lastMove = null;
        this.gameStarted = false;
        this.isGameInProgress = false;
        this.isMovePending = false;
        this.initializeBoard();
        this.renderBoard();
        this.showWaitingState();
        this.updateGameStatus();
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('turnTimer');
        if (timerElement) {
            timerElement.textContent = this.currentTurnTime;
        }
    }

    startTurnTimer() {
        this.stopTurnTimer();
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

    async handleTimeOut() {
        if (!this.isOnlineGame) return;
        
        // ?�간 초과 ???��?�??�리
        const winner = this.currentPlayer === 'black' ? 'white' : 'black';
        alert('?�간 초과! ?��?�??�리?�니??');
        
        if (this.gameRef) {
            try {
                await this.gameRef.update({
                    gameEnded: true,
                    winner: winner,
                    isGameInProgress: false,
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (error) {
                console.error('??Failed to update timeout:', error);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new OmokGame();
});
