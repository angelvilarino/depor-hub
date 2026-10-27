import { renderHook } from '@testing-library/react-native';
import { useCountdown } from '@/features/home/useCountdown';

describe('useCountdown', () => {
  it('usa un único intervalo y lo limpia al desmontar', async () => {
    const set = jest.spyOn(global, 'setInterval');
    const clear = jest.spyOn(global, 'clearInterval');
    const { unmount } = await renderHook(() => useCountdown(Date.now() + 10_000, true));

    expect(set).toHaveBeenCalledTimes(1);

    await unmount();
    expect(clear).toHaveBeenCalled();
  });
});
