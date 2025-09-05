// Firebase 설정 파일
// 여기에 Firebase 프로젝트 설정을 넣어주세요

const firebaseConfig = {
    // 복사하신 Firebase SDK 설정을 여기에 붙여넣어주세요
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

console.log('🔥 Firebase 초기화 완료');
