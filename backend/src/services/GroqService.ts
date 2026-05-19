import { AIService, RateLimitConfig } from './AIService.js';

export interface GroqOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

interface QueuedRequest {
  prompt: string;
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
}

export class GroqService implements AIService {
  readonly providerName = 'groq';
  readonly modelName: string;

  private readonly endpoint = 'https://api.groq.com/openai/v1';
  private readonly MAX_RETRIES: number;
  private readonly MIN_REQUEST_INTERVAL: number;

  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;

  constructor(
    private apiKey: string,
    modelName: string = 'llama-3.3-70b-versatile',
    private options: GroqOptions = {},
    rateLimitConfig?: Partial<RateLimitConfig>
  ) {
    this.modelName = modelName;
    this.MAX_RETRIES           = rateLimitConfig?.maxRetries    ?? 5;
    this.MIN_REQUEST_INTERVAL  = rateLimitConfig?.minIntervalMs ?? 500;
    console.log(`[GroqService] Initialized with model: ${modelName}`);
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

      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < this.MIN_REQUEST_INTERVAL) {
        await new Promise(r => setTimeout(r, this.MIN_REQUEST_INTERVAL - elapsed));
      }
      this.lastRequestTime = Date.now();

      try {
        request.resolve(await this.makeRequest(request.prompt));
      } catch (err) {
        request.reject(err);
      }
    }

    this.isProcessing = false;
  }

  private parseRetryAfterMs(errorText: string): number {
    const match = errorText.match(/try again in ([\d.]+)s/i);
    if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 2000;
    return 45000;
  }

  private async makeRequest(prompt: string, retries = 0): Promise<string> {
    console.log(`[GroqService] Request (attempt ${retries + 1}/${this.MAX_RETRIES + 1})`);

    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.options.temperature ?? 0.7,
        max_tokens: this.options.maxTokens ?? 6000,
        top_p: this.options.topP ?? 0.95,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const msg = `[${response.status}] ${errorText}`;
      console.error(`[GroqService] API error: ${msg}`);

      if ((response.status === 429 || response.status >= 500) && retries < this.MAX_RETRIES) {
        const delay = response.status === 429
          ? this.parseRetryAfterMs(errorText)
          : Math.pow(2, retries) * 1000;
        console.log(`[GroqService] Rate limited — waiting ${Math.round(delay / 1000)}s before retry…`);
        await new Promise(r => setTimeout(r, delay));
        return this.makeRequest(prompt, retries + 1);
      }
      throw new Error(`Groq API error: ${msg}`);
    }

    const data = (await response.json()) as any;
    const content: string = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from Groq API');

    console.log(`[GroqService] Success — ${content.length} chars`);
    return content;
  }

  getInfo(): string {
    return `Groq (${this.modelName})`;
  }
}
