#!/bin/bash

# Пластовий Співаник - Скрипт запуску
echo "🎵 Пластовий Співаник - Запуск додатку"
echo "======================================"

# Перевірка наявності Docker (для Rancher)
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не знайдено. Для роботи з Rancher потрібен Docker"
    echo "   Завантажити можна з: https://www.docker.com/"
    exit 1
fi

echo "✅ Docker знайдено: $(docker --version)"

# Перевірка наявності Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не знайдено. Будь ласка, встановіть Node.js (версія 16+)"
    echo "   Завантажити можна з: https://nodejs.org/"
    exit 1
fi

# Перевірка версії Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Потрібна версія Node.js 16 або вище. Поточна версія: $(node -v)"
    exit 1
fi

echo "✅ Node.js знайдено: $(node -v)"

# Перевірка наявності npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не знайдено"
    exit 1
fi

echo "✅ npm знайдено: $(npm -v)"

# Перевірка наявності package.json
if [ ! -f "package.json" ]; then
    echo "❌ package.json не знайдено. Переконайтеся, що ви в правильній директорії"
    exit 1
fi

# Запуск MongoDB в Docker (Rancher Desktop)
echo "🗄️  Запуск MongoDB в Docker..."
MONGO_CONTAINER_NAME="plast-songbook-mongo"

# Перевірка чи контейнер вже запущений
if docker ps | grep -q $MONGO_CONTAINER_NAME; then
    echo "✅ MongoDB контейнер вже запущений"
else
    # Зупинка старого контейнера якщо існує
    if docker ps -a | grep -q $MONGO_CONTAINER_NAME; then
        echo "� Зупинка старого MongoDB контейнера..."
        docker stop $MONGO_CONTAINER_NAME
        docker rm $MONGO_CONTAINER_NAME
    fi
    
    # Запуск нового контейнера
    echo "🚀 Запуск нового MongoDB контейнера..."
    docker run -d \
        --name $MONGO_CONTAINER_NAME \
        -p 27017:27017 \
        -v plast-songbook-data:/data/db \
        mongo:7.0
    
    if [ $? -eq 0 ]; then
        echo "✅ MongoDB контейнер запущено успішно"
        echo "⏳ Очікування готовності MongoDB..."
        sleep 5
    else
        echo "❌ Помилка запуску MongoDB контейнера"
        exit 1
    fi
fi

# Перевірка підключення до MongoDB
echo "🔍 Перевірка підключення до MongoDB..."
for i in {1..10}; do
    if docker exec $MONGO_CONTAINER_NAME mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
        echo "✅ MongoDB готовий до роботи"
        break
    else
        echo "⏳ Очікування MongoDB... ($i/10)"
        sleep 2
    fi
    
    if [ $i -eq 10 ]; then
        echo "❌ MongoDB не відповідає після 20 секунд"
        exit 1
    fi
done

# Перевірка наявності node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Встановлення залежностей frontend..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Помилка встановлення залежностей frontend"
        exit 1
    fi
    echo "✅ Залежності frontend встановлено"
else
    echo "✅ Залежності frontend вже встановлено"
fi

# Перевірка наявності backend залежностей
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Встановлення залежностей backend..."
    cd backend && npm install && cd ..
    if [ $? -ne 0 ]; then
        echo "❌ Помилка встановлення залежностей backend"
        exit 1
    fi
    echo "✅ Залежності backend встановлено"
else
    echo "✅ Залежності backend вже встановлено"
fi

# Перевірка наявності .env файлу
if [ ! -f ".env" ]; then
    echo "⚙️  Створення .env файлу..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env файл створено з .env.example"
        echo "💡 Ви можете відредагувати .env файл для налаштування API URL"
    else
        echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
        echo "✅ .env файл створено з базовими налаштуваннями"
    fi
else
    echo "✅ .env файл знайдено"
fi

# Перевірка наявності backend/.env файлу
if [ ! -f "backend/.env" ]; then
    echo "⚙️  Створення backend/.env файлу..."
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo "✅ Backend .env файл створено з .env.example"
    else
        cat > backend/.env << EOF
PORT=5000
MONGODB_URI=mongodb://localhost:27017/plast-songbook
JWT_SECRET=plast-songbook-super-secret-jwt-key-2024
NODE_ENV=development
EOF
        echo "✅ Backend .env файл створено з базовими налаштуваннями"
    fi
else
    echo "✅ Backend .env файл знайдено"
fi

echo ""
echo "🚀 Запуск повного стеку додатку..."
echo "   Frontend: http://localhost:3001"
echo "   Backend API: http://localhost:5001/api"
echo "   MongoDB: localhost:27017"
echo "   Для зупинки натисніть Ctrl+C"
echo ""

# Запуск повного стеку
npm run full-dev