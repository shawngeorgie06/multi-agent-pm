# Security Policy

## Reporting Security Issues

If you discover a security vulnerability in this project, please report it by emailing shawngeorgie16@gmail.com.

**Please do not create public GitHub issues for security vulnerabilities.**

## Security Best Practices

### API Keys and Secrets

1. **Never commit API keys** to version control
2. Always use `.env.example` as a template
3. Keep your `.env` file in `.gitignore`
4. Rotate API keys if accidentally exposed

### If You Accidentally Commit an API Key

1. **Immediately revoke the exposed key** at the provider's console:
   - Google Gemini: https://aistudio.google.com/apikey

2. **Generate a new key** and update your local `.env` file

3. **Remove the key from git history**:
   ```bash
   # Option 1: Using BFG Repo-Cleaner (recommended)
   bfg --replace-text passwords.txt
   git push --force

   # Option 2: Using git filter-branch
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch backend/.env" \
     --prune-empty --tag-name-filter cat -- --all
   git push --force
   ```

### Database Security

- Default PostgreSQL credentials are for **local development only**
- For production deployments:
  - Use strong, unique passwords
  - Enable SSL/TLS connections
  - Restrict network access
  - Use environment-specific credentials

### Code Execution

This system executes AI-generated code. When deploying:
- Run in sandboxed environments
- Implement rate limiting
- Monitor for malicious patterns
- Review generated code before production use

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Updates

This is a personal development project. Security updates will be applied on a best-effort basis.
