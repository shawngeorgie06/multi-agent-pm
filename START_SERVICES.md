# Starting Multi-Agent PM Services

## Automatic Start (One Click)

### Option 1: Windows Batch File
Double-click **`START_ALL.bat`** from the `multi-agent-pm` folder

### Option 2: PowerShell
Open PowerShell and run:
```powershell
powershell -ExecutionPolicy Bypass -File START_ALL.ps1
```

---

## Manual Start (Two Terminal Windows)

### Terminal 1: Backend
```bash
cd backend
npm run dev
```
Backend will run on **http://localhost:3001**

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```
Frontend will run on **http://localhost:5173** (or higher if port taken)

---

## Verification

Once both are running:

✅ **Backend:** Open http://localhost:3001/health - should show `{"status":"ok"}`
✅ **Frontend:** Open http://localhost:5173 - should see the app
✅ **Ollama:** Make sure Ollama is running (`ollama serve` in another terminal)

---

## Troubleshooting

**Port already in use?**
- Close existing terminals running the services
- Or change the PORT in `.env` files

**Backend won't start?**
- Make sure Ollama is running on port 11434
- Check PostgreSQL is running: `docker-compose up -d`

**Frontend won't connect to backend?**
- Verify backend is running on 3001: `curl http://localhost:3001/health`
- Check VITE_API_URL in frontend `.env`

---

## Quick Reference

| Service | Port | URL |
|---------|------|-----|
| Backend | 3001 | http://localhost:3001 |
| Frontend | 5173+ | http://localhost:5173 |
| Ollama | 11434 | http://localhost:11434 |
| PostgreSQL | 5432 | (Docker) |
