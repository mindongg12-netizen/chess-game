// Firebase 설정 파일
// 여기에 Firebase 프로젝트 설정을 넣어주세요

const firebaseConfig = {
    // 복사하신 Firebase SDK 설정을 여기에 붙여넣어주세요
    apiKey: "AIzaSyAFoux_5Q28hCNiSRvhTKMOYM4iBr6nSiM",
    authDomain: "online-chess-g.firebaseapp.com",
    projectId: "online-chess-g",
    storageBucket: "online-chess-g.firebasestorage.app",
    messagingSenderId: "410964337544",
    appId: "1:410964337544:web:6e1eac7efb9b620d0ad03d",
    databaseURL:"https://online-chess-g-default-rtdb.asia-southeast1.firebasedatabase.app/"
  };

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
window.database = firebase.database();
window.firebaseReady = true;

console.log('🔥 Firebase 초기화 완료');

// Firebase 준비 완료 이벤트 발생
document.dispatchEvent(new Event('firebaseReady'));
