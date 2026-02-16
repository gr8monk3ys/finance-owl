import { IsString, IsOptional, IsIn } from 'class-validator';

export class RequestCancellationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateCancellationStatusDto {
  @IsString()
  @IsIn(['pending', 'in_progress', 'completed', 'failed'])
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
