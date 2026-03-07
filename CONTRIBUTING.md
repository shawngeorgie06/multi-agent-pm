# Contributing to Multi-Agent PM

Thank you for your interest in contributing! This is a personal learning project, but contributions are welcome.

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug:

1. **Check existing issues** to see if it's already reported
2. **Create a new issue** with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node version, Docker version)
   - Error messages and logs

### Suggesting Features

For feature suggestions:

1. **Check existing issues** for similar requests
2. **Create a new issue** describing:
   - The problem your feature solves
   - How it should work
   - Why it would be valuable
   - Any implementation ideas (optional)

### Code Contributions

#### Before Starting

1. **Open an issue** to discuss your proposed changes
2. **Wait for feedback** before investing significant time
3. **Keep changes focused** - one feature/fix per PR

#### Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/multi-agent-pm.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Follow the setup guide in [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)

#### Code Standards

**TypeScript:**
- Use strict type checking
- No `any` types (use `unknown` or proper types)
- Follow existing code style
- Add JSDoc comments for public APIs

**Git Commits:**
- Use clear, descriptive commit messages
- Format: `type(scope): description`
- Examples:
  - `feat(agents): add retry logic to task claiming`
  - `fix(frontend): resolve WebSocket reconnection issue`
  - `docs(readme): update setup instructions`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code restructuring (no behavior change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

#### Testing

- Ensure the app builds: `npm run build` (both frontend and backend)
- Test your changes manually
- Verify no console errors in browser DevTools
- Check that existing functionality still works

#### Pull Request Process

1. **Update documentation** if you've changed functionality
2. **Test thoroughly** on your local setup
3. **Create a PR** with:
   - Clear description of changes
   - Link to related issue(s)
   - Screenshots/GIFs if UI changed
   - List of testing steps

4. **Respond to feedback** and make requested changes
5. **Squash commits** if requested before merging

### Areas That Need Help

Current priorities:

1. **Testing:** Unit tests for core services
2. **Error Handling:** Better error messages and recovery
3. **Documentation:** Code comments, architecture guides
4. **Performance:** Optimize agent execution time
5. **Features:**
   - React/Next.js project generation
   - Multi-page application support
   - Iterative code editing
   - Better code quality validation

## 📋 Code of Conduct

### Our Standards

- **Be respectful** - treat everyone with respect
- **Be constructive** - provide helpful feedback
- **Be patient** - remember this is a learning project
- **Be collaborative** - work together toward improvements

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Publishing others' private information
- Spam or off-topic discussions

## 🐛 Known Issues

See [GitHub Issues](https://github.com/shawngeorgie06/multi-agent-pm/issues) for current known issues.

## 📝 Development Notes

### Project Structure

```
multi-agent-pm/
├── backend/              # Node.js + TypeScript backend
│   ├── src/
│   │   ├── agents/      # Agent implementations
│   │   ├── services/    # Core services (orchestration, task queue, etc.)
│   │   ├── database/    # Prisma DB client
│   │   └── server.ts    # Express server + WebSocket
│   └── prisma/          # Database schema
├── frontend/            # React + TypeScript frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities
└── docs/                # Documentation and internal notes
```

### Adding New Agents

1. Create agent class in `backend/src/agents/`
2. Extend `BaseAgent` for MessageBus support
3. Register in `AgentOrchestrator.ts`
4. Add capabilities to agent constructor
5. Update documentation

### Modifying Agent Prompts

Agent prompts are in their respective files:
- `FrontendAgent.ts` - Single-file app generation
- `LayoutAgent.ts` - HTML structure
- `StylingAgent.ts` - CSS implementation
- `LogicAgent.ts` - JavaScript logic

Edit the `systemPrompt` or generation methods to change behavior.

## 💬 Questions?

- **General questions:** Open a GitHub Discussion
- **Bug reports:** Create an issue
- **Security concerns:** See [SECURITY.md](SECURITY.md)

## 🙏 Thank You!

Every contribution helps make this project better. Whether it's:
- Reporting a bug
- Suggesting a feature
- Improving documentation
- Contributing code

Your time and effort are appreciated! 🎉
