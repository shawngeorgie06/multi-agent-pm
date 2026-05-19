/**
 * Gemini API Service
 * Replaces OllamaService for cloud-based code generation
 * Includes rate limiting and queue management for free tier API quotas
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIService, RateLimitConfig } from './AIService.js';

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

interface QueuedRequest {
  prompt: string;
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
  retries: number;
}

export class GeminiService implements AIService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  readonly providerName = 'gemini';
  private _modelName: string;

  get modelName(): string {
    return this._modelName;
  }

  // Rate limiting
  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private requestsThisMinute = 0;
  private requestsThisDay = 0;
  private dayResetInterval!: ReturnType<typeof setInterval>;
  private minuteResetInterval!: ReturnType<typeof setInterval>;

  // Quotas (free tier limits)
  private MAX_REQUESTS_PER_MINUTE: number;
  private MAX_REQUESTS_PER_DAY: number;
  private MIN_REQUEST_INTERVAL: number;
  private MAX_RETRIES: number;
  private readonly RESET_MINUTE = 60000; // 1 minute
  private readonly RESET_DAY = 86400000; // 24 hours

  constructor(
    apiKey: string,
    modelName: string = 'gemini-2.0-flash',
    private options: GeminiOptions = {},
    rateLimitConfig?: Partial<RateLimitConfig>
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this._modelName = modelName;
    this.model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 2000,
        topP: options.topP ?? 0.95,
        topK: options.topK ?? 40,
      },
    });

    // Initialize rate limit configuration
    this.MAX_REQUESTS_PER_MINUTE = rateLimitConfig?.maxRequestsPerMinute ?? 4;
    this.MAX_REQUESTS_PER_DAY = rateLimitConfig?.maxRequestsPerDay ?? 18;
    this.MIN_REQUEST_INTERVAL = rateLimitConfig?.minIntervalMs ?? 15000;
    this.MAX_RETRIES = rateLimitConfig?.maxRetries ?? 5;

    // Reset counters daily and per-minute
    this.dayResetInterval = setInterval(() => {
      this.requestsThisDay = 0;
      console.log('[GeminiService] Daily quota reset');
    }, this.RESET_DAY);

    this.minuteResetInterval = setInterval(() => {
      this.requestsThisMinute = 0;
    }, this.RESET_MINUTE);
  }

  shutdown(): void {
    clearInterval(this.dayResetInterval);
    clearInterval(this.minuteResetInterval);
  }

  /**
   * Generate text from a prompt with rate limiting queue
   */
  async generate(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        prompt,
        resolve,
        reject,
        retries: 0,
      });
      this.processQueue();
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      // Check daily quota
      if (this.requestsThisDay >= this.MAX_REQUESTS_PER_DAY) {
        const request = this.requestQueue.shift();
        if (request) {
          const quotaError = new Error(
            `Daily API quota exceeded (${this.requestsThisDay}/${this.MAX_REQUESTS_PER_DAY}). Free tier limit reached. Please upgrade your Gemini API plan or try again tomorrow.`
          );
          (quotaError as any).code = 'QUOTA_EXCEEDED';
          request.reject(quotaError);
        }
        continue;
      }

      // Check per-minute quota
      if (this.requestsThisMinute >= this.MAX_REQUESTS_PER_MINUTE) {
        console.warn(
          `[GeminiService] Per-minute quota reached (${this.requestsThisMinute}/${this.MAX_REQUESTS_PER_MINUTE}). Waiting...`
        );
        await this.sleep(this.RESET_MINUTE);
        this.requestsThisMinute = 0;
        continue;
      }

      // Check request interval
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        await this.sleep(this.MIN_REQUEST_INTERVAL - timeSinceLastRequest);
      }

      const request = this.requestQueue.shift();
      if (!request) break;

      try {
        this.lastRequestTime = Date.now();
        this.requestsThisMinute++;
        this.requestsThisDay++;

        console.log(
          `[GeminiService] Processing request (${this.requestsThisDay}/${this.MAX_REQUESTS_PER_DAY} daily, ${this.requestsThisMinute}/${this.MAX_REQUESTS_PER_MINUTE} this minute)`
        );

        const result = await this.model.generateContent(request.prompt);
        const response = await result.response;
        request.resolve(response.text());
      } catch (error: any) {
        // Handle 429 quota errors with exponential backoff
        if (error?.status === 429 || error?.status === 503) {
          console.error(`[GeminiService] ${error.status} error:`, error?.message?.substring(0, 120));
          if (request.retries < this.MAX_RETRIES) {
            request.retries++;
            const backoffMs = Math.pow(2, request.retries) * 5000;
            console.warn(
              `[GeminiService] Quota error (429), retrying in ${backoffMs}ms (attempt ${request.retries}/${this.MAX_RETRIES})`
            );
            await this.sleep(backoffMs);
            // Re-queue the request
            this.requestQueue.unshift(request);
          } else {
            // After max retries on 429, give user-friendly message
            const quotaError = new Error(
              `Daily API quota exceeded. Free tier limit (20 requests/day) reached. Please upgrade your Gemini API plan at https://ai.google.dev/pricing or try again tomorrow.`
            );
            (quotaError as any).code = 'QUOTA_EXCEEDED';
            console.error('[GeminiService] Daily quota exceeded after retries:', quotaError.message);
            request.reject(quotaError);
          }
        } else {
          console.error('[GeminiService] Error generating content:', error);
          request.reject(
            new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`)
          );
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Stream generate text from a prompt
   * Note: This bypasses the queue for now (streaming has different quota implications)
   */
  async streamGenerate(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    try {
      const result = await this.model.generateContentStream(prompt);
      let fullText = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        onChunk(chunkText);
      }

      return fullText;
    } catch (error) {
      console.error('[GeminiService] Error streaming content:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set the model name
   */
  setModel(modelName: string): void {
    this._modelName = modelName;
    this.model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: this.options.temperature ?? 0.7,
        maxOutputTokens: this.options.maxOutputTokens ?? 2000,
        topP: this.options.topP ?? 0.95,
        topK: this.options.topK ?? 40,
      },
    });
  }
}
