/**
 * Gemini API Service
 * Replaces OllamaService for cloud-based code generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private modelName: string;

  constructor(
    apiKey: string,
    modelName: string = 'gemini-1.5-flash',
    private options: GeminiOptions = {}
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 2000,
        topP: options.topP ?? 0.95,
        topK: options.topK ?? 40,
      },
    });
  }

  /**
   * Generate text from a prompt (non-streaming)
   */
  async generate(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('[GeminiService] Error generating content:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream generate text from a prompt
   */
  async streamGenerate(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      const result = await this.model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        onChunk(chunkText);
      }
    } catch (error) {
      console.error('[GeminiService] Error streaming content:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set the model name
   */
  setModel(modelName: string): void {
    this.modelName = modelName;
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
