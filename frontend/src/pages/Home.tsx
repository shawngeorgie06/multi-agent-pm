import { useLocation } from "wouter";
import { useState, useEffect, Fragment } from "react";
import { ArrowRight, Zap, Loader2 } from "lucide-react";
import { API_URL } from "@/lib/api";
import { BackgroundSceneComponent } from "@/components/BackgroundScene";
import '@/styles/background.css';

const agents = [
  {
    id: "1", num: "01", name: "Project Manager", color: "#3b82f6",
    emoji: "⚙️",
    desc: "Decomposes your idea into 3 concrete tasks with dependencies and effort estimates.",
    caps: ["Task decomp", "Effort est.", "Dependencies"],
  },
  {
    id: "2", num: "02", name: "Engineer", color: "#8b5cf6",
    emoji: "🔬",
    desc: "Reviews plans for technical feasibility and catches architecture issues early.",
    caps: ["Tech review", "Architecture", "Best practices"],
  },
  {
    id: "3", num: "03", name: "Design Director", color: "#ef4444",
    emoji: "🎨",
    desc: "Creates complete design briefs: color schemes, typography, layout systems.",
    caps: ["Color systems", "Typography", "Visual hierarchy"],
  },
  {
    id: "4", num: "04", name: "Frontend Agent", color: "#00E5FF",
    emoji: "💻",
    desc: "Generates complete single-file web apps from design briefs and specs.",
    caps: ["HTML/CSS/JS", "Responsive", "localStorage"],
  },
  {
    id: "5", num: "05", name: "Layout Agent", color: "#f59e0b",
    emoji: "🏗️",
    desc: "Builds semantic, accessible HTML5 structure with proper document organization.",
    caps: ["Semantic HTML5", "Accessibility", "Forms"],
  },
  {
    id: "6", num: "06", name: "Styling Agent", color: "#ec4899",
    emoji: "✨",
    desc: "Generates modern CSS with animations, responsive breakpoints, and design tokens.",
    caps: ["Flexbox/Grid", "Animations", "CSS vars"],
  },
  {
    id: "7", num: "07", name: "Logic Agent", color: "#10b981",
    emoji: "⚡",
    desc: "Implements JavaScript: event handlers, state management, API integration.",
    caps: ["Event handlers", "State mgmt", "API calls"],
  },
  {
    id: "8", num: "08", name: "Backend Agent", color: "#f97316",
    emoji: "🔧",
    desc: "Generates Node.js/Express APIs with RESTful endpoints and database models.",
    caps: ["REST APIs", "DB models", "Auth"],
  },
];

const terminalLines = [
  { prefix: "[PM]",       color: "#60a5fa", text: "Analyzing: 'Build a weather dashboard'" },
  { prefix: "[PM]",       color: "#60a5fa", text: "→ Task 1: HTML structure  (10 min)" },
  { prefix: "[PM]",       color: "#60a5fa", text: "→ Task 2: CSS styling     (15 min)" },
  { prefix: "[PM]",       color: "#60a5fa", text: "→ Task 3: JS logic        (20 min)" },
  { prefix: "[Engineer]", color: "#a78bfa", text: "Reviewing plan... ✓ approved" },
  { prefix: "[Layout]",   color: "#fbbf24", text: "Building semantic HTML structure..." },
  { prefix: "[Styling]",  color: "#f472b6", text: "Applying CSS Grid + transitions..." },
  { prefix: "[Logic]",    color: "#34d399", text: "Integrating weather API + cache..." },
  { prefix: "[Frontend]", color: "#00E5FF", text: "✓ Weather dashboard complete!" },
];

