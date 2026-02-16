import { IsString, Length, Matches } from 'class-validator';

export class CheckPasswordDto {
  @IsString()
  @Length(40, 40, { message: 'SHA1 hash must be exactly 40 characters' })
  @Matches(/^[0-9a-fA-F]{40}$/, {
    message: 'Must be a valid SHA1 hex string',
  })
  sha1Hash!: string;
}
