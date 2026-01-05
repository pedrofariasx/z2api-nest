import { Module } from '@nestjs/common';
import { Z2ApiController } from './z2api.controller';
import { Z2ApiService } from './z2api.service';
import { UserService } from './user/user.service';
import { Z2ApiClientService } from './z2api-client.service';

@Module({
  controllers: [Z2ApiController],
  providers: [Z2ApiService, UserService, Z2ApiClientService],
})
export class Z2apiModule {}
