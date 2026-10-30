import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = [...cpf].map(Number);
  const firstCheck = calculateCheckDigit(digits.slice(0, 9), 10);
  const secondCheck = calculateCheckDigit(digits.slice(0, 10), 11);
  return digits[9] === firstCheck && digits[10] === secondCheck;
}

function calculateCheckDigit(digits: number[], initialWeight: number): number {
  const remainder =
    digits.reduce(
      (sum, digit, index) => sum + digit * (initialWeight - index),
      0,
    ) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

@ValidatorConstraint({ name: 'isCpf', async: false })
export class IsCpfConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidCpf(value);
  }

  defaultMessage(): string {
    return 'Informe um CPF valido.';
  }
}

export function IsCpf(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsCpfConstraint,
    });
  };
}
