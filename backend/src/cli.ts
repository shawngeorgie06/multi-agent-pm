import dotenv from 'dotenv';
import { AgentOrchestrator } from './agents/AgentOrchestrator.js';
import { OllamaService } from './services/OllamaService.js';
import { GeminiService } from './services/GeminiService.js';

// Load environment variables
dotenv.config();

const USE_GEMINI = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_new_gemini_api_key_here';
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

async function main() {
  console.log('Multi-Agent Project Manager - CLI Test\n');

  // Initialize the appropriate generation service
  let generationService: OllamaService | GeminiService;

  if (USE_GEMINI) {
    console.log('Using Gemini API for code generation...');
    const apiKey = process.env.GEMINI_API_KEY!;
    generationService = new GeminiService(apiKey);
    console.log('✓ Gemini API service initialized\n');
  } else {
    console.log('Using Ollama for code generation...');
    console.log('Checking Ollama connection...');
    const ollamaService = new OllamaService(OLLAMA_API_URL, OLLAMA_MODEL);

    try {
      const isHealthy = await ollamaService.healthCheck();
      if (!isHealthy) {
        console.error('Failed to connect to Ollama');
        console.error(`Make sure Ollama is running at ${OLLAMA_API_URL}`);
        console.error('To start Ollama, run: ollama serve');
        process.exit(1);
      }

      console.log(`✓ Connected to Ollama at ${OLLAMA_API_URL}`);
      console.log(`✓ Using model: ${OLLAMA_MODEL}`);

      // List available models
      const models = await ollamaService.listModels();
      if (models.length > 0) {
        console.log(`✓ Available models: ${models.join(', ')}\n`);
      }
      generationService = ollamaService;
    } catch (error) {
      console.error('Error connecting to Ollama:', error);
      process.exit(1);
    }
  }

  // Get test prompt from command line or use default
  const userRequest = process.argv[2] || 'Build a simple todo app with React and Node.js';

  console.log(`\n${'='.repeat(60)}`);
  console.log('STARTING PROJECT PLANNING');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`User Request: ${userRequest}\n`);

  // Create orchestrator and start planning
  const orchestrator = new AgentOrchestrator(5, generationService);

  try {
    const context = await orchestrator.startProjectPlanning(userRequest);

    console.log(`\n${'='.repeat(60)}`);
    console.log('PLANNING SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Status: ${context.currentStatus}`);
    console.log(`Total Messages: ${context.allMessages.length}`);
    console.log(`Tasks Extracted: ${context.tasks.length}`);
    console.log(`Conversation Rounds: ${context.conversationRound}`);

    if (context.tasks.length > 0) {
      console.log(`\n${'='.repeat(60)}`);
      console.log('EXTRACTED TASKS');
      console.log(`${'='.repeat(60)}\n`);

      context.tasks.forEach((task) => {
        console.log(`Task: ${task.taskId} - ${task.description.substring(0, 50)}...`);
        console.log(`  Priority: ${task.priority}`);
        console.log(`  Estimated Hours: ${task.estimatedHours || 'N/A'}`);
        console.log(`  Status: ${task.status}`);
        if (task.dependencies && task.dependencies.length > 0) {
          console.log(`  Dependencies: ${task.dependencies.join(', ')}`);
        }
        console.log();
      });
    }
  } catch (error) {
    console.error('Error during project planning:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
