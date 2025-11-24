import { render } from '@testing-library/react';

import GridweaverReact from './react';

describe('GridweaverReact', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<GridweaverReact />);
    expect(baseElement).toBeTruthy();
  });
});
