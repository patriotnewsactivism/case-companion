import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AzureBotChat } from '@/components/AzureBotChat';

// Mock the botframework-webchat library
vi.mock('botframework-webchat', () => ({
  default: vi.fn(() => <div data-testid="webchat" />),
  createDirectLine: vi.fn(() => ({})),
}));

describe('AzureBotChat', () => {
  it('renders the webchat component', () => {
    render(<AzureBotChat directLineSecret="test-secret" />);
    expect(screen.getByTestId('webchat')).toBeInTheDocument();
  });

  it('throws an error when no secret or token is provided', () => {
    expect(() => render(<AzureBotChat />)).toThrowError(
      'Either directLineSecret or directLineToken must be provided'
    );
  });
});
