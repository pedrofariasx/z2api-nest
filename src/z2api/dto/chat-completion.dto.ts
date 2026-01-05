import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({
    example: 'user',
    description: 'The role of the message author',
  })
  @IsString()
  role: string;

  @ApiProperty({ example: 'Hello!', description: 'The content of the message' })
  @IsOptional()
  content: string | any[];
}

export class StreamOptionsDto {
  @ApiPropertyOptional({
    description:
      'If set, an additional chunk will be streamed before the data: [DONE] message containing the usage statistics for the entire request.',
  })
  @IsOptional()
  @IsBoolean()
  include_usage?: boolean;
}

export class ChatCompletionDto {
  @ApiPropertyOptional({
    example: 'glm-4.7',
    description: 'ID of the model to use',
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({
    type: [ChatMessageDto],
    description: 'A list of messages comprising the conversation so far',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiPropertyOptional({
    example: false,
    description: 'If set, partial message deltas will be sent, as in ChatGPT',
  })
  @IsBoolean()
  @IsOptional()
  stream?: boolean;

  @ApiPropertyOptional({ type: StreamOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StreamOptionsDto)
  stream_options?: StreamOptionsDto;
}
