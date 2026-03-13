import { useLocation } from "wouter";
import { useState } from "react";
import { ArrowRight, Zap, Network, Cpu, Workflow, TrendingUp, Play, ChevronDown, Loader2 } from "lucide-react";
import { API_URL } from "@/lib/api";
import '@/styles/background.css';

/**
 * Homepage - Bold, High-Contrast Design
 * - Strong typography with Space Grotesk font
 * - High contrast black and white with bold colors
 * - Agent network visualization concept
 * - Asymmetric, dynamic layout
 */

interface Agent {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  shortDesc: string;
  capabilities: string[];
  useCases: string[];
  example: string;
}

const agents: Agent[] = [
  {
    id: "1",
    name: "Project Manager",
    icon: <Workflow className="w-6 h-6" />,
    color: "bg-blue-500",
    shortDesc: "Creates project plans and task breakdowns",
    capabilities: ["Task decomposition", "Effort estimation", "Dependency tracking", "Acceptance criteria"],
    useCases: ["Breaking projects into 3 concrete subtasks", "Defining priorities", "Setting dependencies"],
    example: "Analyzed 'build a weather dashboard' and created: HTML structure (10 min), CSS styling (15 min), JavaScript logic (25 min)",
  },
  {
    id: "2",
    name: "Engineer",
    icon: <Cpu className="w-6 h-6" />,
    color: "bg-purple-500",
    shortDesc: "Reviews plans for technical feasibility",
    capabilities: ["Technical review", "Architecture validation", "Blocker identification", "Best practices"],
    useCases: ["Reviewing PM plans", "Suggesting improvements", "Validating dependencies"],
    example: "Reviewed plan and suggested: 'Use CSS Grid for layout, debounce search input, add loading states for async operations'",
  },
  {
    id: "3",
    name: "Design Director",
    icon: <Zap className="w-6 h-6" />,
    color: "bg-red-500",
    shortDesc: "Creates design briefs for web projects",
    capabilities: ["Color schemes", "Typography", "Layout patterns", "Visual hierarchy"],
    useCases: ["Defining design system", "Establishing spacing", "Setting visual tone"],
    example: "Created brief: Light gradients (#f0f9ff to #e0f2fe), card-based layout, 8px grid system, subtle shadows",
  },
  {
    id: "4",
    name: "Frontend Agent",
    icon: <Network className="w-6 h-6" />,
    color: "bg-green-500",
    shortDesc: "Generates complete single-file web apps",
    capabilities: ["HTML structure", "CSS styling", "JavaScript logic", "LocalStorage persistence"],
    useCases: ["Calculators", "To-do lists", "Weather dashboards", "Landing pages"],
    example: "Built working weather dashboard with city search, forecast display, animated icons, and responsive design",
  },
  {
    id: "5",
    name: "Layout Agent",
    icon: <Workflow className="w-6 h-6" />,
    color: "bg-yellow-500",
    shortDesc: "Creates semantic HTML structure",
    capabilities: ["Semantic HTML5", "Accessibility", "Form structure", "Document organization"],
    useCases: ["Building HTML skeleton", "Setting up containers", "Creating forms"],
    example: "Generated calculator grid with buttons (0-9), operators (+, -, *, /), display field, and clear button",
  },
  {
    id: "6",
    name: "Styling Agent",
    icon: <TrendingUp className="w-6 h-6" />,
    color: "bg-pink-500",
    shortDesc: "Generates modern CSS with animations",
    capabilities: ["Flexbox/Grid layouts", "Responsive design", "Animations", "Color systems"],
    useCases: ["Creating card layouts", "Adding hover effects", "Mobile responsiveness"],
    example: "Applied gradient backgrounds, card shadows, smooth transitions, and mobile breakpoints for weather app",
  },
  {
    id: "7",
    name: "Logic Agent",
    icon: <Cpu className="w-6 h-6" />,
    color: "bg-indigo-500",
    shortDesc: "Implements JavaScript functionality",
    capabilities: ["Event handlers", "State management", "API integration", "Form validation"],
    useCases: ["Click handlers", "Data persistence", "Search functionality", "Error handling"],
    example: "Implemented city search with mock weather data, localStorage caching, loading states, and error messages",
  },
  {
    id: "8",
    name: "Backend Agent",
    icon: <Network className="w-6 h-6" />,
    color: "bg-orange-500",
    shortDesc: "Generates Node.js/Express APIs",
    capabilities: ["RESTful APIs", "Database models", "Authentication", "Request validation"],
    useCases: ["Creating API endpoints", "Database integration", "Middleware"],
    example: "Built Express server with /api/tasks endpoints (GET, POST, DELETE) and in-memory data storage",
  },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [projectInput, setProjectInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectInput.trim()) {
      setError("Please describe your project");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectInput.trim().substring(0, 50) || "New Project",
          description: projectInput.trim()
        }),
      });

      if (!response.ok) throw new Error("Failed to create project");
      const data = await response.json();

      // Redirect to dashboard with project ID
      setLocation(`/dashboard?projectId=${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="border-b-2 border-black sticky top-0 bg-white z-50">
        <div className="container flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold font-space-grotesk">MULTI-AGENT PM</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold">
            <a href="#agents" className="hover:text-red-500 transition-colors">
              AGENTS
            </a>
            <a href="#how" className="hover:text-red-500 transition-colors">
              HOW IT WORKS
            </a>
            <a href="#examples" className="hover:text-red-500 transition-colors">
              EXAMPLES
            </a>
          </nav>
          <button
            onClick={() => setLocation("/dashboard")}
            className="px-6 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
          >
            LAUNCH
          </button>
        </div>
      </header>

      {/* Hero Section - Bold & Asymmetric */}
      <section className="container py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left - Text */}
          <div className="space-y-8">
            <div>
              <div className="inline-block px-4 py-2 bg-black text-white font-bold text-xs mb-6 rounded-lg">
                MULTI-AGENT CODE GENERATION
              </div>
              <h1 className="text-7xl md:text-8xl font-bold leading-tight mb-6">
                Describe It.
                <br />
                <span className="text-red-500">Agents Build</span> It.
              </h1>
              <p className="text-xl text-gray-700 leading-relaxed mb-8 max-w-md">
                AI agents collaborate like a real dev team—planning, designing, coding, and testing. You get complete, working web applications in minutes.
              </p>
            </div>

            {/* Project Creation Form */}
            <form onSubmit={handleCreateProject} className="space-y-6 max-w-md">
              <div>
                <textarea
                  value={projectInput}
                  onChange={(e) => {
                    setProjectInput(e.target.value);
                    setError(null);
                  }}
                  placeholder="Describe your project (e.g., Create a calculator with basic operations, Build a weather dashboard with city search...)"
                  className="w-full p-4 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-medium resize-none"
                  rows={3}
                />
                {error && <p className="text-red-600 font-bold text-sm">{error}</p>}
              </div>

              {/* Quick Templates */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-600">QUICK START TEMPLATES:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProjectInput('Build a scientific calculator that can perform basic math operations (add, subtract, multiply, divide), plus advanced functions like square root, percentage, and power (exponent). Include a clear display for results, history of previous calculations, and clear/delete buttons.');
                      setError(null);
                    }}
                    className="px-3 py-2 border-2 border-black rounded-lg hover:bg-black hover:text-white transition-colors font-bold text-xs text-center"
                  >
                    🧮 Calculator
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectInput('Build a todo application with an input field to add new tasks, a list displaying all tasks, checkboxes to mark tasks as complete, delete buttons for each task, and a clear all completed button. Include localStorage persistence so tasks are saved across page refreshes.');
                      setError(null);
                    }}
                    className="px-3 py-2 border-2 border-black rounded-lg hover:bg-black hover:text-white transition-colors font-bold text-xs text-center"
                  >
                    ✅ Todo List
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectInput('Build a weather dashboard with a search input to find cities, display current weather with temperature and conditions, show a 7-day forecast, include weather icons, add loading states, and error handling for invalid locations.');
                      setError(null);
                    }}
                    className="px-3 py-2 border-2 border-black rounded-lg hover:bg-black hover:text-white transition-colors font-bold text-xs text-center"
                  >
                    🌤️ Weather
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProjectInput('Build an e-commerce shopping site with a product listing grid, product detail views, add to cart functionality, a shopping cart modal showing items and quantities, price totals, remove from cart buttons, and a checkout button with mock order processing.');
                      setError(null);
                    }}
                    className="px-3 py-2 border-2 border-black rounded-lg hover:bg-black hover:text-white transition-colors font-bold text-xs text-center"
                  >
                    🛍️ E-Commerce
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full px-8 py-4 bg-black text-white font-bold rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 text-lg disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    CREATING PROJECT...
                  </>
                ) : (
                  <>
                    CREATE PROJECT
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setLocation("/dashboard")}
                className="px-8 py-4 border-2 border-black text-black font-bold rounded-lg hover:bg-black hover:text-white transition-colors flex items-center justify-center gap-2 text-lg"
              >
                VIEW EXISTING PROJECTS
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Tech Stack */}
            <div className="flex flex-wrap gap-3 pt-8">
              <span className="px-3 py-1 bg-gray-100 text-black text-xs font-bold rounded-lg border-2 border-black">
                GEMINI 2.5 FLASH
              </span>
              <span className="px-3 py-1 bg-gray-100 text-black text-xs font-bold rounded-lg border-2 border-black">
                NODE.JS
              </span>
              <span className="px-3 py-1 bg-gray-100 text-black text-xs font-bold rounded-lg border-2 border-black">
                REACT
              </span>
              <span className="px-3 py-1 bg-gray-100 text-black text-xs font-bold rounded-lg border-2 border-black">
                POSTGRESQL
              </span>
              <span className="px-3 py-1 bg-gray-100 text-black text-xs font-bold rounded-lg border-2 border-black">
                WEBSOCKETS
              </span>
            </div>
          </div>

          {/* Right - Visual Network */}
          <div className="relative h-96 md:h-full hidden md:block">
            {/* Agent Network Visualization with Animations */}
            <style>{`
              @keyframes pulse-glow {
                0%, 100% { filter: drop-shadow(0 0 4px currentColor); }
                50% { filter: drop-shadow(0 0 12px currentColor); }
              }
              @keyframes pulse-line {
                0%, 100% { opacity: 0.3; stroke-width: 2; }
                50% { opacity: 0.8; stroke-width: 3; }
              }
              @keyframes float-up {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-8px); }
              }
              .agent-node-1 { animation: pulse-glow 2s ease-in-out infinite; }
              .agent-node-2 { animation: pulse-glow 2.5s ease-in-out infinite 0.3s; }
              .agent-node-3 { animation: pulse-glow 2s ease-in-out infinite 0.6s; }
              .agent-node-4 { animation: pulse-glow 2.5s ease-in-out infinite 0.9s; }
              .hub-node { animation: pulse-glow 1.5s ease-in-out infinite; }
              .connection-1 { animation: pulse-line 2s ease-in-out infinite; }
              .connection-2 { animation: pulse-line 2.5s ease-in-out infinite 0.3s; }
              .connection-3 { animation: pulse-line 2s ease-in-out infinite 0.6s; }
              .connection-4 { animation: pulse-line 2.5s ease-in-out infinite 0.9s; }
            `}</style>
            <svg className="w-full h-full" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
              {/* Animated connection lines */}
              <line className="connection-1" x1="100" y1="100" x2="200" y2="200" stroke="#3b82f6" strokeWidth="2" />
              <line className="connection-2" x1="300" y1="100" x2="200" y2="200" stroke="#ef4444" strokeWidth="2" />
              <line className="connection-3" x1="100" y1="300" x2="200" y2="200" stroke="#10b981" strokeWidth="2" />
              <line className="connection-4" x1="300" y1="300" x2="200" y2="200" stroke="#f59e0b" strokeWidth="2" />

              {/* Central hub with glow */}
              <g className="hub-node" style={{ color: '#1f2937' }}>
                <circle cx="200" cy="200" r="40" fill="#1f2937" stroke="#000" strokeWidth="2" />
                <circle cx="200" cy="200" r="45" fill="none" stroke="#1f2937" strokeWidth="1" opacity="0.5" />
              </g>
              <text x="200" y="210" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold">
                HUB
              </text>

              {/* Surrounding agents with glow */}
              <g className="agent-node-1" style={{ color: '#3b82f6' }}>
                <circle cx="100" cy="100" r="30" fill="#3b82f6" stroke="#000" strokeWidth="2" />
                <circle cx="100" cy="100" r="35" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.4" />
              </g>
              <text x="100" y="108" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">
                AI
              </text>

              <g className="agent-node-2" style={{ color: '#ef4444' }}>
                <circle cx="300" cy="100" r="30" fill="#ef4444" stroke="#000" strokeWidth="2" />
                <circle cx="300" cy="100" r="35" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.4" />
              </g>
              <text x="300" y="108" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">
                AI
              </text>

              <g className="agent-node-3" style={{ color: '#10b981' }}>
                <circle cx="100" cy="300" r="30" fill="#10b981" stroke="#000" strokeWidth="2" />
                <circle cx="100" cy="300" r="35" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.4" />
              </g>
              <text x="100" y="308" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">
                AI
              </text>

              <g className="agent-node-4" style={{ color: '#f59e0b' }}>
                <circle cx="300" cy="300" r="30" fill="#f59e0b" stroke="#000" strokeWidth="2" />
                <circle cx="300" cy="300" r="35" fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.4" />
              </g>
              <text x="300" y="308" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">
                AI
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* Agent Showcase Section - Interactive Cards */}
      <section id="agents" className="bg-gray-50 border-t-2 border-b-2 border-black py-20 md:py-32">
        <div className="container">
          <h2 className="text-6xl md:text-7xl font-bold mb-16">THE AGENT TEAM</h2>
          <p className="text-xl text-gray-700 font-medium mb-12 max-w-2xl">
            8 specialized AI agents that collaborate autonomously. Each handles a specific part of the development process. Click any card to see what they do.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                className="bold-card cursor-pointer transition-all duration-300 hover:shadow-lg"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`${agent.color} w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                      {agent.icon}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">{agent.name}</h3>
                      <p className="text-gray-600 font-medium text-sm">{agent.shortDesc}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${
                      expandedAgent === agent.id ? "rotate-180" : ""
                    }`}
                  />
                </div>

                {/* Expanded Content */}
                {expandedAgent === agent.id && (
                  <div className="border-t-2 border-gray-200 pt-6 space-y-6 animate-in fade-in duration-300">
                    {/* Capabilities */}
                    <div>
                      <h4 className="font-bold text-sm text-gray-600 mb-3 uppercase">Capabilities</h4>
                      <div className="flex flex-wrap gap-2">
                        {agent.capabilities.map((cap, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-black text-white text-xs font-bold rounded-lg"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Use Cases */}
                    <div>
                      <h4 className="font-bold text-sm text-gray-600 mb-3 uppercase">Use Cases</h4>
                      <ul className="space-y-2">
                        {agent.useCases.map((useCase, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-red-500 font-bold mt-1">•</span>
                            <span>{useCase}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Example */}
                    <div className="bg-gray-100 border-l-4 border-black p-4 rounded-lg">
                      <h4 className="font-bold text-xs text-gray-600 mb-2 uppercase">Real Example</h4>
                      <p className="text-sm text-gray-700 italic">"{agent.example}"</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="bg-black text-white border-t-2 border-b-2 border-white py-20 md:py-32">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left - Text */}
            <div className="space-y-6">
              <h2 className="text-6xl md:text-7xl font-bold mb-6">REAL-TIME VISIBILITY</h2>
              <div className="h-1 w-20 bg-red-500 rounded-full mb-8"></div>
              <p className="text-xl text-gray-300 leading-relaxed mb-8">
                Unlike black-box AI tools, you see exactly what's happening. Watch agents plan, collaborate, and build your application in real-time.
              </p>
              <ul className="space-y-4 text-lg text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-2xl mt-1">→</span>
                  <span>Live activity feed with agent updates</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-2xl mt-1">→</span>
                  <span>Task progress tracking (0-100%)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 font-bold text-2xl mt-1">→</span>
                  <span>Streaming output from PM and Engineer</span>
                </li>
              </ul>
            </div>

            {/* Right - Video Placeholder */}
            <div className="relative group">
              <div
                onClick={() => setLocation("/dashboard")}
                className="bold-card bg-gray-900 border-2 border-white aspect-video flex items-center justify-center overflow-hidden cursor-pointer hover:border-red-500 transition-colors"
              >
                {/* Animated background grid */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(255,0,0,.05) 25%, rgba(255,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(255,0,0,.05) 75%, rgba(255,0,0,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255,0,0,.05) 25%, rgba(255,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(255,0,0,.05) 75%, rgba(255,0,0,.05) 76%, transparent 77%, transparent)',
                    backgroundSize: '50px 50px'
                  }}></div>
                </div>

                {/* Play button */}
                <div className="relative z-10 flex flex-col items-center gap-6">
                  <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Play className="w-12 h-12 text-white ml-1" />
                  </div>
                  <p className="text-white font-bold text-lg text-center">GO TO DASHBOARD</p>
                </div>

                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-red-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
              </div>
              <p className="text-sm text-gray-400 mt-4 text-center">Go to Dashboard to see agents in action</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Bold Timeline */}
      <section id="how" className="container py-20 md:py-32">
        <h2 className="text-6xl md:text-7xl font-bold mb-16">HOW IT WORKS</h2>

        <div className="space-y-8">
          {/* Step 1 */}
          <div className="flex gap-8 items-start">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-black text-white font-bold text-2xl rounded-lg flex items-center justify-center">
                1
              </div>
            </div>
            <div className="flex-1 pt-2">
              <h3 className="text-3xl font-bold mb-3">PHASE 1: PLANNING</h3>
              <p className="text-lg text-gray-700">
                Design Director creates a design brief. PM Agent breaks your project into 3 concrete tasks. Engineer Agent reviews for technical feasibility. Tasks are finalized with dependencies and priorities.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-8 border-l-2 border-black ml-8"></div>

          {/* Step 2 */}
          <div className="flex gap-8 items-start">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-red-500 text-white font-bold text-2xl rounded-lg flex items-center justify-center">
                2
              </div>
            </div>
            <div className="flex-1 pt-2">
              <h3 className="text-3xl font-bold mb-3">PHASE 2: PREPARATION</h3>
              <p className="text-lg text-gray-700">
                Tasks are saved to the database with dependency tracking. All specialized agents (Layout, Styling, Logic, Frontend, Backend) start listening for work. System ready for autonomous execution.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-8 border-l-2 border-black ml-8"></div>

          {/* Step 3 */}
          <div className="flex gap-8 items-start">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-blue-500 text-white font-bold text-2xl rounded-lg flex items-center justify-center">
                3
              </div>
            </div>
            <div className="flex-1 pt-2">
              <h3 className="text-3xl font-bold mb-3">PHASE 3: EXECUTION</h3>
              <p className="text-lg text-gray-700">
                Agents autonomously claim tasks when dependencies are met. Layout builds HTML structure, Styling adds CSS, Logic implements JavaScript. Watch real-time progress via WebSocket updates. Download your complete app when done.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Bold */}
      <section id="examples" className="bg-black text-white border-t-2 border-black py-20 md:py-32">
        <div className="container text-center">
          <h2 className="text-6xl md:text-7xl font-bold mb-8">READY TO BUILD?</h2>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Create calculators, weather dashboards, to-do lists, and more. Describe your idea and watch the agents build it.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setLocation("/dashboard")}
              className="px-8 py-4 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors text-lg"
            >
              CREATE A PROJECT
            </button>
            <button
              onClick={() => setLocation("/dashboard")}
              className="px-8 py-4 border-2 border-white text-white font-bold rounded-lg hover:bg-white hover:text-black transition-colors text-lg"
            >
              VIEW EXISTING PROJECTS
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-black bg-white">
        <div className="container py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold">MULTI-AGENT PM</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-gray-600 font-medium mb-2">
                Multi-agent code generation platform powered by Google Gemini 2.5 Flash
              </p>
              <p className="text-xs text-gray-500 font-medium">
                Built with TypeScript, React, Node.js, PostgreSQL, and WebSockets
              </p>
            </div>
          </div>
          <div className="border-t-2 border-black mt-8 pt-8 text-center text-sm text-gray-600 font-medium">
            <p>&copy; 2026 Multi-Agent PM. Personal development project.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
