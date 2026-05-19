import { AIService, RateLimitConfig } from './AIService.js';

export interface GitHubModelsOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

interface QueuedRequest {
  prompt: string;
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
}

export class GitHubModelsService implements AIService {
  readonly providerName = 'github';
  readonly modelName: string;

  private apiKey: string;
  private apiEndpoint: string;
  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;

  private readonly MIN_REQUEST_INTERVAL: number;
  private readonly MAX_RETRIES: number;

  constructor(
    apiKey: string,
    modelName: string = 'gpt-4o',
    apiEndpoint: string = 'https://models.inference.ai.azure.com',
    private options: GitHubModelsOptions = {},
    rateLimitConfig?: Partial<RateLimitConfig>
  ) {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.apiEndpoint = apiEndpoint;
    this.MIN_REQUEST_INTERVAL = rateLimitConfig?.minIntervalMs ?? 500;
    this.MAX_RETRIES          = rateLimitConfig?.maxRetries    ?? 3;

    console.log(`[GitHubModelsService] Initialized with model: ${modelName}`);
    console.log(`[GitHubModelsService] Endpoint: ${apiEndpoint}`);
  }

  async generate(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ prompt, resolve, reject });
      this.processQueue();
    });
  }

  async streamGenerate(prompt: string, onChunk: (chunk: string) => void): Promise<string> {
    const result = await this.generate(prompt);
    onChunk(result);
    return result;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) break;

      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        await new Promise(r => setTimeout(r, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest));
      }
      this.lastRequestTime = Date.now();

      try {
        request.resolve(await this.makeRequest(request.prompt));
      } catch (error) {
        request.reject(error);
      }
    }

    this.isProcessing = false;
  }

  private async makeRequest(prompt: string, retries = 0): Promise<string> {
    console.log(`[GitHubModelsService] Making request (attempt ${retries + 1}/${this.MAX_RETRIES + 1})`);

    try {
      const response = await fetch(`${this.apiEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [{ role: 'user', content: prompt }],
          temperature: this.options.temperature ?? 0.7,
          max_tokens: this.options.maxTokens ?? 2000,
          top_p: this.options.topP ?? 0.95,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        const errorMsg = `[${response.status}] ${response.statusText}: ${errorData}`;
        console.error(`[GitHubModelsService] API Error:`, errorMsg);

        if ((response.status === 429 || response.status >= 500) && retries < this.MAX_RETRIES) {
          const delayMs = Math.pow(2, retries) * 1000;
          console.log(`[GitHubModelsService] Retrying in ${delayMs}ms...`);
          await new Promise(r => setTimeout(r, delayMs));
          return this.makeRequest(prompt, retries + 1);
        }
        throw new Error(`GitHub Models API error: ${errorMsg}`);
      }

      const data = (await response.json()) as any;
      if (!data.choices?.[0]?.message) throw new Error('Invalid response format from GitHub Models API');

      const content: string = data.choices[0].message.content;
      console.log(`[GitHubModelsService] Request successful, generated ${content.length} characters`);
      return content;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[GitHubModelsService] Error:`, errorMsg);

      if (retries < this.MAX_RETRIES && this.isNetworkError(error)) {
        const delayMs = Math.pow(2, retries) * 1000;
        console.log(`[GitHubModelsService] Network error, retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
        return this.makeRequest(prompt, retries + 1);
      }
      throw error;
    }
  }

  private isNetworkError(error: any): boolean {
    const errorMsg = error?.message?.toLowerCase() || '';
    return (
      errorMsg.includes('econnrefused') ||
      errorMsg.includes('enotfound') ||
      errorMsg.includes('etimedout') ||
      errorMsg.includes('network')
    );
  }

  getInfo(): string {
    return `GitHub Models (${this.modelName})`;
  }
}
