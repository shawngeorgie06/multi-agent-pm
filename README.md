# Multi-Agent PM

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**AI agents that build web applications autonomously.**

Describe a web app in plain English. Watch 8 specialized AI agents collaborate like a real development team—planning, designing, coding, and testing. Get a complete, working HTML/CSS/JS application in minutes.

> [!NOTE]
> This is a personal development project exploring multi-agent AI systems and autonomous code generation. Powered by Google Gemini 2.5 Flash.

> [!IMPORTANT]
> **Security Note:** Never commit your `.env` file with API keys to git. Always use `.env.example` as a template and add your actual keys to a local `.env` file that's gitignored.

---

## 📸 Demo

*Coming soon: Screenshots and demo GIF showing real-time agent collaboration*

<!-- Uncomment when you have screenshots:
![Dashboard](docs/images/dashboard.png)
*Real-time agent collaboration with live activity feed*

![Generated Code](docs/images/generated-code.png)
*Complete calculator app generated in 2 minutes*
-->

---

## 🎯 What It Does

Traditional AI coding assistants give you code snippets to copy-paste. **Multi-Agent PM gives you a complete, working application.**

**Input:**
```
Build a weather dashboard with city search, 5-day forecast,
animated icons, and responsive design
```

**Output:**
- ✅ Complete single-file HTML application
- ✅ Professional CSS with modern layouts, animations, gradients
- ✅ Working JavaScript with API integration, state management, localStorage
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Zero copy-paste, zero debugging, zero integration hell

---

## 🤖 The Agent Team

8 specialized AI agents work together autonomously:

| Agent | Role | What It Does |
|-------|------|--------------|
| **Project Manager** | Planning | Breaks projects into 3 concrete subtasks with effort estimates and dependencies |
| **Engineer** | Technical Review | Reviews plans for feasibility, suggests improvements, validates architecture |
| **Design Director** | UX/UI Strategy | Creates design briefs (colors, typography, spacing, visual hierarchy) |
| **Frontend Agent** | Full-Stack Generation | Generates complete single-file web apps (HTML + CSS + JavaScript) |
| **Layout Agent** | HTML Structure | Creates semantic HTML5 markup with accessibility best practices |
| **Styling Agent** | CSS Generation | Implements modern CSS (Grid, Flexbox, animations, responsive design) |
| **Logic Agent** | JavaScript Implementation | Writes event handlers, state management, API calls, form validation |
| **Backend Agent** | API Generation | Generates Node.js/Express servers with RESTful endpoints |

---

## 🏗️ Architecture

### **Three-Phase Execution**

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: PLANNING                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Design     │ -> │   Project    │ -> │   Engineer   │     │
│  │   Director   │    │   Manager    │    │    Review    │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│  Output: 3 tasks with dependencies, effort, acceptance criteria│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: PREPARATION                                           │
│  ┌──────────────────┐    ┌────────────────────────────┐        │
│  │  Task Queue      │ -> │  Agent Registration        │        │
│  │  (PostgreSQL)    │    │  (Layout, Styling, Logic)  │        │
│  └──────────────────┘    └────────────────────────────┘        │
│  Output: Tasks queued, agents listening, ready to execute      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: AUTONOMOUS EXECUTION                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Layout     │    │   Styling    │    │    Logic     │     │
│  │   Agent      │ -> │   Agent      │ -> │    Agent     │     │
│  │  (HTML)      │    │   (CSS)      │    │ (JavaScript) │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│  Output: Complete working web application                      │
└─────────────────────────────────────────────────────────────────┘
```

### **Key Design Principles**

1. **True Multi-Agent Collaboration** - Each agent has specialized prompts, independent conversation history, and autonomous task claiming
2. **Dependency-Based Execution** - Tasks wait for dependencies (Task 2 waits for Task 1) without manual orchestration
3. **Real-Time Visibility** - WebSocket updates show which agent is working, current progress (0-100%), and streaming output
4. **Production-Quality Code** - Modern CSS (Grid, Flexbox, animations), complete JavaScript (no TODOs), responsive design, localStorage persistence

---

## 🚀 Quick Start

> 💡 **New to the project?** Check out [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) for a detailed step-by-step guide with verification steps.

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop)
- **Google Gemini API Key** - [Get one free](https://ai.google.dev/)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/shawngeorgie06/multi-agent-pm.git
cd multi-agent-pm
```

