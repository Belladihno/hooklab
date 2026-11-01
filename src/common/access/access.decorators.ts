import { SetMetadata } from '@nestjs/common';

export const ACCESS_METADATA_KEY = 'access';
export type AccessLevel = 'public' | 'signed-in';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ACCESS_METADATA_KEY, 'public');

export const SignedIn = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ACCESS_METADATA_KEY, 'signed-in');
