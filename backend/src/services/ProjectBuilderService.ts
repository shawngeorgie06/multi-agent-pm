import fs from 'fs/promises';
import path from 'path';
import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import prisma from '../database/db.js';
import { stripCodeFences } from '../utils/codeExtraction.js';
import { reconcileVisibilityContract } from '../utils/visibilityReconciliation.js';

export const APPS_DIR = path.join(os.homedir(), 'multi-agent-pm', 'generated-apps');

const execFileAsync = promisify(execFile);
const runningProcesses = new Map<string, { process: ChildProcess; port: number }>();
let nextPort = 4001;

export class ProjectBuilderService {
  private static instance: ProjectBuilderService;

  static getInstance(): ProjectBuilderService {
    if (!ProjectBuilderService.instance) {
      ProjectBuilderService.instance = new ProjectBuilderService();
    }
    return ProjectBuilderService.instance;
  }

  allocatePort(): number {
    return nextPort++;
  }

  async buildAndServe(
    projectId: string,
    html: string,
    css: string,
    js: string,
    backendCode?: string,
    backendPort?: number
  ): Promise<{ appUrl: string; backendUrl?: string }> {
    const projectDir = path.join(APPS_DIR, projectId);
    await fs.mkdir(projectDir, { recursive: true });

    const assembled = this.assembleHtml(html, css, js);
    await fs.writeFile(path.join(projectDir, 'index.html'), assembled, 'utf-8');

    let backendUrl: string | undefined;

    if (backendCode && backendPort) {
      const backendDir = path.join(projectDir, 'backend');
      await fs.mkdir(backendDir, { recursive: true });

      await fs.writeFile(path.join(backendDir, 'server.js'), backendCode, 'utf-8');
      await fs.writeFile(
        path.join(backendDir, 'package.json'),
        JSON.stringify(
          {
            name: `app-${projectId.substring(0, 8)}`,
            version: '1.0.0',
            main: 'server.js',
            dependencies: { ws: '^8.17.0', express: '^4.18.0', cors: '^2.8.5' },
          },
          null,
          2
        ),
        'utf-8'
      );

      const started = await this.startBackend(projectId, backendDir, backendPort);
      if (started) backendUrl = `http://localhost:${backendPort}`;
    }

    await prisma.project.update({ where: { id: projectId }, data: { status: 'completed' } });

    return { appUrl: `/apps/${projectId}/index.html`, backendUrl };
  }

  private async startBackend(projectId: string, backendDir: string, port: number): Promise<boolean> {
    try {
      const isWin = process.platform === 'win32';
      const npmBin = isWin ? 'npm.cmd' : 'npm';

      console.log(`[ProjectBuilder] Installing deps for ${projectId.substring(0, 8)}...`);
      await execFileAsync(npmBin, ['install', '--prefer-offline'], {
        cwd: backendDir,
        timeout: 60_000,
      });

      console.log(`[ProjectBuilder] Starting backend on port ${port}...`);
      const proc = spawn(process.execPath, ['server.js'], {
        cwd: backendDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      proc.stdout?.on('data', (d) =>
        console.log(`[App:${projectId.substring(0, 8)}] ${String(d).trim()}`)
      );
      proc.stderr?.on('data', (d) =>
        console.error(`[App:${projectId.substring(0, 8)}] ERR: ${String(d).trim()}`)
      );

      runningProcesses.set(projectId, { process: proc, port });
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    } catch (err) {
      console.error(`[ProjectBuilder] Backend start failed:`, err);
      return false;
    }
  }

  stopProject(projectId: string): void {
    const entry = runningProcesses.get(projectId);
    if (entry) {
      entry.process.kill();
      runningProcesses.delete(projectId);
    }
  }

  private assembleHtml(html: string, css: string, js: string): string {
    // Final safety net: strip any markdown fences that slipped through upstream
    // so a literal ```css / ```html can never end up inside the generated page.
    html = stripCodeFences(html);
    css = stripCodeFences(css);
    js = stripCodeFences(js);

    // Close the serial-pipeline contract gap: Styling runs before Logic and can't
    // know which elements Logic will toggle, so the JS sometimes reveals an element
    // the CSS never hid (or flips a class the CSS never defined). Guarantee the CSS
    // supports whatever show/hide the JS actually does. Acts only on strong evidence.
    const reconciled = reconcileVisibilityContract({ html, css, js });
    css = reconciled.css;
    if (reconciled.changes.length) {
      console.log(`[ProjectBuilder] visibility reconciliation: ${reconciled.changes.join('; ')}`);
    }

    const body = html
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<html[^>]*>/gi, '')
      .replace(/<\/html>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<body[^>]*>/gi, '')
      .replace(/<\/body>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .trim();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated App</title>
  <style>
${css}
  </style>
</head>
<body>
${body}
<script>
${js}
</script>
</body>
</html>`;
  }
}
