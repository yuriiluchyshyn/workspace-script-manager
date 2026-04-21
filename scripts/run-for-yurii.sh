#!/bin/zsh

# ⚠️ ЗМІНЕНО НА ZSH (краще для macOS)
# Define the project root path based on your request
PROJECT_ROOT="/Volumes/Work/projects/ccsi-ptg/phoenix/utils/web-portal-dev-harness"

# Stop script on error
set -e

echo "🚀 Starting Phoenix Project Environment..."

# Load environment variables from .env file
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "📝 Loading environment variables from .env file..."
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
    echo "✅ Environment variables loaded"
else
    echo "⚠️  No .env file found at $PROJECT_ROOT/.env"
    echo "   Create one from .env.example if you need custom environment variables"
fi

# Check if Rancher Desktop is running and start it if needed
check_rancher_desktop() {
    echo "🐳 Checking Rancher Desktop status..."
    
    # Check if Rancher Desktop process is running
    if pgrep -f "Rancher Desktop" > /dev/null; then
        echo "✅ Rancher Desktop is already running"
        return 0
    fi
    
    # Check if Docker daemon is accessible
    if docker info > /dev/null 2>&1; then
        echo "✅ Docker daemon is accessible"
        return 0
    fi
    
    echo "⚠️  Rancher Desktop is not running. Starting it now..."
    
    if [ -d "/Applications/Rancher Desktop.app" ]; then
        open "/Applications/Rancher Desktop.app"
        echo "🔄 Waiting for Rancher Desktop to start..."
        
        local count=0
        while [ $count -lt 60 ]; do
            if docker info > /dev/null 2>&1; then
                echo "✅ Rancher Desktop started successfully"
                return 0
            fi
            sleep 2
            count=$((count + 2))
            echo "   Waiting... ($count/60 seconds)"
        done
        
        echo "❌ Rancher Desktop failed to start within 60 seconds"
        exit 1
    else
        echo "❌ Rancher Desktop not found in /Applications/"
        exit 1
    fi
}

# Kill processes on specific ports
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        echo "🔪 Killing process on port $port (PID: $pid)..."
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

check_rancher_desktop

echo "🔍 Checking for processes on MFE ports..."
# ... (Тут ваш список портів залишається без змін)
kill_port 6006
kill_port 5173
kill_port 3401
kill_port 3402
kill_port 3403
kill_port 3404
kill_port 3405
kill_port 3406
kill_port 3407
kill_port 3408
kill_port 3409
kill_port 3410
kill_port 3411
kill_port 3412
kill_port 3413
kill_port 3414
kill_port 3415
kill_port 3416
kill_port 3417
kill_port 3418
kill_port 3419
kill_port 3420
kill_port 3421
kill_port 3422
kill_port 3423
kill_port 3424
kill_port 3425
kill_port 3426

# ==========================================
# 🔧 ВИПРАВЛЕНА СЕКЦІЯ NVM
# ==========================================
export NVM_DIR="$HOME/.nvm"
# Завантажуємо NVM (спробуємо обидва варіанти шляхів для надійності)
if [ -s "$NVM_DIR/nvm.sh" ]; then
    . "$NVM_DIR/nvm.sh"
elif [ -s "/usr/local/opt/nvm/nvm.sh" ]; then
    . "/usr/local/opt/nvm/nvm.sh"
fi

# Перевіряємо чи завантажився NVM
if command -v nvm >/dev/null; then
    echo "📦 NVM loaded."
    
    # 1. Спробуємо просто використати версію (якщо вона вже є)
    if nvm use 24.12.0; then
        echo "✅ Node version switched to 24.12.0"
    else
        # 2. Якщо її немає - пробуємо встановити
        echo "⚠️  Version not active. Attempting to install..."
        nvm install 24.12.0
        nvm use 24.12.0
    fi
else
    echo "⚠️  NVM command not found via script source."
    echo "   Trying to continue with current system Node: $(node -v)"
fi
# ==========================================

