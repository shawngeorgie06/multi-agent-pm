#!/bin/bash

# Multi-Agent Project Manager - Quick Start Script
# This script automates the setup process

set -e  # Exit on error

echo "🚀 Multi-Agent Project Manager - Setup Script"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking Prerequisites${NC}"
echo "================================"

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Please install Docker${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker $(docker --version)${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found. Please install Docker Compose${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose $(docker-compose --version)${NC}"

echo ""

# Step 2: Check Ollama
echo -e "${BLUE}Step 2: Checking Ollama${NC}"
echo "======================="

if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠ Ollama not found. Please download from https://ollama.ai${NC}"
    echo -e "${YELLOW}  After installation, run: ollama pull mistral${NC}"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ Ollama found${NC}"
    if ! pgrep -x "ollama" > /dev/null; then
        echo -e "${YELLOW}⚠ Ollama service not running. Start it with: ollama serve${NC}"
    else
        echo -e "${GREEN}✓ Ollama service running${NC}"
    fi
fi

echo ""

# Step 3: Start PostgreSQL
echo -e "${BLUE}Step 3: Starting PostgreSQL${NC}"
echo "==========================="

docker-compose up -d
echo -e "${GREEN}✓ PostgreSQL started${NC}"

sleep 2

echo ""

# Step 4: Setup Backend
echo -e "${BLUE}Step 4: Setting up Backend${NC}"
echo "=========================="

cd backend

if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install --silent
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

npm run prisma:generate --silent > /dev/null 2>&1
echo -e "${GREEN}✓ Prisma generated${NC}"

npm run db:push --silent > /dev/null 2>&1
echo -e "${GREEN}✓ Database schema created${NC}"

cd ..
echo ""

# Step 5: Setup Frontend
echo -e "${BLUE}Step 5: Setting up Frontend${NC}"
echo "=========================="

cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install --silent
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

cd ..
echo ""

# Summary
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "=============================================="
echo "📖 Next Steps:"
echo "=============================================="
echo ""
echo "1. Start Ollama (if not already running):"
echo "   $ ollama serve"
echo ""
echo "2. In a new terminal, start the backend:"
echo "   $ cd backend"
echo "   $ npm run dev"
echo ""
echo "3. In another terminal, start the frontend:"
echo "   $ cd frontend"
echo "   $ npm run dev"
echo ""
echo "4. Open http://localhost:5173 in your browser"
echo ""
echo "=============================================="
echo "💡 Test the system (optional):"
echo "=============================================="
echo ""
echo "Test CLI (no database needed):"
echo "  $ cd backend"
echo "  $ npm run test:cli 'Build a React todo app'"
echo ""
echo "=============================================="
echo ""
