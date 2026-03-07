# Multi-Agent Project Manager - Setup Guide

This guide walks you through setting up and running the complete Multi-Agent Project Manager system locally.

## 📋 Prerequisites

Before starting, make sure you have:

1. **Node.js 18+** - [Download](https://nodejs.org/)
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop)
   ```bash
   docker --version
   docker-compose --version
   ```

3. **Ollama** - [Download](https://ollama.ai)
   - After installation, start Ollama and pull a model:
   ```bash
   ollama pull mistral
   ```

## 🚀 Quick Start (5 minutes)

### Step 1: Start Ollama

Open a terminal and start Ollama:

```bash
ollama serve
```

In another terminal, verify the model is available:

```bash
ollama list
```

You should see `mistral` in the list. If not:

```bash
ollama pull mistral
```

### Step 2: Start PostgreSQL

From the project root:

```bash
docker-compose up -d
```

Verify it's running:

```bash
docker-compose ps
```

You should see a healthy `multiagent_pm_db` container.

### Step 3: Set Up Backend

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Create database schema
npm run db:push

# Start backend server
npm run dev
```

The backend runs on `http://localhost:3001`

You should see:
```
============================================================
Multi-Agent PM Backend Server
Running on http://localhost:3001
Ollama API: http://localhost:11434
Ollama Model: mistral
============================================================
```

### Step 4: Set Up Frontend (New Terminal)

```bash
cd frontend

# Install dependencies
npm install

# Start frontend dev server
npm run dev
```

The frontend runs on `http://localhost:5173`

You should see:
```
  ➜  Local:   http://localhost:5173/
```

### Step 5: Open in Browser

Open http://localhost:5173 in your browser. You should see the Multi-Agent PM dashboard.

## ✅ Verify Everything Works

### Test the Agents (Optional - No Frontend Needed)

Test backend communication without the database or frontend:

```bash
cd backend
npm run test:cli "Build a simple React todo app"
```

This will:
- Test connection to Ollama
- Run PM and Engineer agents
- Extract and display tasks
- Show conversation summary

### Test via Frontend

1. Open http://localhost:5173
2. Enter a project description, e.g.: "Build a password reset feature"
3. Click "Start Project"
4. Watch the agents communicate in real-time
5. See tasks populate in the task board

## 🗂 Project Structure

```
multi-agent-pm/
├── backend/                    # Express + TypeScript backend
│   ├── src/
│   │   ├── agents/            # PM and Engineer agents
│   │   ├── services/          # Ollama, message parsing
│   │   ├── database/          # Prisma DB setup
│   │   ├── websocket/         # Socket.IO handlers
│   │   ├── cli.ts             # CLI testing tool
│   │   └── server.ts          # Express server
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── .env                   # Backend config
│   └── package.json
├── frontend/                   # React + TypeScript frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── store/             # Zustand state
│   │   ├── hooks/             # Custom hooks
│   │   ├── types/             # TypeScript types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── .env                   # Frontend config
│   └── package.json
├── docker-compose.yml         # PostgreSQL container
└── README.md                  # Main documentation
```

## 🔧 Configuration

### Backend (.env)

Located at `backend/.env`

```env
# Database connection
DATABASE_URL="postgresql://postgres:password@localhost:5432/multiagent_pm"

# Ollama configuration
OLLAMA_API_URL="http://localhost:11434"
OLLAMA_MODEL="mistral"

# Server configuration
PORT=3001
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
```

### Frontend (.env)

Located at `frontend/.env`

```env
# Backend API URLs
VITE_API_URL="http://localhost:3001"
VITE_WS_URL="ws://localhost:3001"
```

## 📚 Database Management

### View Database

```bash
# Connect to PostgreSQL
docker exec -it multiagent_pm_db psql -U postgres -d multiagent_pm

# Example queries:
\dt                    # List tables
SELECT * FROM "Project";
SELECT * FROM "Message";
SELECT * FROM "Task";
\q                     # Quit
```

### Reset Database

```bash
cd backend
npm run db:push -- --force-reset
```

### Migrations

Create a migration after schema changes:

```bash
cd backend
npm run prisma:migrate
```

## 🧪 Testing Workflows

### Workflow 1: CLI Testing (Fastest)

Test agents without frontend or database:

```bash
cd backend
npm run test:cli "Your project description here"
```

Examples:

```bash
npm run test:cli "Build a GraphQL API"
npm run test:cli "Implement dark mode in React"
npm run test:cli "Create user authentication system"
```

### Workflow 2: Full System Testing

1. Ensure all services running (Ollama, PostgreSQL, Backend, Frontend)
2. Open http://localhost:5173
3. Enter project description
4. Click "Start Project"
5. Watch real-time communication
6. Check database: `docker exec -it multiagent_pm_db psql -U postgres -d multiagent_pm`

### Workflow 3: API Testing

Use curl or Postman:

```bash
# Create project
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -d '{"description": "Build a simple API"}'

# Get project details (replace PROJECT_ID)
curl http://localhost:3001/api/projects/PROJECT_ID

# Health check
curl http://localhost:3001/health
```

## 🚨 Troubleshooting

### Error: "Connection refused to Ollama"

**Problem**: Backend can't reach Ollama

**Solutions**:
- Make sure Ollama is running: `ollama serve`
- Check Ollama API URL matches in `.env`: `http://localhost:11434`
- Test Ollama directly: `curl http://localhost:11434/api/tags`

### Error: "Connection refused to PostgreSQL"

**Problem**: Backend can't reach database

**Solutions**:
- Start Docker: `docker-compose up -d`
- Check container is running: `docker-compose ps`
- Check logs: `docker-compose logs postgres`
- Restart: `docker-compose restart`

### Error: "Model not found"

**Problem**: Specified Ollama model isn't downloaded

**Solutions**:
- List available: `ollama list`
- Pull model: `ollama pull mistral`
- Check .env has correct model name
- Restart backend after changing model

### Port Already in Use

**Problem**: Port 3001 or 5173 already taken

**Solutions**:
```bash
# Check what's using port 3001
lsof -i :3001

# Kill process (Mac/Linux)
kill -9 <PID>

# Or change port in .env
PORT=3002
```

### Database Migration Fails

**Problem**: `npm run db:push` fails

**Solutions**:
```bash
# Reset database
npm run db:push -- --force-reset

# Or manually:
cd backend
npx prisma db push --force-reset
```

### Frontend doesn't connect to backend

**Problem**: WebSocket connection fails

**Solutions**:
- Check backend is running: http://localhost:3001/health
- Check frontend .env has correct URL: `VITE_WS_URL=ws://localhost:3001`
- Check browser console for errors
- Restart frontend: `npm run dev`

### "Timeout waiting for response"

**Problem**: Ollama taking too long to respond

**Solutions**:
- Model too large for your hardware
- Use smaller model: `mistral` or `neural-chat`
- Check Ollama memory usage
- Restart Ollama: `ollama serve`

## 📊 Ollama Models

**Available Models**:

| Model | Size | Speed | Quality | Recommended |
|-------|------|-------|---------|-------------|
| mistral | 4GB | ⚡⚡⚡ | ⭐⭐⭐ | ✓ MVP |
| neural-chat | 4GB | ⚡⚡⚡ | ⭐⭐⭐ | ✓ Good |
| llama2 | 7GB | ⚡⚡ | ⭐⭐⭐⭐ | Slower |
| dolphin-mixtral | 26GB | ⚡ | ⭐⭐⭐⭐⭐ | Coding |

**To use a different model**:

```bash
# Pull the model
ollama pull neural-chat

# Update backend/.env
OLLAMA_MODEL="neural-chat"

# Restart backend
npm run dev
```

## 🏗 Development Workflow

### Making Backend Changes

1. Edit files in `backend/src/`
2. Changes auto-reload: `npm run dev` watches for changes
3. Check console for errors

### Making Frontend Changes

1. Edit files in `frontend/src/`
2. Vite auto-reloads: `npm run dev` watches for changes
3. Check browser console for errors

### Adding to Database Schema

1. Edit `backend/prisma/schema.prisma`
2. Run migration: `npm run prisma:migrate`
3. Or push directly: `npm run db:push`
4. Prisma client auto-generates types

## 📈 Performance Tips

- Use **mistral** model for MVP (fastest)
- Run on machine with 8GB+ RAM
- Give Docker 4GB+ memory
- Close unused browser tabs
- Monitor logs for slow queries

## 🚀 Next Steps

After successful setup:

1. **Explore the Code**: Read comments in `src/` files
2. **Try Different Projects**: Test with various descriptions
3. **Customize Agents**: Edit system prompts in agent files
4. **Add Features**: Follow the plan in README.md
5. **Deploy**: See deployment notes in README.md

## 📞 Support

If you encounter issues:

1. Check this troubleshooting section
2. Review main README.md
3. Check logs:
   - Backend: Terminal running `npm run dev`
   - Frontend: Browser console
   - Database: `docker-compose logs postgres`
4. Try restarting services in order:
   ```bash
   docker-compose restart
   npm run dev  # backend
   npm run dev  # frontend
   ```

## 📖 Additional Resources

- [Ollama Docs](https://github.com/ollama/ollama)
- [React Docs](https://react.dev)
- [Prisma Docs](https://www.prisma.io/docs)
- [Socket.IO Docs](https://socket.io/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

**Happy building! 🚀**
