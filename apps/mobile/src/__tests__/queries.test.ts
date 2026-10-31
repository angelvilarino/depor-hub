import { DataError } from '@/data/api';
import { optionalDocument } from '@/data/queries';

describe('documentos públicos opcionales', () => {
  it('muestra vacío y registra el error si el documento no valida', async () => {
    const error = new DataError('invalid', 'news.json: campo desconocido');
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(optionalDocument('news.json', async () => Promise.reject(error))).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('news.json inválido'), error);
    log.mockRestore();
  });

  it('mantiene como error los fallos de red', async () => {
    const error = new DataError('network', 'sin conexión');
    await expect(optionalDocument('news.json', async () => Promise.reject(error))).rejects.toBe(error);
  });
});
