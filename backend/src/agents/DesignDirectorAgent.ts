import { OllamaService, type OllamaOptions } from '../services/OllamaService.js';
import { GeminiService } from '../services/GeminiService.js';

export interface DesignBrief {
  aesthetic: string;
  typography: string;
  colorPalette: string;
  motionAndEffects: string;
  designTokens: string;
  raw: string;
}

export class DesignDirectorAgent {
  private generationService: OllamaService | GeminiService;

  constructor(service: OllamaService | GeminiService) {
    this.generationService = service;
  }

  /**
   * Create a design brief for a web project before planning begins.
   * Ensures visual consistency and avoids bland, generic aesthetics.
   */
  async createDesignBrief(projectDescription: string): Promise<DesignBrief> {
    const prompt = `You are a Design Director. Before any code is written, you define the visual direction for web projects.

The user wants: "${projectDescription}"

Create a concise design brief that will guide Layout, Styling, and Logic agents. Output in this exact format:

**AESTHETIC:** [One bold direction: e.g. "Retro 1970s calculator", "Brutalist high-contrast", "Glassmorphism soft", "Editorial magazine", "Playful toy-like", "Minimal Japanese"]
**TYPOGRAPHY:** [Font choices - avoid Inter, Roboto, Arial. Use distinctive fonts from Google Fonts. e.g. "JetBrains Mono for display, DM Sans for body"]
**COLOR_PALETTE:** [Dominant + accent colors. Avoid purple-on-white gradients. e.g. "Dark #1a1a2e background, warm amber #ff9f43 accent, off-white #f5f5dc text"]
**MOTION:** [One key animation or micro-interaction. e.g. "Staggered button reveal on load, subtle hover scale"]
**DESIGN_TOKENS:** [Element IDs and classes for consistency. e.g. "display: id=display, buttons: class=calc-btn, container: id=calculator, number keys: class=num-btn, operator keys: class=op-btn"]

Be bold and specific. Make it memorable. No generic AI aesthetics.`;

    const response = await this.generationService.generate(prompt);

    return this.parseDesignBrief(response);
  }

  private parseDesignBrief(raw: string): DesignBrief {
    const getSection = (key: string): string => {
      const regex = new RegExp(`\\*\\*${key}\\*\\*:?\\s*([^\n*]+)`, 'i');
      const match = raw.match(regex);
      return match ? match[1].trim() : '';
    };

    return {
      aesthetic: getSection('AESTHETIC') || 'Clean, distinctive, memorable',
      typography: getSection('TYPOGRAPHY') || 'Distinctive font pairing',
      colorPalette: getSection('COLOR_PALETTE') || 'Cohesive palette with accent',
      motionAndEffects: getSection('MOTION') || 'Subtle hover and focus states',
      designTokens: getSection('DESIGN_TOKENS') || 'display: id=display, buttons: class=calc-btn, container: id=calculator',
      raw,
    };
  }
}
