const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 단순 메시지 전달 시스템 (상태 저장 안함)
const activeMessages = new Map(); // roomCode -> recent messages

// HTTP 서버 생성 (정적 파일 서빙 + API)
const server = http.createServer((req, res) => {
    console.log('요청된 URL:', req.url, req.method);
    
    // CORS 헤더 추가
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API 엔드포인트 처리
    if (req.url.startsWith('/api/')) {
        handleApiRequest(req, res);
        return;
    }
    
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    let extname = path.extname(filePath);
    let contentType = 'text/html; charset=utf-8';
    
    console.log('파일 경로:', filePath);

    switch (extname) {
        case '.js':
            contentType = 'text/javascript; charset=utf-8';
            break;
        case '.css':
            contentType = 'text/css; charset=utf-8';
            break;
        case '.html':
            contentType = 'text/html; charset=utf-8';
            break;
    }

    // 파일 존재 여부 먼저 확인
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log('파일 없음:', filePath);
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('파일을 찾을 수 없습니다: ' + req.url, 'utf-8');
            return;
        }
        
        // 파일이 존재하면 읽기
        fs.readFile(filePath, 'utf8', (err, content) => {
            if (err) {
                console.log('파일 읽기 오류:', err);
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('서버 오류: ' + err.code, 'utf-8');
        } else {
                console.log('파일 전송 성공:', filePath);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});
});

// API 요청 처리 함수
function handleApiRequest(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            const url = req.url;
            const method = req.method;
            
            console.log('🌐 API 요청:', method, url);
            
            if (method === 'POST' && url === '/api/send') {
                // 단순히 메시지를 받아서 해당 방에 저장
                const data = JSON.parse(body);
                handleSimpleMessage(data);
                sendJsonResponse(res, { success: true });
            } else if (method === 'GET' && url.startsWith('/api/get/')) {
                // 방 코드로 메시지 조회
                const roomCode = url.split('/').pop();
                const response = getSimpleMessages(roomCode);
                sendJsonResponse(res, response);
            } else {
                sendJsonResponse(res, { success: true });
            }
        } catch (error) {
            console.error('API 처리 오류:', error);
            sendJsonResponse(res, { error: '서버 오류' }, 500);
        }
    });
}

function sendJsonResponse(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

function handleSimpleMessage(data) {
    console.log('📨 메시지 수신:', data.type, '방:', data.roomCode);
    
    if (!data.roomCode) return;
    
    // 해당 방의 메시지 목록에 추가
    if (!activeMessages.has(data.roomCode)) {
        activeMessages.set(data.roomCode, []);
    }
    
    const messages = activeMessages.get(data.roomCode);
    messages.push({
        ...data,
        timestamp: Date.now()
    });
    
    // 최근 10개 메시지만 유지
    if (messages.length > 10) {
        messages.shift();
    }
    
    console.log('✅ 메시지 저장 완료');
}

function getSimpleMessages(roomCode) {
    const messages = activeMessages.get(roomCode) || [];
    // 메시지 조회 후 삭제 (한 번만 읽기)
    activeMessages.delete(roomCode);
    
    console.log('📬 메시지 조회:', roomCode, '개수:', messages.length);
    return { messages: messages };
}

// WebSocket 서버 생성 (기존 코드 유지 - 로컬 개발용)
const wss = new WebSocket.Server({ server });

// 게임 방 및 플레이어 관리
const rooms = new Map();
const players = new Map();

// 5자리 랜덤 코드 생성
function generateRoomCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

// 주기적으로 오래된 메시지 정리 (10분마다)
setInterval(() => {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10분
    
    for (const [roomCode, messages] of activeMessages.entries()) {
        // 오래된 메시지 필터링
        const recentMessages = messages.filter(msg => now - msg.timestamp < maxAge);
        if (recentMessages.length === 0) {
            activeMessages.delete(roomCode);
        } else {
            activeMessages.set(roomCode, recentMessages);
        }
    }
    
    console.log('📊 현재 활성 방 개수:', activeMessages.size);
}, 10 * 60 * 1000); // 10분마다 실행

// WebSocket 연결 처리
wss.on('connection', (ws) => {
    console.log('새로운 플레이어 연결됨');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('메시지 파싱 오류:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: '잘못된 메시지 형식입니다'
            }));
        }
    });
    
    ws.on('close', () => {
        handlePlayerDisconnect(ws);
    });
});

function handleMessage(ws, data) {
    switch (data.type) {
        case 'player_connect':
            handlePlayerConnect(ws, data);
            break;
        case 'create_room':
            handleCreateRoom(ws, data);
            break;
        case 'join_room':
            handleJoinRoom(ws, data);
            break;
        case 'start_game':
            handleStartGame(ws, data);
            break;
        case 'game_move':
            handleGameMove(ws, data);
            break;
        case 'timer_sync':
            handleTimerSync(ws, data);
            break;
        default:
            ws.send(JSON.stringify({
                type: 'error',
                message: '알 수 없는 메시지 타입입니다'
            }));
    }
}

