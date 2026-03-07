# Setup Verification Checklist

Use this checklist to verify your Multi-Agent PM installation is working correctly.

## ✅ Pre-Setup Checklist

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Docker & Docker Compose installed (`docker --version`)
- [ ] Google Gemini API key obtained from https://ai.google.dev/

## ✅ Installation Checklist

### 1. Repository Setup
- [ ] Cloned repository: `git clone https://github.com/shawngeorgie06/multi-agent-pm.git`
- [ ] Navigated to project: `cd multi-agent-pm`

### 2. Backend Setup
- [ ] Copied `.env.example` to `.env`: `cd backend && cp .env.example .env`
- [ ] Added Gemini API key to `backend/.env`
- [ ] Installed dependencies: `npm install`
- [ ] Generated Prisma client: `npx prisma generate`

### 3. Frontend Setup
- [ ] Copied `.env.example` to `.env`: `cd ../frontend && cp .env.example .env`
- [ ] Installed dependencies: `npm install`

### 4. Database Setup
- [ ] Started PostgreSQL: `cd .. && docker-compose up -d`
- [ ] Verified container running: `docker-compose ps`
- [ ] Pushed database schema: `cd backend && npx prisma db push`

## ✅ Startup Checklist

### Terminal 1 - Backend
```bash
cd backend
npm run dev
```
**Expected output:**
```
🚀 MULTI-AGENT PM BACKEND
Server running on http://localhost:5555
AI Service: Gemini API (gemini-1.5-flash)
Connected clients: 0
```

- [ ] Backend started without errors
- [ ] Port 5555 is accessible
- [ ] No "GEMINI_API_KEY not found" error

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```
**Expected output:**
```
VITE v5.x.x  ready in XXX ms
➜  Local:   http://localhost:5173/
```

- [ ] Frontend started without errors
- [ ] Port 5173 is accessible
- [ ] Can open http://localhost:5173 in browser

## ✅ Functionality Checklist

### Create a Test Project
1. Open http://localhost:5173
2. Click "Create New Project"
3. Enter: "Build a simple calculator"
4. Submit

**Verify:**
- [ ] Project appears in dashboard
- [ ] Live Activity Feed shows agents working
- [ ] Design Director creates brief (~30 seconds)
- [ ] Project Manager generates 3 tasks (~1 minute)
- [ ] Engineer reviews plan
- [ ] Layout/Styling/Logic agents execute tasks
- [ ] Generated code appears in preview
- [ ] Can download complete HTML file

### Test Generated Code
- [ ] Downloaded HTML file opens in browser
- [ ] Calculator buttons work
- [ ] Operations (add, subtract, multiply, divide) function correctly
- [ ] No console errors in browser DevTools

## ✅ Common Issues

### "GEMINI_API_KEY not found"
- **Fix:** Add your API key to `backend/.env`
- **Verify:** Key starts with `AIzaSy...`

### "Connection refused to PostgreSQL"
- **Fix:** `docker-compose up -d`
- **Verify:** `docker-compose ps` shows container running

### "Port 5555 already in use"
- **Fix:** Kill process or change PORT in `backend/.env`
- **Check:** `netstat -ano | findstr :5555` (Windows) or `lsof -i :5555` (Mac/Linux)

### "Quota exceeded" (429 error)
- **Cause:** Gemini free tier limit (20 requests/day)
- **Fix:** Wait for quota reset (midnight Pacific) or upgrade API plan

### Agents not executing
- **Check:** Live Activity Feed for errors
- **Verify:** Backend logs show "All agents started and listening"
- **Test:** Refresh page and create new project

## 🎉 Success Criteria

Your setup is successful if:
1. ✅ Backend runs without errors
2. ✅ Frontend loads at http://localhost:5173
3. ✅ Can create a project and see agents working in real-time
4. ✅ Generated code downloads and runs in browser
5. ✅ No API key or database errors

## 🆘 Still Having Issues?

1. Check logs in both terminal windows
2. Review `backend/.env` and `frontend/.env` files
3. Verify Docker container is running: `docker-compose ps`
4. Restart all services:
   ```bash
   # Stop everything
   Ctrl+C in both terminals
   docker-compose down

   # Start fresh
   docker-compose up -d
   cd backend && npm run dev  # Terminal 1
   cd frontend && npm run dev # Terminal 2
   ```

5. Open an issue at https://github.com/shawngeorgie06/multi-agent-pm/issues with:
   - Error messages
   - Steps you've tried
   - Your Node.js and Docker versions
