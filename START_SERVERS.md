# Starting the Multi-Agent PM Application

## Prerequisites
- Node.js and npm installed
- Ollama running (for LLM model access)
- PostgreSQL running (for database)

## Step 1: Start Backend Server

Open a terminal and run:
```bash
cd multi-agent-pm/backend
npm install          # if needed
npm run dev         # or `npm start` for production
```

The backend will start on **http://localhost:3000**

Expected output:
```
[Server] Multi-agent PM backend running on port 3000
[Database] Connected to PostgreSQL
[MessageBus] Event coordination service initialized
[TaskQueue] Task distribution service ready
```

## Step 2: Start Frontend Server (in a new terminal)

Open another terminal and run:
```bash
cd multi-agent-pm/frontend
npm install          # if needed
npm run dev         # or `npm run build && npm run preview` for production
```

The frontend will start on **http://localhost:5173**

Expected output:
```
  VITE v... dev server running at:

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

## Step 3: Test the Application

1. Open browser to http://localhost:5173
2. Create a new project
3. Enter a description (e.g., "Build a todo app")
4. Watch the agents work through:
   - Project Planning (PM Agent)
   - Task Extraction
   - Task Distribution (NEW - Phase A1)
   - Agent Task Claiming (NEW - Phase A2)
   - Code Generation

## What to Look For (Phase A1 + A2 Changes)

### In Console Logs:
```
[MessageBus] Broadcasting event: tasks:extracted
[TaskDistribution] Populating queue with X tasks
[TaskDistribution] Distributing X unclaimed tasks
[TaskDistribution] Emitted task:available for TASK-001 to AGENT_TYPE
[AgentClaimingHelper] Successfully claimed task TASK-001
```

### In Frontend:
- Progress indicator showing "Task Distribution" phase
- Live activity feed showing "Tasks queued for agents"
- Task list showing which agent claimed each task

## Troubleshooting

### Port Already in Use
If port 3000 or 5173 is already in use:
- Kill the existing process: `kill $(lsof -t -i :3000)`
- Or change the port in `.env` or package.json

### Database Connection Error
Ensure PostgreSQL is running and the DATABASE_URL in `.env` is correct

### Ollama Connection Error
Ensure Ollama is running with the correct model (mistral:latest or llama3.2:3b)

## Stopping Servers

Press `Ctrl+C` in each terminal window

## Environment Variables

Backend (.env or .env.local):
```
DATABASE_URL=postgresql://...
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL_CODE=mistral:latest
```

Frontend (.env or .env.local):
```
VITE_API_URL=http://localhost:3000
```
