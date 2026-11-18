jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-reanimated', () => {
  const Native = require('react-native');
  const builder = () => {
    const animation = {};
    for (const method of [
      'duration',
      'delay',
      'reduceMotion',
      'withCallback',
      'springify',
      'damping',
    ]) {
      animation[method] = () => animation;
    }
    return animation;
  };
  return {
    __esModule: true,
    default: {
      View: Native.View,
      Text: Native.Text,
      createAnimatedComponent: (component) => component,
    },
    runOnJS: (callback) => callback,
    useAnimatedStyle: (factory) => factory(),
    useSharedValue: (value) => ({ value }),
    withSpring: (value) => value,
    withTiming: (value) => value,
    FadeIn: builder(),
    FadeInDown: builder(),
    FadeInUp: builder(),
    ReduceMotion: { System: 'system', Never: 'never', Always: 'always' },
  };
});
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  const gesture = {
    minDistance: () => gesture,
    onBegin: () => gesture,
    onUpdate: () => gesture,
  };
  return {
    Gesture: { Pan: () => gesture },
    GestureDetector: ({ children }) => React.createElement(View, null, children),
  };
});

// Los iconos cargan fuentes nativas que no existen en el entorno de Jest.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }) => React.createElement(Text, null, name);
  return { Ionicons: Icon };
});
