import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { MaxByteLength } from './max-byte-length.validator.js';

export class LoginDto {
  @IsEmail()
  @MaxLength(320)
  declare email: string;

  @IsString()
  @MinLength(1)
  @MaxByteLength(72)
  declare password: string;
}
