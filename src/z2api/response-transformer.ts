import { countTokens } from '../common/utils/tokenizer.util';

export interface ZaiResponse {
  data: {
    phase: string;
    delta_content?: string;
    edit_content?: string;
    done?: boolean;
  };
}

export class ResponseTransformer {
  private phaseBak = 'thinking';

  constructor(private readonly thinkMode: string) {}

  transform(data: ZaiResponse, responseType: 'OpenAI' | 'Anthropic'): any {
    if (!data || !data.data) {
      return null;
    }

    let phase = data.data.phase || 'other';
    let content = data.data.delta_content || data.data.edit_content || '';

    if (!content) return null;

    // Handle tool_call phase
    if (phase === 'tool_call') {
      content = content
        .replace(
          /\n*<glm_block[^>]*>\{"type": "mcp", "data": \{"metadata": \{/g,
          '{',
        )
        .replace(/", "result": "".*<\/glm_block>/g, '');
    } else if (
      phase === 'other' &&
      this.phaseBak === 'tool_call' &&
      content.includes('glm_block')
    ) {
      phase = 'tool_call';
      content = content.replace(
        /null, "display_result": "".*<\/glm_block>/g,
        '"}',
      );
    }

    // Handle thinking/answer phase
    if (
      phase === 'thinking' ||
      (phase === 'answer' && content.includes('summary>'))
    ) {
      // Remove details tags
      content = content
        .replace(/<details[^>]*?>[\s\S]*?<\/details>/g, '')
        .replace(/<\/thinking>/g, '')
        .replace(/<Full>/g, '')
        .replace(/<\/Full>/g, '');

      if (phase === 'thinking') {
        content = content.replace(/\n*<summary>.*?<\/summary>\n*/g, '\n\n');
      }

      // Convert to <reasoning> tags
      content = content
        .replace(/<details[^>]*>\n*/g, '<reasoning>\n\n')
        .replace(/\n*<\/details>/g, '\n\n</reasoning>');

      if (phase === 'answer') {
        // Using [\s\S] instead of s flag for broader compatibility, or just s flag if target environment supports it
        const match = content.match(/^(.*?<\/reasoning>)([\s\S]*)$/);
        if (match) {
          const [_, before, after] = match;
          if (after.trim()) {
            if (this.phaseBak === 'thinking') {
              content = `\n\n</reasoning>\n\n${after.replace(/^\n+/, '')}`;
            } else if (this.phaseBak === 'answer') {
              content = '';
            }
          } else {
            content = '\n\n</reasoning>';
          }
        }
      }

      // Apply think mode transformations
      switch (this.thinkMode) {
        case 'reasoning':
          if (phase === 'thinking') {
            content = content.replace(/\n>\s?/g, '\n');
          }
          content = content
            .replace(/\n*<summary>.*?<\/summary>\n*/g, '')
            .replace(/<reasoning>\n*/g, '')
            .replace(/\n*<\/reasoning>/g, '');
          break;
        case 'think':
          if (phase === 'thinking') {
            content = content.replace(/\n>\s?/g, '\n');
          }
          content = content
            .replace(/\n*<summary>.*?<\/summary>\n*/g, '')
            .replace(/<reasoning>/g, '<think>')
            .replace(/<\/reasoning>/g, '</think>');
          break;
        case 'strip':
          content = content
            .replace(/\n*<summary>.*?<\/summary>\n*/g, '')
            .replace(/<reasoning>\n*/g, '')
            .replace(/<\/reasoning>/g, '');
          break;
        case 'details':
          // Simplified implementation of details mode
          content = content
            .replace(/<reasoning>/g, '<details type="reasoning" open><div>')
            .replace(/<\/reasoning>/g, '</div></details>');
          break;
        default:
          content = content.replace(/<\/reasoning>/g, '</reasoning>\n\n');
      }
    }

    this.phaseBak = phase;

    // Return formatted response
    if (phase === 'thinking' && this.thinkMode === 'reasoning') {
      if (responseType === 'Anthropic') {
        return { type: 'thinking_delta', thinking: content };
      }
      return { role: 'assistant', reasoning_content: content };
    }

    if (phase === 'tool_call') {
      return { tool_call: content };
    }

    if (content) {
      if (responseType === 'Anthropic') {
        return { type: 'text_delta', text: content };
      }
      return { role: 'assistant', content };
    }

    return null;
  }
}
