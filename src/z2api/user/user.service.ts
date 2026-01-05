import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface UserInfo {
  id: string;
  name: string;
  token: string;
}

interface CachedUser {
  info: UserInfo;
  cachedAt: number;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private cache: Map<string, CachedUser> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(private readonly configService: ConfigService) {}

  async getUser(): Promise<UserInfo> {
    const isAnonymous = this.configService.get<boolean>('api.anonymous');
    const configToken = this.configService.get<string>('source.token');

    let currentToken = '';
    if (!isAnonymous) {
      currentToken = configToken || '';
    }

    // Check cache
    if (currentToken) {
      const cached = this.cache.get(currentToken);
      if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
        this.logger.debug(`User info [cached]: id=${cached.info.id}`);
        return cached.info;
      }
    }

    // Fetch from API
    const protocol = this.configService.get<string>('source.protocol');
    const host = this.configService.get<string>('source.host');
    const url = `${protocol}//${host}/api/v1/auths/`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Add standard headers here if needed, consistent with z2api-go config.initHeaders()
    };

    if (!isAnonymous && currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    try {
      const response = await axios.get(url, { headers, timeout: 10000 });
      const data = response.data;

      const userToken = !isAnonymous ? currentToken : data.token || '';
      const userInfo: UserInfo = {
        id: data.id || '',
        name: data.name || '',
        token: userToken,
      };

      if (userToken && userInfo.id) {
        this.cache.set(userToken, {
          info: userInfo,
          cachedAt: Date.now(),
        });
      }

      this.logger.debug(`User info [live]: id=${userInfo.id}`);
      return userInfo;
    } catch (error) {
      this.logger.error(`Failed to fetch user info: ${error.message}`);
      throw error;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}
