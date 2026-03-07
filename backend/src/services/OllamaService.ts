import axios, { AxiosInstance } from 'axios';
import { OllamaStreamResponse } from '../models/types.js';

/** Ollama options that affect speed. Smaller values = faster but less capable. */
export interface OllamaOptions {
  num_predict?: number;  // Max tokens to generate (-1 = unlimited). Lower = faster.
  num_ctx?: number;     // Context window size. Smaller = faster, less context.
  num_thread?: number;  // CPU threads (Ollama uses GPU if available).
}

export class OllamaService {
  private client: AxiosInstance;
  private model: string;
  private apiUrl: string;
  private options: OllamaOptions;

  constructor(
    apiUrl: string = 'http://localhost:11434',
    model: string = 'mistral',
    options?: OllamaOptions
  ) {
    this.apiUrl = apiUrl;
    this.model = model;
    this.options = options ?? {};
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 360000, // 6 min - allow custom timeout to fire first
    });
  }

  private buildRequestBody(prompt: string, stream: boolean, overrideOptions?: OllamaOptions) {
    const mergedOptions = { ...this.options, ...overrideOptions };
    const body: Record<string, unknown> = {
      model: this.model,
      prompt,
      stream,
    };
    if (Object.keys(mergedOptions).length > 0) {
      body.options = mergedOptions;
    }
    return body;
  }

  /** Ms without data before we consider the stream stalled. */
  private static readonly STREAM_INACTIVITY_TIMEOUT_MS = 90_000; // 90 sec

  /**
   * Generate a streaming response from Ollama
   * @param prompt The prompt to send to the model
   * @param onChunk Callback function that receives each streamed chunk
   */
  async streamGenerate(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    try {
      const response = await this.client.post(
        '/api/generate',
        this.buildRequestBody(prompt, true),
        {
          responseType: 'stream',
        }
      );

      let fullResponse = '';
      let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const clearTimer = () => {
        if (inactivityTimer) {
          clearTimeout(inactivityTimer);
          inactivityTimer = null;
        }
      };

      const resetTimer = (reject: (err: Error) => void) => {
        clearTimer();
        inactivityTimer = setTimeout(() => {
          if (!settled) {
            settled = true;
            (response.data as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
            reject(new Error('Ollama stream timed out: no response for 90 seconds. Try restarting Ollama or using a smaller model (e.g. llama3.2:1b).'));
          }
        }, OllamaService.STREAM_INACTIVITY_TIMEOUT_MS);
      };

      return new Promise((resolve, reject) => {
        let buffer = '';

        response.data.on('data', (chunk: Buffer) => {
          resetTimer(reject);
          buffer += chunk.toString();
          const lines = buffer.split('\n');

          // Process all complete lines
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line) {
              try {
                const json = JSON.parse(line) as OllamaStreamResponse;
                const responseText = json.response || '';
                fullResponse += responseText;
                onChunk(responseText);
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }

          // Keep the incomplete line in the buffer
          buffer = lines[lines.length - 1];
        });

        response.data.on('end', () => {
          clearTimer();
          if (settled) return;
          settled = true;
          // Process any remaining data in buffer
          if (buffer.trim()) {
            try {
              const json = JSON.parse(buffer) as OllamaStreamResponse;
              const responseText = json.response || '';
              fullResponse += responseText;
              onChunk(responseText);
            } catch (e) {
              // Skip invalid JSON
            }
          }
          resolve(fullResponse);
        });

        response.data.on('error', (err: Error) => {
          clearTimer();
          if (!settled) {
            settled = true;
            reject(err);
          }
        });

        // Start inactivity timer
        resetTimer(reject);
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Ollama API error: ${error.message}`);
      }
      throw error;
    }
  }

  /** Timeout for non-streaming generate (ms). Set OLLAMA_GENERATE_TIMEOUT_MS in env to override. */
  private static getGenerateTimeoutMs(): number {
    const env = process.env.OLLAMA_GENERATE_TIMEOUT_MS;
    const n = env ? parseInt(env, 10) : NaN;
    return !isNaN(n) && n > 0 ? n : 480_000; // default 8 min
  }

  /**
   * Generate a non-streaming response from Ollama.
   * Retries once on timeout so a single slow response doesn't kill the whole run.
   */
  async generate(prompt: string, overrideOptions?: OllamaOptions): Promise<string> {
    const timeoutMs = OllamaService.getGenerateTimeoutMs();
    const timeoutMin = Math.round(timeoutMs / 60_000);
    const timeoutMessage = `Ollama generate timed out after ${timeoutMin} minutes. Try restarting Ollama, using a faster model, or set OLLAMA_GENERATE_TIMEOUT_MS in .env.`;

    const doGenerate = async (): Promise<string> => {
      const source = axios.CancelToken.source();
      const timer = setTimeout(() => source.cancel(timeoutMessage), timeoutMs);
      try {
        const response = await this.client.post(
          '/api/generate',
          this.buildRequestBody(prompt, false, overrideOptions),
          { cancelToken: source.token }
        );
        clearTimeout(timer);
        if (!response.data?.response) {
          throw new Error('Ollama returned an empty response');
        }
        return response.data.response;
      } catch (error) {
        clearTimeout(timer);
        if (axios.isCancel(error)) {
          throw new Error((error as { message?: string }).message ?? timeoutMessage);
        }
        if (axios.isAxiosError(error)) {
          throw new Error(`Ollama API error: ${error.message}`);
        }
        throw error;
      }
    };

    try {
      return await doGenerate();
    } catch (firstError) {
      const msg = firstError instanceof Error ? firstError.message : String(firstError);
      const isTimeout = /timed out|timeout|cancel/i.test(msg);
      if (isTimeout) {
        console.warn('[Ollama] First attempt timed out, retrying once...');
        return await doGenerate();
      }
      throw firstError;
    }
  }

  /**
   * Check if Ollama service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      return models.map((m: any) => m.name);
    } catch (error) {
      throw new Error(`Failed to list models: ${error}`);
    }
  }

  /**
   * Set the model to use for generation
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get the current model
   */
  getModel(): string {
    return this.model;
  }
}