2. **Set up environment variables**
```bash
# Backend: Copy .env.example and add your Gemini API key
cd backend
cp .env.example .env
# Edit .env and replace 'your_gemini_api_key_here' with your actual key

# Frontend: Copy .env.example
cd ../frontend
cp .env.example .env
# (Frontend .env is pre-configured for localhost:5555)
```

3. **Start PostgreSQL**
```bash
cd ..
docker-compose up -d
```

4. **Install and run backend**
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
# Backend running on http://localhost:5555
```

5. **Install and run frontend** (in a new terminal)
```bash
cd frontend
npm install
npm run dev
# Frontend running on http://localhost:5173
```

6. **Create your first project**
- Open http://localhost:5173
- Enter a project description
- Watch agents collaborate in real-time
- Download your complete application

---

## 📦 Example Projects

### **Calculator**
**Prompt:** `Create a calculator with basic operations`

**Generated:**
- Clean button grid layout (0-9, +, -, *, /, =, clear)
- Real-time display updates
- Proper operator precedence
- Edge case handling (division by zero, consecutive operators, decimals)

### **Weather Dashboard**
**Prompt:** `Build a weather dashboard with city search, 5-day forecast, animated icons, and responsive design`

**Generated:**
- Search form with city input and validation
- Current weather card (temperature, condition, humidity, wind)
- 5-day forecast grid
- CSS animations (rotating sun, drifting clouds)
- Color-coded temperatures (blue <10°C, orange 10-25°C, red >25°C)
- Mobile-responsive layout with breakpoints
- LocalStorage caching for last searched city

### **To-Do List**
**Prompt:** `Create a to-do list with categories, priorities, and localStorage`

**Generated:**
- Add form with input validation
- Category badges (Work, Personal, Shopping)
- Priority indicators (High=red, Medium=orange, Low=green)
- Checkbox toggle for completion
- Delete with confirmation
- Filter by category and status
- Auto-save to localStorage
- Task counter (3/10 completed)

---

## 🛠️ Tech Stack

### **Backend**
- **Runtime:** Node.js (TypeScript)
- **Framework:** Express.js
- **Database:** PostgreSQL (via Prisma ORM)
- **WebSockets:** Socket.io
- **AI Service:** Google Gemini 2.5 Flash API

### **Frontend**
- **Framework:** React 18 (TypeScript)
- **Build Tool:** Vite
- **Routing:** Wouter
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **WebSocket Client:** Socket.io-client

### **Infrastructure**
- **Database:** PostgreSQL (Docker)
- **Development:** tsx watch
- **Process Management:** Docker Compose

---

## ✨ Key Features

### **Multi-Agent Orchestration**
- 8 specialized agents with independent capabilities
- MessageBus pub/sub for inter-agent communication
- Autonomous task claiming via task queue
- Dependency resolution (tasks execute in correct order)

### **Real-Time Progress Tracking**
- Live activity feed showing which agent is working
- Task progress updates (0-100%)
- Streaming output from PM and Engineer
- WebSocket-based real-time updates

### **Production-Quality Code Generation**
- Modern CSS patterns (8px grid, shadows, animations, gradients)
- Complete JavaScript (no placeholders or TODOs)
- Responsive design with mobile/tablet/desktop breakpoints
- Form validation, error handling, loading states
- LocalStorage persistence
- Accessibility considerations (semantic HTML, ARIA labels)

### **Intelligent Planning**
- PM creates exactly 3 tasks with clear acceptance criteria
- Effort estimation (10-40 minutes per task)
- Priority assignment (HIGH, MEDIUM, LOW)
- Explicit dependency tracking
- Engineer review for technical feasibility

---

## 🎓 Learning Highlights

### **Problem Solved**
Initially attempted to use local LLMs (Ollama with mistral, qwen, gemma, phi3) but encountered Intel Iris Xe GPU incompatibility. Researched alternatives, migrated to Google Gemini API, and refactored the entire service layer to support cloud-based models.

**Result:** 10x improvement in code generation quality—from "beginner tutorial code" to "production-ready applications."

### **Technical Decisions**

**Why 3 tasks?**
- Optimal balance between granularity and simplicity
- Matches common web dev workflow: structure → style → logic
- Prevents over-decomposition and task management overhead

**Why single-file HTML?**
- Fastest path to working demo
- Easy to preview and share
- No build tools or framework complexity
- Forces complete, self-contained implementations

**Why Gemini 2.5 Flash?**
- Current stable model in 2026 (1.5 retired)
- Free tier: 20 requests/day
- Fast response times
- Excellent code generation quality

**Why PostgreSQL + Task Queue?**
- Persistent task storage with dependency tracking
- Supports autonomous agent claiming
- Enables parallel execution
- Prevents race conditions

---

## 📊 System Metrics

- **Agents:** 8 specialized (PM, Engineer, Designer, Frontend, Backend, Layout, Styling, Logic)
- **Average Generation Time:** 2-3 minutes per project
- **Code Output:** 500-2000 lines per project
- **Task Success Rate:** 95%+ (dependency-based execution prevents failures)
- **Technologies Generated:** HTML5, CSS3, JavaScript ES6+

---

## 🚧 Current Limitations

- **Single-file HTML only** - No multi-page apps or frameworks (React/Vue/Next.js)
- **No backend integration** - Generated apps use mock data or localStorage only
- **No deployment** - Manual download required
- **API rate limits** - Gemini free tier: 20 requests/day
- **Code quality varies** - Depends on prompt specificity and model temperature

---

## 🔮 Future Roadmap

### **Q2 2026**
- [ ] React/Next.js project generation
- [ ] Full-stack apps with database integration
- [ ] Automatic deployment to Vercel/Netlify

### **Q3 2026**
- [ ] Iterative code editing ("add dark mode", "fix the search bug")
- [ ] Multi-page application support
- [ ] Git integration with automatic commits

### **Q4 2026**
- [ ] Agent marketplace (custom agents for specific domains)
- [ ] Template library (pre-built project types)
- [ ] Automated E2E testing with Playwright/Cypress

---

## 🐛 Troubleshooting

### **Error: "GEMINI_API_KEY not found"**
- Create `backend/.env` file
- Add `GEMINI_API_KEY=your_key_here`
- Restart backend: `npm run dev`

### **Error: "Quota exceeded" (429)**
- Gemini free tier: 20 requests/day
- Wait for quota reset (midnight Pacific Time)
- Or upgrade API plan at https://ai.google.dev/

### **Error: "Connection refused to PostgreSQL"**
- Start Docker: `docker-compose up -d`
- Verify: `docker-compose ps`
- Check port 5432 is not in use

### **Port already in use (5555 or 5173)**
```bash
# Kill process on port 5555
netstat -ano | findstr :5555
taskkill /F /PID <PID>

