import { Controller, Post, Get, Body, Res, Sse, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Z2ApiService } from './z2api.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';
import { AnthropicMessagesDto } from './dto/anthropic-messages.dto';

@ApiTags('Z2Api')
@Controller('v1')
export class Z2ApiController {
  private readonly logger = new Logger(Z2ApiController.name);

  constructor(private readonly z2apiService: Z2ApiService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  healthCheck() {
    return { status: 'ok' };
  }

  @Get('models')
  @ApiOperation({ summary: 'List models' })
  async listModels() {
    return this.z2apiService.listModels();
  }

  @Post('chat/completions')
  @ApiTags('OpenAI')
  @ApiOperation({ summary: 'OpenAI Chat Completions' })
  @ApiBody({ type: ChatCompletionDto })
  async chatCompletions(@Body() dto: ChatCompletionDto, @Res() res: Response) {
    try {
      const result = await this.z2apiService.chatCompletions(dto);

      if (dto.stream && result instanceof Observable) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        result.subscribe({
          next: (data) => {
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
            } else {
              res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
          },
          complete: () => {
            res.end();
          },
          error: (err) => {
            this.logger.error(err);
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
          },
        });
      } else {
        res.json(result);
      }
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  @Post('messages')
  @ApiTags('Anthropic')
  @ApiOperation({ summary: 'Anthropic Messages' })
  @ApiBody({ type: AnthropicMessagesDto })
  async anthropicMessages(
    @Body() dto: AnthropicMessagesDto,
    @Res() res: Response,
  ) {
    try {
      const result = await this.z2apiService.anthropicMessages(dto);

      if (dto.stream && result instanceof Observable) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        result.subscribe({
          next: (data) => {
            res.write(`event: ${data.type}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          },
          complete: () => {
            res.end();
          },
          error: (err) => {
            this.logger.error(err);
            res.write(`event: error\n`);
            res.write(
              `data: ${JSON.stringify({ type: 'error', error: { type: 'api_error', message: err.message } })}\n\n`,
            );
            res.end();
          },
        });
      } else {
        res.json(result);
      }
    } catch (error) {
      this.logger.error(error);
      res.status(500).json({
        type: 'error',
        error: { type: 'api_error', message: error.message },
      });
    }
  }
}
