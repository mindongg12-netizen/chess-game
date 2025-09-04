#!/bin/bash

echo "🚀 체스 게임 배포 스크립트"
echo "=========================="

# Heroku 배포
echo "1. Heroku 배포를 선택하셨습니다"
echo "Heroku CLI가 설치되어 있는지 확인하세요"
echo ""

# Git 초기화 (필요한 경우)
if [ ! -d ".git" ]; then
    echo "Git 저장소 초기화 중..."
    git init
    git add .
    git commit -m "Initial commit: Chess game ready for deployment"
fi

# Heroku 앱 생성 (사용자 입력 받기)
echo "Heroku 앱 이름을 입력하세요 (예: my-chess-game-2024):"
read APP_NAME

if [ ! -z "$APP_NAME" ]; then
    echo "Heroku 앱 생성 중: $APP_NAME"
    heroku create $APP_NAME
    
    echo "환경 변수 설정 중..."
    heroku config:set NODE_ENV=production --app $APP_NAME
    
    echo "배포 중..."
    git push heroku main
    
    echo "✅ 배포 완료!"
    echo "🌐 게임 URL: https://$APP_NAME.herokuapp.com"
    echo ""
    echo "앱 열기..."
    heroku open --app $APP_NAME
else
    echo "❌ 앱 이름이 입력되지 않았습니다"
    echo "수동으로 배포하려면 다음 명령어를 실행하세요:"
    echo ""
    echo "heroku create your-app-name"
    echo "heroku config:set NODE_ENV=production"
    echo "git push heroku main"
    echo "heroku open"
fi

echo ""
echo "🎉 배포가 완료되면 친구들과 함께 체스를 즐기세요!"
echo "방 코드를 공유하여 온라인 대전을 시작하세요!"

