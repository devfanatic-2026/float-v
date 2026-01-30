/**
 * Float-V AI Module
 * Native AI integration with streaming support
 */

const env = typeof process !== 'undefined' ? process.env : {};

export interface AIProvider {
  name: string;
  chat(options: ChatOptions): Promise<AIResponse>;
  stream(options: ChatOptions): AsyncIterable<string>;
}

export interface ChatOptions {
  model?: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  system?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number; // Estimated cost in USD
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = options.apiKey || env.OPENAI_API_KEY || '';
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
  }

  async chat(options: ChatOptions): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o-mini',
        messages: options.system
          ? [{ role: 'system', content: options.system }, ...options.messages]
          : options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      }),
    });

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
      // Approx gpt-4o-mini rates (input: $0.00015/1K, output: $0.0006/1K)
      cost: data.usage ? (data.usage.prompt_tokens * 0.00015 / 1000) + (data.usage.completion_tokens * 0.0006 / 1000) : 0,
    };
  }

  async *stream(options: ChatOptions): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o-mini',
        messages: options.system
          ? [{ role: 'system', content: options.system }, ...options.messages]
          : options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

/**
 * Anthropic Provider
 */
export class AnthropicProvider implements AIProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = options.apiKey || env.ANTHROPIC_API_KEY || '';
    this.baseUrl = options.baseUrl || 'https://api.anthropic.com/v1';
  }

  async chat(options: ChatOptions): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-5-sonnet-20241022',
        messages: options.messages.filter(m => m.role !== 'system'),
        system: options.system || options.messages.find(m => m.role === 'system')?.content,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
      }),
    });

    const data = await response.json();

    return {
      content: data.content[0].text,
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      cost: data.usage ? (data.usage.input_tokens * 0.000003) + (data.usage.output_tokens * 0.000015) : 0, // Approx Claude 3.5 Sonnet rates
    };
  }

  async *stream(options: ChatOptions): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-5-sonnet-20241022',
        messages: options.messages.filter(m => m.role !== 'system'),
        system: options.system || options.messages.find(m => m.role === 'system')?.content,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'content_block_delta') {
              yield parsed.delta.text;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

/**
 * DeepSeek Provider (OpenAI Compatible)
 */
export class DeepSeekProvider implements AIProvider {
  name = 'deepseek';
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = options.apiKey || env.DEEPSEEK_API_KEY || '';
    this.baseUrl = options.baseUrl || 'https://api.deepseek.com/v1';
  }

  /** Update API key at runtime */
  setApiKey(key: string) {
    this.apiKey = key;
  }

  async chat(options: ChatOptions): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'deepseek-chat',
        messages: options.system
          ? [{ role: 'system', content: options.system }, ...options.messages]
          : options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    const usage = data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined;

    // Cost calculation for DeepSeek
    // Chat: $0.27/1M input, $1.10/1M output (cache hit lower)
    // Reasoner: $0.55/1M input, $2.19/1M output
    let cost = 0;
    if (usage) {
      const isReasoner = (options.model || 'deepseek-chat').includes('reasoner');
      const inputRate = isReasoner ? 0.00000055 : 0.00000027;
      const outputRate = isReasoner ? 0.00000219 : 0.00000110;
      cost = (usage.promptTokens * inputRate) + (usage.completionTokens * outputRate);
    }

    return {
      content: data.choices[0].message.content,
      model: data.model,
      usage,
      cost,
    };
  }

  async *stream(options: ChatOptions): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'deepseek-chat',
        messages: options.system
          ? [{ role: 'system', content: options.system }, ...options.messages]
          : options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

/**
 * Google Gemini Provider
 */
