export interface TemplateConfig {
  id: string;
  name: string;
  category: 'utility' | 'productivity' | 'game' | 'analytics' | 'api';
  patterns: RegExp[];
  description: string;
  html: string;
  css: string;
  js: string;
}
