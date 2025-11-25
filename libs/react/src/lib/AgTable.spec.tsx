import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AgTable } from './AgTable';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('AgTable', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should render loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    const { baseElement } = render(
      <AgTable url="/api/table-definitions/test" />
    );
    
    expect(baseElement).toBeTruthy();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('should render error state on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    
    render(<AgTable url="/api/table-definitions/test" />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeTruthy();
    });
  });
});