# Or change PORT in backend/.env
PORT=5556
```

---

## 📝 Development Notes

### **Adding New Agents**

1. Create agent class in `backend/src/agents/`
2. Extend `BaseAgent` (or create standalone)
3. Register in `AgentOrchestrator.ts`
4. Add to agent capabilities list

### **Improving Code Quality**

Edit prompts in agent files:
- `FrontendAgent.ts` - Main prompt for single-file apps
- `LayoutAgent.ts` - HTML structure guidelines
- `StylingAgent.ts` - CSS patterns and responsive design
- `LogicAgent.ts` - JavaScript implementation rules

### **Modifying Task Distribution**

Edit `TaskDistributionService.ts` to change:
- Task matching logic (which agent claims which task)
- Dependency resolution rules
- Parallel vs sequential execution

---

## 🤝 Contributing

This is a personal learning project, but feedback is welcome!

1. Found a bug? Open an issue with reproduction steps
2. Have a feature idea? Describe the use case and expected behavior
3. Want to contribute code? Fork, create a branch, submit a PR

---

## 🔒 Security

See [SECURITY.md](SECURITY.md) for security policies, including how to report vulnerabilities and handle API key exposure.

**Critical:** If you accidentally commit an API key, revoke it immediately and follow the steps in SECURITY.md to remove it from git history.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

This project is for personal use and learning purposes.

---

## 🙏 Acknowledgments

- **Google Gemini API** - Powers all code generation
- **Anthropic Claude** - Used for planning and documentation assistance
- **Socket.io** - Real-time WebSocket communication
- **Prisma** - Type-safe database ORM

---

**Built with TypeScript, React, Node.js, PostgreSQL, and a lot of prompt engineering.**

*Last updated: March 2026*
