import { TEMPLATES } from './templates.js';
import { TemplateConfig } from './types.js';

/**
 * Detect the best matching template based on project description
 * @param projectDescription - Description of the project/app to build
 * @returns Matching TemplateConfig or null if no match found
 */
export function detectTemplate(projectDescription: string): TemplateConfig | null {
  if (!projectDescription || projectDescription.trim().length === 0) {
    return null;
  }

  const description = projectDescription.toLowerCase();

  // Find first template that matches any of its patterns
  for (const template of TEMPLATES) {
    for (const pattern of template.patterns) {
      if (pattern.test(description)) {
        return template;
      }
    }
  }

  return null;
}

/**
 * Get all available templates
 * @returns Array of all TemplateConfig objects
 */
export function getAllTemplates(): TemplateConfig[] {
  return TEMPLATES;
}

/**
 * Get template by ID
 * @param id - Template ID
 * @returns TemplateConfig or null if not found
 */
export function getTemplateById(id: string): TemplateConfig | null {
  return TEMPLATES.find(t => t.id === id) || null;
}

/**
 * Get templates by category
 * @param category - Category name
 * @returns Array of templates in that category
 */
export function getTemplatesByCategory(
  category: 'utility' | 'productivity' | 'game' | 'analytics' | 'api'
): TemplateConfig[] {
  return TEMPLATES.filter(t => t.category === category);
}

/**
 * Search templates by name or description
 * @param query - Search query
 * @returns Array of matching templates
 */
export function searchTemplates(query: string): TemplateConfig[] {
  const q = query.toLowerCase();
  return TEMPLATES.filter(
    t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
  );
}

/**
 * Get template counts by category
 * @returns Object with category counts
 */
export function getTemplateCounts(): Record<string, number> {
  const counts: Record<string, number> = {
    utility: 0,
    productivity: 0,
    game: 0,
    analytics: 0,
    api: 0,
  };

  for (const template of TEMPLATES) {
    counts[template.category]++;
  }

  return counts;
}