function handlePlayerConnect(ws, data) {
    players.set(ws, {
        id: data.playerId,
        name: null,
        room: null
    });
    console.log('플레이어 등록됨:', data.playerId);
}

function handleCreateRoom(ws, data) {
    const roomCode = generateRoomCode();
    const room = {
        code: roomCode,
        host: ws,
        guest: null,
        hostName: data.hostName,
        guestName: null,
        gameStarted: false,
        gameState: null
    };
    
    rooms.set(roomCode, room);
    
    const player = players.get(ws);
    if (player) {
        player.name = data.hostName;
        player.room = roomCode;
    }
    
    ws.send(JSON.stringify({
        type: 'room_created',
        roomCode: roomCode,
        hostName: data.hostName
    }));
    
    console.log('방 생성됨:', roomCode, '방장:', data.hostName);
}

function handleJoinRoom(ws, data) {
    const room = rooms.get(data.roomCode);
    
    if (!room) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '존재하지 않는 방 코드입니다'
        }));
        return;
    }
    
    if (room.guest) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '이미 가득 찬 방입니다'
        }));
        return;
    }
    
    room.guest = ws;
    room.guestName = data.guestName;
    
    const player = players.get(ws);
    if (player) {
        player.name = data.guestName;
        player.room = data.roomCode;
    }
    
    // 참가자에게 응답
    ws.send(JSON.stringify({
        type: 'room_joined',
        roomCode: data.roomCode,
        hostName: room.hostName,
        guestName: data.guestName
    }));
    
    // 방장에게 알림
    if (room.host) {
        room.host.send(JSON.stringify({
            type: 'player_joined',
            guestName: data.guestName
        }));
    }
    
    console.log('방 참가:', data.roomCode, '참가자:', data.guestName);
}

function handleStartGame(ws, data) {
    const room = rooms.get(data.roomCode);
    
    if (!room || room.host !== ws) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '게임을 시작할 권한이 없습니다'
        }));
        return;
    }
    
    if (!room.guest) {
        ws.send(JSON.stringify({
            type: 'error',
            message: '상대방이 접속하지 않았습니다'
        }));
        return;
    }
    
    room.gameStarted = true;
    
    // 방장과 참가자 모두에게 게임 시작 알림
    const startMessage = JSON.stringify({
        type: 'game_start',
        roomCode: data.roomCode
    });
    
    room.host.send(startMessage);
    room.guest.send(startMessage);
    
    console.log('게임 시작:', data.roomCode);
}

function handleGameMove(ws, data) {
    const room = rooms.get(data.roomCode);
    
    if (!room || !room.gameStarted) {
        return;
    }
    
    // 상대방에게 이동 정보 전송
    const opponent = room.host === ws ? room.guest : room.host;
    if (opponent) {
        opponent.send(JSON.stringify({
            type: 'game_move',
            fromRow: data.fromRow,
            fromCol: data.fromCol,
            toRow: data.toRow,
            toCol: data.toCol,
            capturedPiece: data.capturedPiece,
            nextPlayer: data.nextPlayer
        }));
    }
    
    console.log('이동 전송:', data.roomCode, `(${data.fromRow},${data.fromCol}) -> (${data.toRow},${data.toCol})`);
}

function handleTimerSync(ws, data) {
    const room = rooms.get(data.roomCode);
    
    if (!room || !room.gameStarted) {
        return;
    }
    
    // 상대방에게 타이머 동기화
    const opponent = room.host === ws ? room.guest : room.host;
    if (opponent) {
        opponent.send(JSON.stringify({
            type: 'timer_sync',
            timeLeft: data.timeLeft
        }));
    }
}

function handlePlayerDisconnect(ws) {
    const player = players.get(ws);
    if (!player || !player.room) {
        players.delete(ws);
        return;
    }
    
    const room = rooms.get(player.room);
    if (room) {
        // 상대방에게 연결 끊김 알림
        const opponent = room.host === ws ? room.guest : room.host;
        if (opponent) {
            opponent.send(JSON.stringify({
                type: 'player_disconnected',
                message: '상대방의 연결이 끊어졌습니다'
            }));
        }
        
        // ⚠️ HTTP API 모드에서는 방을 삭제하지 않음 (WebSocket 연결 끊김과 무관)
        console.log('⚠️ WebSocket 연결 해제되었지만 HTTP API 모드에서는 방 유지:', player.room);
        // rooms.delete(player.room); // 주석 처리
    }
    
    players.delete(ws);
    console.log('플레이어 연결 해제됨:', player.name);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`체스 게임 서버가 포트 ${PORT}에서 실행중입니다`);
    console.log(`http://localhost:${PORT} 에서 게임을 시작하세요`);
});

