#!/bin/bash

# Better Scanner Quick Start Script
# This script sets up and runs both the backend and frontend

set -e

echo "🚀 Better Scanner - Quick Start"
echo "==============================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"
echo "✓ Node.js found: $(node --version)"
echo ""

# Setup backend
echo "📦 Setting up Backend..."
cd backend

if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate

echo "Installing backend dependencies..."
pip install -q -r requirements.txt

if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit backend/.env with your configuration!"
    echo "   - Set IMMICH_API_KEY if you have an Immich server"
    echo "   - Update TARGET_DIR if needed"
fi

cd ..

# Setup frontend
echo ""
echo "📦 Setting up Frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install --silent
fi

if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Ready to start development!"
echo ""
echo "To run the application:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend"
echo "    source .venv/bin/activate"
echo "    python main.py"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend"
echo "    npm start"
echo ""
echo "Then open http://localhost:3000 in your browser"
echo ""
