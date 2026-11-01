import { Buffer } from 'node:buffer';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'maxByteLength', async: false })
class MaxByteLengthConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return true;
    }

    return Buffer.byteLength(value, 'utf8') <= (args.constraints[0] as number);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be at most ${String(args.constraints[0])} bytes`;
  }
}

export function MaxByteLength(
  max: number,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'maxByteLength',
      target: object.constructor,
      propertyName,
      ...(validationOptions === undefined
        ? {}
        : { options: validationOptions }),
      constraints: [max],
      validator: MaxByteLengthConstraint,
    });
  };
}
