import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({
    description: 'Plan identifier to subscribe to',
    example: 'pro',
  })
  @IsString()
  planId!: string;

  @ApiProperty({
    description: 'Billing interval',
    enum: ['month', 'year'],
    example: 'month',
  })
  @IsIn(['month', 'year'])
  interval!: 'month' | 'year';
}
