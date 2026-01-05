import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { Observable } from 'rxjs';
import { ChatCompletionDto } from './dto/chat-completion.dto';
import { AnthropicMessagesDto } from './dto/anthropic-messages.dto';
import { Z2ApiClientService } from './z2api-client.service';
import { generateId } from '../common/utils/id.util';
import { countTokens } from '../common/utils/tokenizer.util';
import { ResponseTransformer } from './response-transformer';
import { parseSSE } from '../common/utils/sse-parser.util';

@Injectable()
export class Z2ApiService {
  private readonly logger = new Logger(Z2ApiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly client: Z2ApiClientService,
  ) {}

  async listModels() {
    return {
      object: 'list',
      data: [
        {
          id: 'glm-4.7',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'z.ai',
        },
      ],
    };
  }

  async chatCompletions(dto: ChatCompletionDto): Promise<any> {
    const chatID = generateId();
    const messageID = generateId();

    const includeUsage = dto.stream_options?.include_usage ?? true;
    const model =
      dto.model || this.configService.get<string>('model.default') || 'glm-4.7';

    // Format request
    const formattedData = await this.formatRequest(dto, 'OpenAI', chatID);
    formattedData['chat_id'] = chatID;
    formattedData['id'] = messageID;

    // Send request
    const lastUserMessage = this.extractLastUserMessage(dto.messages);
    const response = await this.client.sendChatRequest(
      formattedData,
      chatID,
      lastUserMessage,
    );

    if (dto.stream) {
      return this.handleStream(response.data, 'OpenAI', model, includeUsage);
    } else {
      return this.handleNonStream(response.data, 'OpenAI', model, includeUsage);
    }
  }

  async anthropicMessages(dto: AnthropicMessagesDto): Promise<any> {
    const chatID = generateId();
    const messageID = generateId();
    const model =
      dto.model || this.configService.get<string>('model.default') || 'glm-4.7';

    // Format request
    const formattedData = await this.formatRequest(dto, 'Anthropic', chatID);
    formattedData['chat_id'] = chatID;
    formattedData['id'] = messageID;

    const lastUserMessage = this.extractLastUserMessage(dto.messages);
    const response = await this.client.sendChatRequest(
      formattedData,
      chatID,
      lastUserMessage,
    );

    if (dto.stream) {
      return this.handleStream(response.data, 'Anthropic', model);
    } else {
      return this.handleNonStream(response.data, 'Anthropic', model);
    }
  }

  private async formatRequest(
    dto: any,
    type: 'OpenAI' | 'Anthropic',
    chatID: string,
  ): Promise<any> {
    const result: any = { ...dto };
    const defaultModel = this.configService.get<string>('model.default');

    if (!result.model) {
      result.model = defaultModel;
    }

    // Process messages
    const newMessages: any[] = [];

    // Handle Anthropic system parameter
    if (result.system) {
      let content = '';
      if (typeof result.system === 'string') {
        content = result.system.replace(/^\n+/, '');
      } else if (Array.isArray(result.system)) {
        content = result.system
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text.replace(/^\n+/, ''))
          .join('\n\n');
      }

      if (content) {
        newMessages.push({ role: 'system', content });
      }
      delete result.system;
    }

    if (Array.isArray(result.messages)) {
      for (const msg of result.messages) {
        const role = msg.role;
        const content = msg.content;
        const newMessage: any = { role };

        if (typeof content === 'string') {
          newMessage.content = content;
          newMessages.push(newMessage);
          continue;
        }

        if (Array.isArray(content)) {
          const newContent: any[] = [];
          for (const item of content) {
            if (item.type === 'text') {
              newContent.push({ type: 'text', text: item.text });
            } else if (item.type === 'image_url' || item.type === 'image') {
              let mediaUrl = '';
              // OpenAI
              if (item.image_url?.url) {
                mediaUrl = item.image_url.url;
              }
              // Anthropic
              if (item.source?.type === 'base64' && item.source?.data) {
                const mediaType = item.source.media_type || 'image/jpeg';
                mediaUrl = `data:${mediaType};base64,${item.source.data}`;
              }

              if (mediaUrl) {
                // Check if needs upload (base64)
                if (mediaUrl.startsWith('data:')) {
                  try {
                    const uploadedUrl = await this.client.uploadImage(
                      mediaUrl,
                      chatID,
                    );
                    if (uploadedUrl) {
                      mediaUrl = uploadedUrl; // Use the uploaded ID
                    }
                  } catch (e) {
                    this.logger.warn('Image upload failed', e);
                    newContent.push({
                      type: 'text',
                      text: `[Image Upload Failed: ${e.message}]`,
                    });
                    continue;
                  }
                }
                newContent.push({
                  type: 'image_url',
                  image_url: { url: mediaUrl },
                });
              }
            } else if (item.type === 'tool_use' && role === 'assistant') {
              // Anthropic tool_use -> OpenAI tool_calls
              // Implementation of tool transformation logic
            }
          }

          newMessage.content = newContent;
          newMessages.push(newMessage);
        }
      }
    }

    result.messages = newMessages;
    result.stream = true; // Always stream from Z.ai

    // Handle features/thinking
    const features: any = { enable_thinking: false };
    if (result.features) {
      Object.assign(features, result.features);
    }

    // Qwen thinking
    if (result.enable_thinking !== undefined) {
      features.enable_thinking = result.enable_thinking;
      delete result.enable_thinking;
    }

