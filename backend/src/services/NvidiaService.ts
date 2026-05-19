import https from 'https';
import { AIService, RateLimitConfig } from './AIService.js';

export interface NvidiaOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoningBudget?: number;
}

interface QueuedRequest {
  prompt: string;
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
}

const agent = new https.Agent({ rejectUnauthorized: false });

export class NvidiaService implements AIService {
  readonly providerName = 'nvidia';
  readonly modelName: string;

  private readonly endpoint = 'https://integrate.api.nvidia.com/v1';
  private readonly MAX_RETRIES: number;
  private readonly MIN_REQUEST_INTERVAL: number;

  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;

  constructor(
    private apiKey: string,
    modelName: string = 'deepseek-ai/deepseek-v4-pro',
    private options: NvidiaOptions = {},
    rateLimitConfig?: Partial<RateLimitConfig>
  ) {
    this.modelName = modelName;
    this.MAX_RETRIES          = rateLimitConfig?.maxRetries    ?? 5;
    this.MIN_REQUEST_INTERVAL = rateLimitConfig?.minIntervalMs ?? 500;
    console.log(`[NvidiaService] Initialized with model: ${modelName}`);
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

  private makeRequest(prompt: string, retries = 0): Promise<string> {
    console.log(`[NvidiaService] Request (attempt ${retries + 1}/${this.MAX_RETRIES + 1})`);

    const body = JSON.stringify({
      model: this.modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.options.temperature ?? 1,
      top_p: this.options.topP ?? 0.95,
      max_tokens: this.options.maxTokens ?? 16384,
      stream: false,
      chat_template_kwargs: { thinking: false },
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        `${this.endpoint}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          agent,
        },
        (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', async () => {
            if (res.statusCode && res.statusCode >= 400) {
              const msg = `[${res.statusCode}] ${data}`;
              console.error(`[NvidiaService] API error: ${msg}`);
              if ((res.statusCode === 429 || res.statusCode >= 500) && retries < this.MAX_RETRIES) {
                const delay = Math.pow(2, retries) * 1000;
                console.log(`[NvidiaService] Retrying in ${delay / 1000}s…`);
                await new Promise(r => setTimeout(r, delay));
                this.makeRequest(prompt, retries + 1).then(resolve).catch(reject);
                return;
              }
              reject(new Error(`NVIDIA API error: ${msg}`));
              return;
            }
            try {
              const parsed = JSON.parse(data) as any;
              const content: string = parsed.choices?.[0]?.message?.content;
              if (!content) { reject(new Error('Empty response from NVIDIA API')); return; }
              console.log(`[NvidiaService] Success — ${content.length} chars`);
              resolve(content);
            } catch (e) {
              reject(new Error(`Failed to parse NVIDIA response: ${e}`));
            }
          });
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  getInfo(): string {
    return `NVIDIA (${this.modelName})`;
  }
}