function AgentTerminal() {
  const [visible, setVisible] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (fading) {
      // Hold the fade-out, then clear
      const t = setTimeout(() => { setFading(false); setVisible(0); }, 700);
      return () => clearTimeout(t);
    }
    if (visible >= terminalLines.length) {
      // Pause at end, then start fade-out
      const t = setTimeout(() => setFading(true), 2200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisible(v => v + 1), 680);
    return () => clearTimeout(t);
  }, [visible, fading]);

  return (
    <div className="terminal-window">
      <div className="terminal-bar">
        <span className="dot dot-red" />
        <span className="dot dot-yellow" />
        <span className="dot dot-cyan" />
        <span className="terminal-title">agent-terminal — bash</span>
      </div>
      <div className="terminal-body" style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.7s ease' }}>
        <div className="terminal-cmd">$ run-agents --project "weather-dashboard"</div>
        {terminalLines.slice(0, visible).map((line, i) => (
          <div key={i} className="terminal-line">
            <span className="terminal-prefix" style={{ color: line.color }}>{line.prefix}</span>
            <span className="terminal-text">{line.text}</span>
          </div>
        ))}
        {visible < terminalLines.length && (
          <span className="terminal-cursor">▋</span>
        )}
      </div>
    </div>
  );
}

const templates = [
  { emoji: "🧮", label: "Calculator", text: "Build a scientific calculator that can perform basic math operations (add, subtract, multiply, divide), plus advanced functions like square root, percentage, and power (exponent). Include a clear display for results, history of previous calculations, and clear/delete buttons." },
  { emoji: "✅", label: "Todo List", text: "Build a todo application with an input field to add new tasks, a list displaying all tasks, checkboxes to mark tasks as complete, delete buttons for each task, and a clear all completed button. Include localStorage persistence so tasks are saved across page refreshes." },
  { emoji: "🌤️", label: "Weather", text: "Build a weather dashboard with a search input to find cities, display current weather with temperature and conditions, show a 7-day forecast, include weather icons, add loading states, and error handling for invalid locations." },
  { emoji: "🛍️", label: "E-Commerce", text: "Build an e-commerce shopping site with a product listing grid, product detail views, add to cart functionality, a shopping cart modal showing items and quantities, price totals, remove from cart buttons, and a checkout button with mock order processing." },
];

