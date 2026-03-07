# AgentPM UI Improvement Ideas

The UI has been redesigned to match the dark mode SaaS dashboard spec. Here are ideas for further improvements:

## Completed in This Redesign
- **Global styles**: AgentPM design tokens (#0a0a0f bg, #6366f1 primary, Inter + JetBrains Mono)
- **Layout**: Top nav (48px), left sidebar (240px), main panel (flex), right panel (340px)
- **Top nav**: AgentPM wordmark, breadcrumb, search placeholder, notification bell, avatar
- **Left sidebar**: Projects list with pin/delete, Agents section (PM/EN status), bottom nav, New Project button
- **Main panel**: Kanban board (Backlog, In Progress, In Review, Done) with task cards
- **Right panel**: Task detail (Description, Preview, Code tabs) + Message Log (API-style event cards)
- **Task cards**: Priority tags (P1/P2/P3), agent badges, hover states, selected state with accent pulse
- **Message log**: Structured blocks with colored left border, monospace timestamps, sender labels

---

## Future Improvement Ideas

### 1. **Collapsible Right Panel**
- Add a chevron to collapse/expand the right panel (as specified)
- Remember collapsed state in localStorage
- When collapsed, show a slim strip with "Message Log" tab to expand on click

### 2. **Search**
- Wire up the search bar to filter tasks by title/description
- Add keyboard shortcut (Cmd/Ctrl+K) to focus search

### 3. **Filter & Sort**
- Implement the Filter button: filter by priority, status, assigned agent
- Implement the Sort button: sort by priority, date, status
- Persist filter/sort preferences per project

### 4. **List View**
- The Board/List toggle exists but List view is not implemented
- Add a compact list view with sortable columns

### 5. **Agent Status Live Updates**
- Show real agent status (Active/Busy) based on streaming state
- Add subtle pulse animation on status dots when agents are working
- Show "Running subtask" or current task name when applicable

### 6. **Task Assignment**
- Allow assigning tasks to PM vs Engineer (or future agents)
- Show assignee in task cards and detail panel

### 7. **Subtasks Checklist**
- Parse or generate subtasks from agent output
- Show checklist in task detail (✅ Audit old NavBar, ⬜ Implement responsive)

### 8. **Keyboard Shortcuts**
- `N` - New project
- `Esc` - Deselect task / close modals
- `?` - Show shortcuts overlay

### 9. **Empty States**
- Improve empty column states with "+ Add task" CTA
- Better empty state for "Select a task" in right panel

### 10. **Responsive Design**
- Sidebar collapses to hamburger on mobile
- Right panel becomes a slide-over drawer on smaller screens
- Kanban columns scroll horizontally on narrow viewports

### 11. **Drag & Drop**
- Allow dragging tasks between Kanban columns to update status
- Persist status changes to backend

### 12. **Real-time Collaboration**
- Show when another user (if multi-user) is viewing the same project
- Optimistic updates for task changes

### 13. **Export**
- Add Export to the main board header (Markdown, JSON)
- Export single task or full project

### 14. **Settings Page**
- Model selection (Ollama model picker)
- Theme fine-tuning (if light mode is ever added)
- Notification preferences

### 15. **Dashboard Page**
- Overview of all projects with status
- Quick stats: tasks completed, agents active, recent activity
