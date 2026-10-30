import { isValidCpf, normalizeCpf } from '../../common/validation/cpf.validator';

describe('CPF validation', () => {
  it('normalizes formatted values to digits', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
  });

  it('accepts a valid CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
  });

  it.each(['111.111.111-11', '123.456.789-00', '1234'])(
    'rejects invalid CPF %s',
    (value) => {
      expect(isValidCpf(value)).toBe(false);
    },
  );
});