export class GeminiProvider implements AIProvider {
  name = 'gemini';
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = options.apiKey || env.GOOGLE_API_KEY || '';
    this.baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async chat(options: ChatOptions): Promise<AIResponse> {
    const model = options.model || 'gemini-1.5-flash';
    const response = await fetch(`${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${options.system ? options.system + '\n\n' : ''}${options.messages[options.messages.length - 1].content}` }]
          }
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens,
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content: text,
      model: model,
    };
  }

  async *stream(options: ChatOptions): AsyncIterable<string> {
    const model = options.model || 'gemini-1.5-flash';
    const response = await fetch(`${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${options.system ? options.system + '\n\n' : ''}${options.messages[options.messages.length - 1].content}` }]
          }
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens,
        }
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}

/**
 * AI Instance - Main entry point
 */
class FloatAI {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProvider: string = 'openai';

  constructor() {
    // Auto-register providers based on available API keys
    if (env.OPENAI_API_KEY) {
      this.register(new OpenAIProvider());
      this.defaultProvider = 'openai';
    }
    if (env.ANTHROPIC_API_KEY) {
      this.register(new AnthropicProvider());
      if (!env.OPENAI_API_KEY) {
        this.defaultProvider = 'anthropic';
      }
    }
    // Always register DeepSeek (can be configured later via UI)
    this.register(new DeepSeekProvider());
    // Register Gemini
    this.register(new GeminiProvider());

    if (env.GOOGLE_API_KEY && !env.OPENAI_API_KEY) {
      this.defaultProvider = 'gemini';
    }
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  use(name: string): this {
    if (!this.providers.has(name)) {
      throw new Error(`AI provider "${name}" not registered`);
    }
    this.defaultProvider = name;
    return this;
  }

  private getProvider(): AIProvider {
    const provider = this.providers.get(this.defaultProvider);
    if (!provider) {
      throw new Error(`No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY`);
    }
    return provider;
  }

  /**
   * Set API key for a provider at runtime
   */
  setKey(provider: string, key: string): void {
    const inst = this.providers.get(provider);
    if (inst && 'setApiKey' in inst) {
      (inst as any).setApiKey(key);
    }
  }

  /**
   * Check if a provider has been configured with a key
   */
  isConfigured(provider?: string): boolean {
    const name = provider || this.defaultProvider;
    const inst = this.providers.get(name);
    if (!inst) return false;
    return !!(inst as any).apiKey || !!env[`${name.toUpperCase()}_API_KEY`];
  }

  /**
   * Simple chat completion
   */
  async chat(prompt: string, options: Partial<ChatOptions> = {}): Promise<string> {
    const response = await this.getProvider().chat({
      ...options,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content;
  }

  /**
   * Chat with message history
   */
  async complete(options: ChatOptions): Promise<AIResponse> {
    return this.getProvider().chat(options);
  }

  /**
   * Stream chat completion
   */
  stream(prompt: string, options: Partial<ChatOptions> = {}): AsyncIterable<string> {
    return this.getProvider().stream({
      ...options,
      messages: [{ role: 'user', content: prompt }],
    });
  }

  /**
   * Stream with message history
   */
  streamChat(options: ChatOptions): AsyncIterable<string> {
    return this.getProvider().stream(options);
  }
}

// Singleton instance
export const ai = new FloatAI();

/**
 * Create a streaming response for API routes
 */
export function streamResponse(
  iterable: AsyncIterable<string>,
  options: { headers?: Record<string, string> } = {}
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      ...options.headers,
    },
  });
}

/**
 * Create a Server-Sent Events response
 */
export function sseResponse(
  iterable: AsyncIterable<string>,
  options: { headers?: Record<string, string> } = {}
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...options.headers,
    },
  });
}

/**
 * AI Action decorator for type-safe AI endpoints
 */
export function aiAction<T extends Record<string, unknown>>(
  handler: (input: T) => Promise<string> | AsyncIterable<string>
) {
  return async (request: Request): Promise<Response> => {
    try {
      const input = await request.json() as T;
      const result = handler(input);

      if (Symbol.asyncIterator in Object(result)) {
        return streamResponse(result as AsyncIterable<string>);
      }

      const content = await (result as Promise<string>);
      return new Response(JSON.stringify({ content }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: (error as Error).message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}
