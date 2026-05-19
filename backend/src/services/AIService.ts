export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerDay: number;
  minIntervalMs: number;
  maxRetries: number;
}

export interface AIService {
  readonly providerName: string;
  readonly modelName: string;
  generate(prompt: string): Promise<string>;
  streamGenerate(prompt: string, onChunk: (chunk: string) => void): Promise<string>;
}
