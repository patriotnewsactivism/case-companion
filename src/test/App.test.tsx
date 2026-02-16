import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock lazy imports to avoid actual component loading in tests
vi.mock('@/pages/Landing', () => ({
  default: () => <div>Landing Page</div>
}));

vi.mock('@/pages/Login', () => ({
  default: () => <div>Login Page</div>
}));

vi.mock('@/pages/Dashboard', () => ({
  default: () => <div>Dashboard Page</div>
}));

vi.mock('@/pages/Cases', () => ({
  default: () => <div>Cases Page</div>
}));

vi.mock('@/pages/CaseDetail', () => ({
  default: () => <div>Case Detail Page</div>
}));

vi.mock('@/pages/Calendar', () => ({
  default: () => <div>Calendar Page</div>
}));

vi.mock('@/pages/Research', () => ({
  default: () => <div>Research Page</div>
}));

vi.mock('@/pages/TrialPrep', () => ({
  default: () => <div>Trial Prep Page</div>
}));

vi.mock('@/pages/Video', () => ({
  default: () => <div>Video Page</div>
}));

vi.mock('@/pages/Settings', () => ({
  default: () => <div>Settings Page</div>
}));

vi.mock('@/pages/NotFound', () => ({
  default: () => <div>Not Found Page</div>
}));

vi.mock('@/hooks/useAuth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div>Toaster</div>
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => <div>Sonner Toaster</div>
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('App Component', () => {
  it('should render without crashing', () => {
    render(<App />);

    // The app should render without throwing errors
    expect(document.body).toBeInTheDocument();
  });

  it('should render the landing route', async () => {
    render(<App />);
    expect(await screen.findByText('Landing Page')).toBeInTheDocument();
  });
});
