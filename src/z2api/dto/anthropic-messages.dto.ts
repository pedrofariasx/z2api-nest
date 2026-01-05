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

export class AnthropicMessageDto {
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

export class AnthropicMessagesDto {
  @ApiPropertyOptional({
    example: 'glm-4.7',
    description: 'ID of the model to use',
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({ type: [AnthropicMessageDto], description: 'Input messages' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnthropicMessageDto)
  messages: AnthropicMessageDto[];

  @ApiPropertyOptional({ description: 'System prompt' })
  @IsOptional()
  system?: string | any[];

  @ApiPropertyOptional({ example: 1024 })
  @IsNumber()
  @IsOptional()
  max_tokens?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  stream?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  thinking?: {
    type: string;
    budget_tokens?: number;
  };
}