const steps = [
  {
    num: "01", title: "PLANNING", color: "#3b82f6",
    desc: "Design Director creates a design brief. PM Agent decomposes your idea into 3 concrete tasks. Engineer reviews for technical feasibility.",
    tags: ["Design brief", "Task decomp", "Tech review"],
  },
  {
    num: "02", title: "PREPARATION", color: "#00E5FF",
    desc: "Tasks are saved to the database with dependency tracking. All specialized agents initialize and start listening for available work.",
    tags: ["DB storage", "Agent init", "Dep tracking"],
  },
  {
    num: "03", title: "EXECUTION", color: "#10b981",
    desc: "Agents autonomously claim tasks when dependencies are met. Watch real-time progress via WebSocket. Download your complete app when done.",
    tags: ["Auto claim", "WebSockets", "Download"],
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [projectInput, setProjectInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectInput.trim()) { setError("Please describe your project"); return; }
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectInput.trim().substring(0, 50) || "New Project",
          description: projectInput.trim(),
        }),
      });
      if (!response.ok) throw new Error("Failed to create project");
      const data = await response.json();
      setLocation(`/dashboard?projectId=${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setIsCreating(false);
    }
  };

  return (
    <>
      <style>{`
        /* ── Keyframes ── */
        @keyframes cursor-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fade-up { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }

        /* ── Terminal ── */
        .terminal-window {
          background: rgba(4,6,18,0.9);
          border: 1px solid rgba(0,229,255,0.22);
          border-radius: 14px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px;
          overflow: hidden;
          backdrop-filter: blur(24px);
          box-shadow: 0 0 60px rgba(0,229,255,0.07), 0 24px 64px rgba(0,0,0,0.55);
        }
        .terminal-bar {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 13px 16px;
          border-bottom: 1px solid rgba(0,229,255,0.1);
          background: rgba(0,229,255,0.03);
        }
        .dot { width:10px; height:10px; border-radius:50%; display:inline-block; flex-shrink:0; }
        .dot-red    { background:#FF4D6A; }
        .dot-yellow { background:#FFB800; }
        .dot-cyan   { background:#00E5FF; }
        .terminal-title { margin-left:8px; color:rgba(200,214,229,0.38); font-size:11px; letter-spacing:0.05em; }
        .terminal-body { padding:20px; min-height:280px; }
        .terminal-cmd { color:rgba(200,214,229,0.32); margin-bottom:14px; font-size:12px; }
        .terminal-line { display:flex; gap:10px; margin-bottom:8px; }
        .terminal-prefix { font-weight:600; flex-shrink:0; }
        .terminal-text { color:#c8d6e5; }
        .terminal-cursor { color:#00E5FF; animation:cursor-blink 1s step-end infinite; }

        /* ── Page layout ── */
        .home-page { min-height:100vh; color:#e8eaed; font-family:'Manrope',sans-serif; }
        .home-container { max-width:1400px; margin:0 auto; padding:0 2rem; }

        /* ── Header ── */
        .home-header {
          position:sticky; top:0; z-index:50;
          border-bottom:1px solid rgba(0,229,255,0.1);
          backdrop-filter:blur(20px);
          background:rgba(5,8,20,0.72);
        }
        .home-header-inner {
          max-width:1400px; margin:0 auto; padding:0 2rem;
          display:flex; align-items:center; justify-content:space-between; height:62px;
        }
        .home-logo { display:flex; align-items:center; gap:10px; text-decoration:none; }
        .home-logo-icon {
          width:34px; height:34px; border-radius:8px;
          background:rgba(0,229,255,0.1); border:1px solid rgba(0,229,255,0.28);
          display:flex; align-items:center; justify-content:center;
        }
        .home-logo-text {
          font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:13px;
          letter-spacing:0.08em; color:#e8eaed;
        }
        .home-nav { display:flex; gap:28px; }
        .home-nav a {
          font-size:12px; font-weight:600; letter-spacing:0.07em;
          color:rgba(232,234,237,0.48); text-decoration:none;
          transition:color 0.18s;
        }
        .home-nav a:hover { color:#00E5FF; }
        .home-launch-btn {
          padding:8px 18px;
          background:rgba(0,229,255,0.1); border:1px solid rgba(0,229,255,0.35);
          border-radius:8px; color:#00E5FF; font-weight:700; font-size:12px;
          letter-spacing:0.07em; cursor:pointer; transition:all 0.18s;
          font-family:'IBM Plex Mono',monospace;
        }
        .home-launch-btn:hover { background:rgba(0,229,255,0.18); }

        /* ── Hero ── */
        .hero-section {
          display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center;
          padding:80px 2rem 96px;
          max-width:1400px; margin:0 auto;
          animation:fade-up 0.55s ease both;
        }
        .hero-badge {
          display:inline-flex; align-items:center; gap:8px;
          padding:6px 14px; border-radius:6px;
          border:1px solid rgba(0,229,255,0.22);
          background:rgba(0,229,255,0.05);
          margin-bottom:26px;
        }
        .hero-badge-dot {
          width:6px; height:6px; border-radius:50%; background:#00E5FF;
          display:inline-block; box-shadow:0 0 6px #00E5FF;
        }
        .hero-badge-text {
          font-family:'IBM Plex Mono',monospace; font-size:11px;
          color:#00E5FF; letter-spacing:0.1em;
        }
        .hero-h1 {
          font-family:'IBM Plex Mono',monospace; font-weight:700;
          line-height:1.08; margin-bottom:22px;
        }
        .hero-h1-line1 { display:block; font-size:clamp(46px,5.5vw,76px); color:#e8eaed; }
        .hero-h1-line2 { display:block; font-size:clamp(46px,5.5vw,76px); color:#00E5FF; }
        .hero-sub {
          font-size:16px; line-height:1.7;
          color:rgba(232,234,237,0.6); margin-bottom:32px; max-width:420px;
        }

        /* ── Form ── */
        .project-form { max-width:480px; }
        .project-textarea {
          width:100%; padding:14px 16px; resize:none; box-sizing:border-box;
          background:rgba(4,6,18,0.78); border:1px solid rgba(0,229,255,0.18);
          border-radius:10px; color:#e8eaed; font-size:14px; line-height:1.6;
          font-family:'Manrope',sans-serif; outline:none;
          transition:border-color 0.18s, box-shadow 0.18s;
        }
        .project-textarea:focus {
          border-color:rgba(0,229,255,0.55);
          box-shadow:0 0 0 3px rgba(0,229,255,0.09);
        }
        .project-textarea::placeholder { color:rgba(232,234,237,0.3); }
        .form-error { color:#FF4D6A; font-size:13px; margin-top:6px; font-weight:600; }

        .templates-label {
          font-family:'IBM Plex Mono',monospace; font-size:11px;
          color:rgba(232,234,237,0.32); letter-spacing:0.09em; margin-bottom:8px;
        }
        .templates-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; }
        .template-btn {
          padding:9px 12px; text-align:left;
          background:rgba(4,6,18,0.65); border:1px solid rgba(0,229,255,0.13);
          border-radius:8px; color:rgba(232,234,237,0.65); font-size:12px; font-weight:600;
          cursor:pointer; transition:all 0.18s; font-family:'Manrope',sans-serif;
        }
        .template-btn:hover {
          border-color:rgba(0,229,255,0.42);
          background:rgba(0,229,255,0.06);
          color:#e8eaed;
        }

        .create-btn {
          width:100%; padding:14px; border-radius:10px;
          background:#00E5FF; border:none;
          color:#030712; font-weight:800; font-size:14px; letter-spacing:0.06em;
          cursor:pointer; transition:opacity 0.18s;
          display:flex; align-items:center; justify-content:center; gap:8px;
          font-family:'IBM Plex Mono',monospace;
        }
        .create-btn:disabled { opacity:0.6; cursor:not-allowed; background:rgba(0,229,255,0.18); color:#00E5FF; }
        .create-btn-spinner { animation:spin 0.9s linear infinite; }
        .view-btn {
          width:100%; padding:11px; border-radius:10px; margin-top:10px;
          background:transparent; border:1px solid rgba(232,234,237,0.14);
          color:rgba(232,234,237,0.5); font-weight:600; font-size:13px;
          cursor:pointer; transition:all 0.18s; font-family:'Manrope',sans-serif;
        }
        .view-btn:hover { border-color:rgba(232,234,237,0.3); color:rgba(232,234,237,0.8); }

        .tech-badges { display:flex; gap:7px; flex-wrap:wrap; margin-top:26px; }
        .tech-badge {
          padding:4px 10px; border:1px solid rgba(0,229,255,0.13); border-radius:5px;
          font-size:11px; font-family:'IBM Plex Mono',monospace;
          color:rgba(0,229,255,0.55); background:rgba(0,229,255,0.04); letter-spacing:0.04em;
        }

        /* ── Hero right ── */
        .hero-right { animation:fade-up 0.55s ease 0.18s both; }

        /* ── Agents section ── */
        .agents-section {
          border-top:1px solid rgba(0,229,255,0.08);
          border-bottom:1px solid rgba(0,229,255,0.08);
          background:rgba(4,6,18,0.62);
          backdrop-filter:blur(12px);
          padding:80px 0;
        }
        .section-eyebrow {
          font-family:'IBM Plex Mono',monospace; font-size:11px;
          color:#00E5FF; letter-spacing:0.12em; margin-bottom:12px;
        }
        .section-h2 {
          font-family:'IBM Plex Mono',monospace; font-weight:700;
          font-size:clamp(32px,3.8vw,50px); color:#e8eaed;
          margin-bottom:12px; line-height:1.1;
        }
        .section-sub {
          font-size:15px; color:rgba(232,234,237,0.5); max-width:500px; line-height:1.65;
          margin-bottom:44px;
        }
        .agents-grid {
          display:grid; grid-template-columns:repeat(4,1fr); gap:14px;
        }
        .agent-card {
          padding:20px; border-radius:12px;
          background:rgba(8,12,28,0.75);
          border:1px solid rgba(255,255,255,0.06);
          transition:all 0.2s; backdrop-filter:blur(10px);
        }
        .agent-card:hover { transform:translateY(-2px); background:rgba(10,15,34,0.92); }
        .agent-card-top {
          display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;
        }
        .agent-icon-wrap {
          width:36px; height:36px; border-radius:8px;
          display:flex; align-items:center; justify-content:center; font-size:15px;
          flex-shrink:0;
        }
        .agent-num {
          font-family:'IBM Plex Mono',monospace; font-size:11px;
          color:rgba(232,234,237,0.22); letter-spacing:0.07em;
          transition:color 0.2s;
        }
        .agent-name {
          font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:12.5px;
          color:#e8eaed; margin-bottom:7px; letter-spacing:0.02em;
        }
        .agent-desc {
          font-size:12px; color:rgba(232,234,237,0.48);
          line-height:1.55; margin-bottom:14px;
        }
        .agent-caps { display:flex; flex-wrap:wrap; gap:5px; }
        .agent-cap {
          padding:3px 8px; border-radius:4px; font-size:10px;
          font-family:'IBM Plex Mono',monospace; letter-spacing:0.02em;
        }

        /* ── How it works ── */
        .how-section { padding:80px 0; }
        .how-grid {
          display:grid; grid-template-columns:1fr 48px 1fr 48px 1fr; gap:0; align-items:start;
        }
        .step-card {
          padding:28px 24px; border-radius:14px;
          background:rgba(8,12,28,0.72);
          backdrop-filter:blur(10px);
        }
        .step-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
        .step-label {
          font-family:'IBM Plex Mono',monospace; font-size:10px;
          color:rgba(232,234,237,0.28); letter-spacing:0.1em;
        }
        .step-num {
          font-family:'IBM Plex Mono',monospace; font-size:26px; font-weight:700;
        }
        .step-title {
          font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:17px;
          color:#e8eaed; margin-bottom:12px; letter-spacing:0.04em;
        }
        .step-desc {
          font-size:14px; color:rgba(232,234,237,0.52); line-height:1.65; margin-bottom:18px;
        }
        .step-tags { display:flex; flex-wrap:wrap; gap:6px; }
        .step-tag {
          padding:4px 10px; border-radius:5px; font-size:10px;
          font-family:'IBM Plex Mono',monospace; letter-spacing:0.02em;
        }
        .step-arrow {
          display:flex; align-items:center; justify-content:center; padding-top:72px;
        }
        .arrow-line { width:24px; height:1px; background:rgba(0,229,255,0.25); }
        .arrow-head {
          border-left:7px solid rgba(0,229,255,0.25);
          border-top:5px solid transparent;
          border-bottom:5px solid transparent;
        }

        /* ── CTA ── */
        .cta-section {
          border-top:1px solid rgba(0,229,255,0.08);
          background:rgba(4,6,18,0.52);
          backdrop-filter:blur(12px);
          padding:80px 0; text-align:center;
        }
        .cta-h2 {
          font-family:'IBM Plex Mono',monospace; font-weight:700;
          font-size:clamp(34px,5vw,62px); color:#e8eaed;
          margin-bottom:14px; line-height:1.1;
        }
        .cta-sub {
          font-size:15px; color:rgba(232,234,237,0.48);
          max-width:440px; margin:0 auto 36px; line-height:1.65;
        }
        .cta-btns { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
        .cta-primary {
          padding:14px 32px; background:#00E5FF; border:none; border-radius:10px;
          color:#030712; font-weight:800; font-size:13px; letter-spacing:0.06em;
          cursor:pointer; font-family:'IBM Plex Mono',monospace; transition:opacity 0.18s;
        }
        .cta-primary:hover { opacity:0.88; }
        .cta-secondary {
          padding:14px 32px; background:transparent;
          border:1px solid rgba(0,229,255,0.28); border-radius:10px;
          color:#00E5FF; font-weight:700; font-size:13px; letter-spacing:0.06em;
          cursor:pointer; font-family:'IBM Plex Mono',monospace; transition:all 0.18s;
        }
        .cta-secondary:hover { background:rgba(0,229,255,0.07); }

        /* ── Footer ── */
        .home-footer {
          border-top:1px solid rgba(255,255,255,0.05);
          padding:30px 2rem;
        }
        .footer-inner {
          max-width:1400px; margin:0 auto;
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;
        }
        .footer-logo { display:flex; align-items:center; gap:8px; }
        .footer-logo-icon {
          width:26px; height:26px; border-radius:6px;
          background:rgba(0,229,255,0.08); border:1px solid rgba(0,229,255,0.22);
          display:flex; align-items:center; justify-content:center;
        }
        .footer-logo-text {
          font-family:'IBM Plex Mono',monospace; font-size:11px;
          color:rgba(232,234,237,0.35); letter-spacing:0.06em;
        }
        .footer-powered {
          font-family:'IBM Plex Mono',monospace; font-size:11px;
          color:rgba(232,234,237,0.28); letter-spacing:0.04em;
        }

        /* ── Responsive ── */
        @media (max-width:1100px) {
          .agents-grid { grid-template-columns:repeat(2,1fr); }
          .how-grid { grid-template-columns:1fr; }
          .step-arrow { display:none; }
        }
        @media (max-width:900px) {
          .hero-section { grid-template-columns:1fr; gap:40px; }
          .hero-right { display:none; }
          .home-nav { display:none; }
          .agents-grid { grid-template-columns:repeat(2,1fr); }
        }
        @media (max-width:560px) {
          .agents-grid { grid-template-columns:1fr; }
          .templates-grid { grid-template-columns:1fr; }
          .cta-btns { flex-direction:column; align-items:center; }
        }
      `}</style>

      <div className="home-page">
        <BackgroundSceneComponent />

        {/* Header */}
        <header className="home-header">
          <div className="home-header-inner">
            <div className="home-logo">
              <div className="home-logo-icon">
                <Zap style={{ width: 15, height: 15, color: '#00E5FF' }} />
              </div>
              <span className="home-logo-text">MULTI-AGENT PM</span>
            </div>

            <nav className="home-nav">
              <a href="#agents">AGENTS</a>
              <a href="#how-it-works">HOW IT WORKS</a>
              <a href="#cta">BUILD NOW</a>
            </nav>

            <button className="home-launch-btn" onClick={() => setLocation("/dashboard")}>
              DASHBOARD →
            </button>
          </div>
        </header>

        {/* Hero */}
        <section className="hero-section">
          {/* Left */}
          <div>
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              <span className="hero-badge-text">MULTI-AGENT CODE GENERATION</span>
            </div>

            <h1 className="hero-h1">
              <span className="hero-h1-line1">Describe it.</span>
              <span className="hero-h1-line2">Agents build it.</span>
            </h1>

            <p className="hero-sub">
              8 AI agents collaborate like a real dev team — planning, designing, coding, and testing. Get complete working web apps in minutes.
            </p>

            <form onSubmit={handleCreateProject} className="project-form">
              <div style={{ marginBottom: 12 }}>
                <textarea
                  className="project-textarea"
                  value={projectInput}
                  onChange={e => { setProjectInput(e.target.value); setError(null); }}
                  placeholder="Describe your project... (e.g., Build a weather dashboard with city search and a 7-day forecast)"
                  rows={3}
                />
                {error && <p className="form-error">{error}</p>}
              </div>

              <p className="templates-label">QUICK START</p>
              <div className="templates-grid">
                {templates.map(t => (
                  <button
                    key={t.label}
                    type="button"
                    className="template-btn"
                    onClick={() => { setProjectInput(t.text); setError(null); }}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              <button type="submit" disabled={isCreating} className="create-btn">
                {isCreating ? (
                  <>
                    <Loader2 style={{ width: 15, height: 15 }} className="create-btn-spinner" />
                    CREATING...
                  </>
                ) : (
                  <>CREATE PROJECT <ArrowRight style={{ width: 15, height: 15 }} /></>
                )}
              </button>

              <button type="button" className="view-btn" onClick={() => setLocation("/dashboard")}>
                View existing projects →
              </button>
            </form>

            <div className="tech-badges">
              {['Gemini 2.5 Flash', 'Node.js', 'React', 'PostgreSQL', 'WebSockets'].map(t => (
                <span key={t} className="tech-badge">{t}</span>
              ))}
            </div>
          </div>

          {/* Right: Terminal */}
          <div className="hero-right">
            <AgentTerminal />
          </div>
        </section>

        {/* Agents */}
        <section id="agents" className="agents-section">
          <div className="home-container">
            <p className="section-eyebrow">// THE TEAM</p>
            <h2 className="section-h2">8 SPECIALIZED AGENTS</h2>
            <p className="section-sub">
              Each agent handles a specific slice of the development process. They coordinate autonomously — no manual hand-offs required.
            </p>

            <div className="agents-grid">
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className="agent-card"
                  style={{ borderColor: `rgba(255,255,255,0.06)` }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = `${agent.color}40`)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = `rgba(255,255,255,0.06)`)}
                >
                  <div className="agent-card-top">
                    <div
                      className="agent-icon-wrap"
                      style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}35` }}
                    >
                      <span>{agent.emoji}</span>
                    </div>
                    <span className="agent-num">{agent.num}</span>
                  </div>
                  <div className="agent-name">{agent.name}</div>
                  <div className="agent-desc">{agent.desc}</div>
                  <div className="agent-caps">
                    {agent.caps.map(cap => (
                      <span
                        key={cap}
                        className="agent-cap"
                        style={{ color: agent.color, background: `${agent.color}10`, border: `1px solid ${agent.color}22` }}
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="how-section">
          <div className="home-container">
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <p className="section-eyebrow">// PROCESS</p>
              <h2 className="section-h2">HOW IT WORKS</h2>
            </div>

            <div className="how-grid">
              {steps.map((step, i) => (
                <Fragment key={step.num}>
                  <div
                    className="step-card"
                    style={{ border: `1px solid ${step.color}25` }}
                  >
                    <div className="step-header">
                      <span className="step-label">STEP</span>
                      <span className="step-num" style={{ color: step.color }}>{step.num}</span>
                    </div>
                    <div className="step-title">{step.title}</div>
                    <div className="step-desc">{step.desc}</div>
                    <div className="step-tags">
                      {step.tags.map(t => (
                        <span
                          key={t}
                          className="step-tag"
                          style={{ color: step.color, background: `${step.color}10`, border: `1px solid ${step.color}22` }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  {i < 2 && (
                    <div className="step-arrow">
                      <div className="arrow-line" />
                      <div className="arrow-head" />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="cta-section">
          <div className="home-container">
            <h2 className="cta-h2">
              READY TO <span style={{ color: '#00E5FF' }}>BUILD?</span>
            </h2>
            <p className="cta-sub">
              Describe your idea at the top of the page, or jump straight to the dashboard.
            </p>
            <div className="cta-btns">
              <button className="cta-primary" onClick={() => setLocation("/dashboard")}>
                OPEN DASHBOARD →
              </button>
              <button className="cta-secondary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                START A PROJECT
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="home-footer">
          <div className="footer-inner">
            <div className="footer-logo">
              <div className="footer-logo-icon">
                <Zap style={{ width: 12, height: 12, color: '#00E5FF' }} />
              </div>
              <span className="footer-logo-text">MULTI-AGENT PM</span>
            </div>
            <span className="footer-powered">
              Powered by Gemini 2.5 Flash · TypeScript · React · PostgreSQL
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