    // Anthropic thinking
    if (result.thinking?.type === 'enabled') {
      features.enable_thinking = true;
    }
    if (result.thinking) delete result.thinking;

    if (Object.keys(features).length > 0) {
      result.features = features;
    }

    return result;
  }

  private extractLastUserMessage(messages: any[]): string {
    let lastUserMessage = '';
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        if (msg.role === 'user') {
          if (typeof msg.content === 'string') {
            lastUserMessage = msg.content;
          } else if (Array.isArray(msg.content)) {
            lastUserMessage = msg.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('');
          }
        }
      }
    }
    return lastUserMessage;
  }

  private handleStream(
    stream: Readable,
    type: 'OpenAI' | 'Anthropic',
    model: string,
    includeUsage = false,
  ): Observable<any> {
    const transformer = new ResponseTransformer(
      this.configService.get<string>('api.think') || 'reasoning',
    );

    return new Observable((subscriber) => {
      (async () => {
        try {
          if (type === 'Anthropic') {
            subscriber.next({
              type: 'message_start',
              message: {
                id: generateId(),
                type: 'message',
                role: 'assistant',
                model,
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 },
              },
            });
            subscriber.next({
              type: 'content_block_start',
              index: 0,
              content_block: { type: 'text', text: '' },
            });
            subscriber.next({ type: 'ping' });
          }

          let completionText = '';

          for await (const data of parseSSE(stream)) {
            if (data.done) break;

            const delta = transformer.transform(data, type);
            if (!delta) continue;

            if (type === 'OpenAI') {
              if (includeUsage && (delta.content || delta.reasoning_content)) {
                completionText +=
                  (delta.content || '') + (delta.reasoning_content || '');
              }

              const chunk = {
                id: generateId(),
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  { index: 0, delta, message: delta, finish_reason: null },
                ],
              };
              subscriber.next(chunk);
            } else {
              // Anthropic
              if (delta.type === 'text_delta') {
                completionText += delta.text;
                subscriber.next({
                  type: 'content_block_delta',
                  index: 0,
                  delta,
                });
              } else if (delta.type === 'thinking_delta') {
                // Thinking not natively supported in standard Anthropic blocks yet, but Z.ai might send it as text or we handle it
                completionText += delta.thinking;
                subscriber.next({
                  type: 'content_block_delta',
                  index: 0,
                  delta: { type: 'text_delta', text: delta.thinking },
                });
              }
            }
          }

          if (type === 'OpenAI') {
            subscriber.next({
              id: generateId(),
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  delta: {},
                  message: { role: 'assistant' },
                  finish_reason: 'stop',
                },
              ],
            });

            if (includeUsage) {
              const completionTokens = countTokens(completionText);
              subscriber.next({
                id: generateId(),
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [],
                usage: {
                  prompt_tokens: 0,
                  completion_tokens: completionTokens,
                  total_tokens: completionTokens,
                },
              });
            }

            subscriber.next('[DONE]');
          } else {
            subscriber.next({ type: 'content_block_stop', index: 0 });
            const completionTokens = countTokens(completionText);
            subscriber.next({
              type: 'message_delta',
              delta: { stop_reason: 'end_turn', stop_sequence: null },
              usage: { output_tokens: completionTokens },
            });
            subscriber.next({ type: 'message_stop' });
          }

          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }

  private async handleNonStream(
    stream: Readable,
    type: 'OpenAI' | 'Anthropic',
    model: string,
    includeUsage = false,
  ) {
    const transformer = new ResponseTransformer(
      this.configService.get<string>('api.think') || 'reasoning',
    );

    let contentParts: string[] = [];
    let reasoningParts: string[] = [];
    let completionText = '';

    for await (const data of parseSSE(stream)) {
      if (data.done) break;

      const delta = transformer.transform(data, 'OpenAI'); // Always use OpenAI format internally for accumulation
      if (!delta) continue;

      if (delta.content) contentParts.push(delta.content);
      if (delta.reasoning_content) reasoningParts.push(delta.reasoning_content);
    }

    const finalContent = contentParts.join('');
    const finalReasoning = reasoningParts.join('');
    completionText = finalReasoning + finalContent;

    const completionTokens = countTokens(completionText);
    // Prompt tokens counting omitted for brevity/performance (requires processing input messages again)
    const promptTokens = 0;

    if (type === 'OpenAI') {
      const message: any = { role: 'assistant', content: finalContent };
      if (finalReasoning) message.reasoning_content = finalReasoning;

      const response: any = {
        id: generateId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message, finish_reason: 'stop' }],
      };

      if (includeUsage) {
        response.usage = {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        };
      }
      return response;
    } else {
      // Anthropic
      const content = [];
      if (finalContent) content.push({ type: 'text', text: finalContent });
      // If reasoning is present, prepend? Anthropic doesn't support reasoning field standardly.
      // Z2Api-go prepends it if mode is not strip.
      if (
        finalReasoning &&
        (this.configService.get<string>('api.think') || 'reasoning') !== 'strip'
      ) {
        // For Anthropic non-stream, maybe just prepend to text?
        if (content.length > 0 && content[0].type === 'text') {
          content[0].text = finalReasoning + content[0].text;
        } else {
          content.unshift({ type: 'text', text: finalReasoning });
        }
      }

      return {
        id: generateId(),
        type: 'message',
        role: 'assistant',
        model,
        content,
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: promptTokens,
          output_tokens: completionTokens,
        },
      };
    }
  }
}
