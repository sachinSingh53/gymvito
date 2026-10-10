import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppButton } from './core-controls';

describe('AppButton', () => {
  it('keeps icon-only actions accessible and at least 48dp', () => {
    const onPress = jest.fn();
    const screen = render(
      <AppButton
        accessibilityLabel="Print receipt"
        icon={<Text>print-icon</Text>}
        iconOnly
        onPress={onPress}
        variant="secondary"
      />,
    );
    const button = screen.getByRole('button', { name: 'Print receipt' });

    expect(button).toHaveStyle({ minHeight: 48, width: 48 });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
