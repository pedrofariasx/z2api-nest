import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Z2apiModule } from './z2api/z2api.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    Z2apiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
