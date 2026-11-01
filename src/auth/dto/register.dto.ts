import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { MaxByteLength } from './max-byte-length.validator.js';

export class RegisterDto {
  @IsEmail()
  @MaxLength(320)
  declare email: string;

  @IsString()
  @MinLength(8)
  @MaxByteLength(72)
  declare password: string;
}
