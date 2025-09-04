const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 메시지 큐 및 게임 상태 저장
const messageQueues = new Map();

// HTTP 서버 생성 (정적 파일 서빙 + API)
const server = http.createServer((req, res) => {
    console.log('요청된 URL:', req.url);
    
    // API 요청 처리
    if (req.url === '/api/messages' && req.method === 'POST') {
        handleApiMessage(req, res);
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

// WebSocket 서버 생성
const wss = new WebSocket.Server({ server });

// 게임 방 및 플레이어 관리
const rooms = new Map();
const players = new Map();

// HTTP API 메시지 처리
function handleApiMessage(req, res) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const response = processApiMessage(data);
            
            res.writeHead(200, { 
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify(response));
        } catch (error) {
            console.error('API 메시지 처리 오류:', error);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '서버 오류' }));
        }
    });
}

function processApiMessage(data) {
    console.log('API 메시지 처리:', data.type);
    
    switch (data.type) {
        case 'create_room':
            return handleApiCreateRoom(data);
        case 'join_room':
            return handleApiJoinRoom(data);
        case 'start_game':
            return handleApiStartGame(data);
        case 'game_move':
            return handleApiGameMove(data);
        case 'get_messages':
            return handleApiGetMessages(data);
        default:
            return { error: '알 수 없는 메시지 타입' };
    }
}

function handleApiCreateRoom(data) {
    const roomCode = generateRoomCode();
    const room = {
        code: roomCode,
        hostId: data.playerId,
        guestId: null,
        hostName: data.hostName,
        guestName: null,
        gameStarted: false,
        gameState: null
    };
    
    rooms.set(roomCode, room);
    messageQueues.set(data.playerId, []);
    
    console.log('API 방 생성:', roomCode, '방장:', data.hostName);
    
    return {
        type: 'room_created',
        roomCode: roomCode,
        hostName: data.hostName
    };
}

function handleApiJoinRoom(data) {
    const room = rooms.get(data.roomCode);
    
    if (!room) {
        return { error: '존재하지 않는 방 코드입니다' };
    }
    
    if (room.guestId) {
        return { error: '이미 가득 찬 방입니다' };
    }
    
    room.guestId = data.playerId;
    room.guestName = data.guestName;
    messageQueues.set(data.playerId, []);
    
    // 방장에게 알림 메시지 추가
    const hostMessages = messageQueues.get(room.hostId) || [];
    hostMessages.push({
        type: 'player_joined',
        guestName: data.guestName
    });
    messageQueues.set(room.hostId, hostMessages);
    
    console.log('API 방 참가:', data.roomCode, '참가자:', data.guestName);
    
    return {
        type: 'room_joined',
        roomCode: data.roomCode,
        hostName: room.hostName,
        guestName: data.guestName
    };
}

function handleApiStartGame(data) {
    const room = rooms.get(data.roomCode);
    
    if (!room || room.hostId !== data.playerId) {
        return { error: '게임을 시작할 권한이 없습니다' };
    }
    
    if (!room.guestId) {
        return { error: '상대방이 접속하지 않았습니다' };
    }
    
    room.gameStarted = true;
    
    // 참가자에게 게임 시작 알림
    const guestMessages = messageQueues.get(room.guestId) || [];
    guestMessages.push({
        type: 'game_start',
        roomCode: data.roomCode
    });
    messageQueues.set(room.guestId, guestMessages);
    
    console.log('API 게임 시작:', data.roomCode);
    
    return {
        type: 'game_start',
        roomCode: data.roomCode
    };
}

function handleApiGameMove(data) {
    const room = rooms.get(data.roomCode);
    
    if (!room || !room.gameStarted) {
        return { error: '게임이 진행중이 아닙니다' };
    }
    
    // 상대방에게 이동 정보 전송
    const opponentId = room.hostId === data.playerId ? room.guestId : room.hostId;
    const opponentMessages = messageQueues.get(opponentId) || [];
    opponentMessages.push({
        type: 'game_move',
        fromRow: data.fromRow,
        fromCol: data.fromCol,
        toRow: data.toRow,
        toCol: data.toCol,
        capturedPiece: data.capturedPiece,
        nextPlayer: data.nextPlayer
    });
    messageQueues.set(opponentId, opponentMessages);
    
    console.log('API 이동 전송:', data.roomCode);
    
    return { success: true };
}

function handleApiGetMessages(data) {
    const messages = messageQueues.get(data.playerId) || [];
    messageQueues.set(data.playerId, []); // 메시지 읽고 나면 초기화
    
    return { messages: messages };
}

// 5자리 랜덤 코드 생성
function generateRoomCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

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
        
        // 방 정리
        if (room.host === ws || room.guest === ws) {
            rooms.delete(player.room);
            console.log('방 삭제됨:', player.room);
        }
    }
    
    players.delete(ws);
    console.log('플레이어 연결 해제됨:', player.name);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`체스 게임 서버가 포트 ${PORT}에서 실행중입니다`);
    console.log(`http://localhost:${PORT} 에서 게임을 시작하세요`);
});

