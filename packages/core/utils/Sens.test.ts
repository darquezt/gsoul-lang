import { Sens, UnknownSens } from './Sens';

describe('Sensitivities', () => {
  describe('Constructor', () => {
    test('Range', () => {
      expect(Sens(2, 3)).toStrictEqual([2, 3]);
    });

    test('Range from zero', () => {
      expect(Sens(0, 3)).toStrictEqual([0, 3]);
    });

    test('Unkown', () => {
      expect(Sens()).toStrictEqual(UnknownSens());
    });

    test('Point', () => {
      expect(Sens(2)).toStrictEqual([2, 2]);
    });

    test('0 Point', () => {
      expect(Sens(0)).toStrictEqual([0, 0]);
    });

    test('Without lower bound', () => {
      expect(Sens(undefined, 3)).toStrictEqual([0, 3]);
    });

    test('Without lower bound in zero', () => {
      expect(Sens(undefined, 0)).toStrictEqual([0, 0]);
    });
  });
});
