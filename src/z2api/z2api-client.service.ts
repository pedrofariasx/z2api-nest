import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { UserService } from './user/user.service';
import { generateSignature } from '../common/utils/signature.util';
import { generateId } from '../common/utils/id.util';

@Injectable()
export class Z2ApiClientService {
  private readonly logger = new Logger(Z2ApiClientService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  private getHeaders(): Record<string, string> {
    const protocol = this.configService.get<string>('source.protocol');
    const host = this.configService.get<string>('source.host');
    return {
      Accept: '*/*',
      'Accept-Language': 'en-US',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      Pragma: 'no-cache',
      'Sec-Ch-Ua': `"Microsoft Edge";v="141", "Not?A_Brand";v="8"`,
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': 'Linux',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      'X-FE-Version': 'prod-fe-1.0.117',
      Origin: `${protocol}//${host}`,
      Referer: `${protocol}//${host}/`,
    };
  }

  async sendChatRequest(
    data: any,
    chatId: string,
    lastUserMessage: string,
  ): Promise<AxiosResponse> {
    const timestamp = Date.now().toString();
    const requestId = generateId();
    const user = await this.userService.getUser();

    const params = new URLSearchParams();
    params.set('timestamp', timestamp);
    params.set('requestId', requestId);

    const headers = this.getHeaders();
    headers['Authorization'] = `Bearer ${user.token}`;

    const protocol = this.configService.get<string>('source.protocol');
    const host = this.configService.get<string>('source.host');
    headers['Referer'] = `${protocol}//${host}/c/${chatId}`;
    headers['Content-Type'] = 'application/json';

    if (user.id) {
      params.set('user_id', user.id);

      const sigParams = {
        requestId,
        timestamp,
        user_id: user.id,
      };

      const sigResult = generateSignature(sigParams, lastUserMessage);
      headers['X-Signature'] = sigResult.signature;
      params.set('signature_timestamp', sigResult.timestamp.toString());
      data['signature_prompt'] = lastUserMessage;
    }

    const apiUrl = `${protocol}//${host}/api/chat/completions?${params.toString()}`;

    try {
      return await axios.post(apiUrl, data, {
        headers,
        responseType: 'stream',
        timeout: 0, // No timeout for streaming
      });
    } catch (error) {
      this.logger.error(`Failed to send chat request: ${error.message}`);
      throw error;
    }
  }

  async uploadImage(dataUrl: string, chatId: string): Promise<string> {
    const isAnonymous = this.configService.get<boolean>('api.anonymous');
    if (isAnonymous || !dataUrl.startsWith('data:')) {
      return '';
    }

    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      throw new Error('Invalid data URL format');
    }

    const base64Data = parts[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = generateId();

    const form = new FormData();
    form.append('file', buffer, { filename });

    const user = await this.userService.getUser();

    const protocol = this.configService.get<string>('source.protocol');
    const host = this.configService.get<string>('source.host');
    const uploadUrl = `${protocol}//${host}/api/v1/files/`;

    const headers = this.getHeaders();
    headers['Authorization'] = `Bearer ${user.token}`;
    headers['Referer'] = `${protocol}//${host}/c/${chatId}`;
    // Merge form headers
    Object.assign(headers, form.getHeaders());

    try {
      const response = await axios.post(uploadUrl, form, {
        headers,
        timeout: 30000,
      });

      if (response.data && response.data.id && response.data.filename) {
        return `${response.data.id}_${response.data.filename}`;
      }
      throw new Error('Invalid upload response');
    } catch (error) {
      this.logger.error(`Failed to upload image: ${error.message}`);
      return ''; // Return empty string on failure as per original logic? Or throw?
      // Original logic returns error string in chat content for error, but func returns (string, error).
      // Here we might just return empty string or rethrow. Original rethrew.
      throw error;
    }
  }
}
