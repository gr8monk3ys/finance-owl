import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ScenarioDto {
  @IsString()
  label!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(50)
  @Max(80)
  retirementAge?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  monthlyContribution?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  employerMatch?: number;

  @IsOptional()
  @IsString()
  @IsIn(['conservative', 'moderate', 'aggressive'])
  riskTolerance?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  currentSavings?: number;
}

export class CompareScenarioDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScenarioDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  scenarios!: ScenarioDto[];
}