# Function to check if package files have differences
check_package_differences() {
    local repo_dir=$1
    local package_json="$repo_dir/package.json"
    local package_lock="$repo_dir/package-lock.json"
    
    # If package-lock.json doesn't exist, we need to install
    if [ ! -f "$package_lock" ]; then
        return 0  # true - needs install
    fi
    
    # Check if package.json is newer than package-lock.json
    if [ "$package_json" -nt "$package_lock" ]; then
        return 0  # true - needs install
    fi
    
    # Check if node_modules exists and is populated
    if [ ! -d "$repo_dir/node_modules" ] || [ -z "$(ls -A "$repo_dir/node_modules" 2>/dev/null)" ]; then
        return 0  # true - needs install
    fi
    
    return 1  # false - no install needed
}

# Install dependencies for repos where package files differ
echo "📥 Checking for package file differences and installing dependencies where needed..."
PHOENIX_ROOT="$PROJECT_ROOT/../.."
REPOS_JSON="$PROJECT_ROOT/data/repos.json"

if [ -f "$REPOS_JSON" ]; then
    # Extract target+name pairs from repos.json using node (already available at this point)
    node -e "
        const data = JSON.parse(require('fs').readFileSync('$REPOS_JSON', 'utf-8'));
        const repos = data.repos || [];
        for (const r of repos) {
            if (r.target && r.name) {
                console.log(r.target + '/' + r.name);
            }
        }
    " | while read repo_rel_path; do
        REPO_DIR="$PHOENIX_ROOT/$repo_rel_path"
        if [ -d "$REPO_DIR" ] && [ -f "$REPO_DIR/package.json" ]; then
            if check_package_differences "$REPO_DIR"; then
                echo "  📦 npm install -> $repo_rel_path (package files differ or node_modules missing)"
                npm install --prefix "$REPO_DIR" 2>&1 | tail -1 || echo "  ⚠️  warning: npm install failed for $repo_rel_path"
            else
                echo "  ✅ skipping -> $repo_rel_path (no changes detected)"
            fi
        fi
    done
    echo "✅ Dependency installation complete"
else
    echo "⚠️  repos.json not found at $REPOS_JSON, skipping bulk install"
fi

# Build packages that require a build step before MFEs can use them
echo "🔨 Building packages that MFEs depend on..."

COVER_PAGE_DIR="$PHOENIX_ROOT/packages/public/web-cover-page-templates"
if [ -d "$COVER_PAGE_DIR" ]; then
    echo "  building web-cover-page-templates..."
    npm run build --prefix "$COVER_PAGE_DIR" 2>&1 | tail -1 || echo "  warning: build failed for web-cover-page-templates"
fi

PAYMENT_STRIPE_DIR="$PHOENIX_ROOT/packages/public/web-payment-stripe"
if [ -d "$PAYMENT_STRIPE_DIR" ]; then
    echo "  building web-payment-stripe..."
    npm run build --prefix "$PAYMENT_STRIPE_DIR" 2>&1 | tail -1 || echo "  warning: build failed for web-payment-stripe"
fi

echo "✅ Package builds complete"

# Note: Repository cloning is handled by setup.cjs below

# 4. npm install
echo "📥 Installing dependencies in scripts directory..."
cd "$PROJECT_ROOT/scripts"
npm install

# 4. Run setup.cjs
echo "⚙️  Running setup script..."
node setup.cjs

# 5. Run serve-dev.cjs
echo "🌐 Starting MFEs (serve-dev)..."
node serve-dev.cjs &
SERVE_PID=$!

sleep 5

# 6. Check Docker Compose
echo "🐳 Checking Docker Compose status..."
cd "$PROJECT_ROOT"

if docker-compose ps 2>/dev/null | grep -q "Up"; then
    echo "✅ Docker Compose is already running"
else
    echo "⚠️  Docker Compose is not running. Starting it now with up-dev.cjs..."
    node up-dev.cjs
fi

cleanup() {
    echo ""
    echo "Shutting down MFEs (PID: $SERVE_PID)..."
    kill $SERVE_PID 2>/dev/null || true
    echo "Shutdown complete."
}

trap cleanup EXIT INT TERM

echo "Detecting Internal IP Address..."
INTERNAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "Unknown")

echo "========================================================"
echo "Service View IP Address: $INTERNAL_IP"
echo "========================================================"

echo "Opening browser tabs..."
sleep 3
open "http://localhost:6006"
open "http://localhost:3301"

wait $SERVE_PID