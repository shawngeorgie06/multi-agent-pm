# Multi-Agent Project Manager - START HERE 👋

Welcome! This document guides you to getting the system up and running quickly.

## 📖 What is This?

A sophisticated AI-powered system where two AI agents (Project Manager and Engineer) collaborate in real-time to break down software projects into tasks, identify risks, and create actionable plans.

**Key Features**:
- ✨ Real-time agent communication
- 📋 Automatic task breakdown
- 🚨 Risk and blocker detection
- 💾 Persistent storage
- 🖥️ Modern, polished UI
- 🤖 Local LLM (Ollama)

## ⚡ Quick Start (5 minutes)

### Prerequisites

You need:
1. **Node.js 18+** - https://nodejs.org/
2. **Docker Desktop** - https://www.docker.com/products/docker-desktop
3. **Ollama** - https://ollama.ai
   - After install: `ollama pull mistral`

### Setup

**Option A: Automated (Recommended)**

```bash
cd multi-agent-pm
bash QUICK_START.sh
```

Then follow the instructions at the end.

**Option B: Manual**

```bash
# 1. Start PostgreSQL
docker-compose up -d

# 2. Backend (Terminal 1)
cd backend
npm install
npm run prisma:generate
npm run db:push
npm run dev

# 3. Frontend (Terminal 2)
cd frontend
npm install
npm run dev

# 4. Start Ollama (Terminal 3)
ollama serve

# 5. Open browser
# Go to http://localhost:5173
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **README.md** | Overview and features |
| **SETUP_GUIDE.md** | Detailed setup instructions |
| **QUICK_START.sh** | Automated setup script |
| **IMPLEMENTATION_SUMMARY.md** | What was built (technical) |

**→ Start with SETUP_GUIDE.md for step-by-step instructions**

## 🧪 Test It

### Test 1: CLI (Fast, no database needed)

```bash
cd backend
npm run test:cli "Build a React todo app"
```

### Test 2: Full System

1. Open http://localhost:5173
2. Enter: "Build a password reset feature"
3. Click "Start Project"
4. Watch agents collaborate

## 🎯 What Happens

```
You: "Build a password reset feature"
      ↓
PM Agent: Breaks into 5 tasks
      ↓
Engineer Agent: Reviews, asks questions
      ↓
PM Agent: Answers questions
      ↓
Engineer Agent: Confirms understanding
      ↓
Tasks saved to database & displayed
```

All in real-time! 🎉

## 🛠️ Architecture Overview

```
┌────────────────────────────────┐
│  React Frontend (Port 5173)    │
│  - Messages, Tasks, Input      │
└─────────────┬──────────────────┘
              │ WebSocket
┌─────────────▼──────────────────┐
│  Express Backend (Port 3001)   │
│  - APIs, Agents, DB            │
└─────────────┬──────────────────┘
              │ Prisma ORM
┌─────────────▼──────────────────┐
│  PostgreSQL (Docker)           │
│  - Projects, Messages, Tasks   │
└────────────────────────────────┘
              ↓
         Ollama (Local LLM)
```

## 🚀 Project Structure

```
multi-agent-pm/
├── backend/          # Express + Node.js server
│   ├── src/agents/   # PM and Engineer AI agents
│   ├── src/services/ # Ollama, message parsing
│   └── prisma/       # Database schema
├── frontend/         # React + TypeScript UI
│   ├── src/components/
│   ├── src/store/
│   └── src/hooks/
├── docker-compose.yml # PostgreSQL container
├── SETUP_GUIDE.md    # Detailed setup
└── README.md         # Full documentation
```

## 💡 Example Workflows

### Workflow 1: Simple Feature

Input: "Add a dark mode toggle"

Tasks:
- Create theme context
- Add CSS variables
- Create toggle component
- Implement persistence

### Workflow 2: Complex System

Input: "Build user authentication with OAuth2"

Tasks:
- Database schema for users
- OAuth2 provider integration
- JWT token generation
- Login/logout flows
- Session management
- Error handling

### Workflow 3: Bug Fix

Input: "Fix slow database queries on reports page"

Tasks:
- Profile queries
- Add database indexes
- Implement caching
- Optimize API response
- Test performance

## ⚙️ Configuration

**Backend (.env)**:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/multiagent_pm"
OLLAMA_API_URL="http://localhost:11434"
OLLAMA_MODEL="mistral"
PORT=3001
```

**Frontend (.env)**:
```env
VITE_API_URL="http://localhost:3001"
VITE_WS_URL="ws://localhost:3001"
```

These are already set up for you!

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Start Ollama: `ollama serve` |
| "Port already in use" | Change PORT in .env or kill process |
| "Database connection error" | Start Docker: `docker-compose up -d` |
| "Model not found" | Pull model: `ollama pull mistral` |
| "Frontend won't connect" | Check backend running at :3001 |

See SETUP_GUIDE.md for more troubleshooting.

## 📖 Learn More

- **Full Setup**: See SETUP_GUIDE.md
- **What Was Built**: See IMPLEMENTATION_SUMMARY.md
- **Features & API**: See README.md

## 🎯 Common Next Steps

1. **Test It Out**
   ```bash
   cd backend
   npm run test:cli "Your project idea here"
   ```

2. **Try the Full System**
   - Open http://localhost:5173
   - Enter a project description
   - Watch agents collaborate

3. **Explore the Code**
   - Backend agents: `backend/src/agents/`
   - Frontend components: `frontend/src/components/`
   - Database schema: `backend/prisma/schema.prisma`

4. **Customize**
   - Edit agent prompts in agent files
   - Adjust theme in `frontend/tailwind.config.js`
   - Add fields to database schema

5. **Deploy** (Later)
   - Switch to cloud LLM (OpenAI/Claude)
   - Deploy backend to Railway/Render
   - Deploy frontend to Vercel

## 🚀 Ready?

### For Beginners
1. Read this file (you are here!)
2. Follow SETUP_GUIDE.md step by step
3. Test with CLI tool
4. Try the frontend

### For Experienced Developers
1. Check IMPLEMENTATION_SUMMARY.md for architecture
2. Run automated setup: `bash QUICK_START.sh`
3. Review the code
4. Start customizing

## 📊 System Requirements

| Component | Requirement |
|-----------|-------------|
| Node.js | 18+ |
| RAM | 8GB+ |
| Docker | Latest |
| Ollama | Latest |
| Model Size | 4GB (mistral) |

## 🎓 Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, TypeScript, Tailwind CSS
- **Database**: PostgreSQL
- **LLM**: Ollama (local)
- **Real-time**: Socket.IO
- **ORM**: Prisma

## 📞 Need Help?

1. **Setup Issues**: See SETUP_GUIDE.md troubleshooting
2. **Code Questions**: Read inline comments in source files
3. **Architecture**: See IMPLEMENTATION_SUMMARY.md
4. **Features**: See README.md

## ✅ Verification

Once running, verify:
- [ ] Backend at http://localhost:3001/health returns "ok"
- [ ] Frontend at http://localhost:5173 loads
- [ ] Ollama running: `curl http://localhost:11434/api/tags`
- [ ] PostgreSQL running: `docker-compose ps` shows "healthy"

## 🎉 That's It!

You're all set. Choose your path:

→ **Next**: Follow SETUP_GUIDE.md for step-by-step instructions

→ **Hurry**: Run `bash QUICK_START.sh` for automated setup

→ **Explore**: Check IMPLEMENTATION_SUMMARY.md for technical details

**Happy building! 🚀**
