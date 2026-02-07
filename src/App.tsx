import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, Component, ErrorInfo, ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Enhanced loading component for suspense fallback
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-sidebar to-background">
    <div className="relative">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-gold-300 border-t-transparent"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full bg-gold-500 opacity-20"></div>
      </div>
    </div>
    <p className="mt-6 text-lg font-medium text-sidebar-foreground animate-pulse">
      Loading CaseBuddy...
    </p>
    <p className="mt-2 text-sm text-muted-foreground">
      Preparing your legal workspace
    </p>
  </div>
);

// Error boundary component for better error handling
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-sidebar to-background p-4">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-sidebar-foreground mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">
              We apologize for the inconvenience. Please try refreshing the page or contact support if the problem persists.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gold-500 text-white font-medium rounded-lg hover:bg-gold-600 transition-colors w-full sm:w-auto"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Lazy load all route components for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cases = lazy(() => import("./pages/Cases"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Research = lazy(() => import("./pages/Research"));
const TrialPrep = lazy(() => import("./pages/TrialPrep"));
const Video = lazy(() => import("./pages/Video"));
const Billing = lazy(() => import("./pages/Billing"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized React Query configuration for better performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Increase stale time for less frequent refetches
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Cache data for 10 minutes
      gcTime: 10 * 60 * 1000, // formerly cacheTime
      // Retry failed requests with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Only refetch on window focus for important data
      refetchOnWindowFocus: 'always',
      // Don't refetch on reconnect by default
      refetchOnReconnect: false,
      // Don't refetch on mount if data is fresh
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Main App component with routing fix
const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Fixed: Direct route to Landing page at root */}
                <Route path="/" element={<Landing />} />
                
                {/* Fixed: Login page */}
                <Route path="/login" element={<Login />} />
                
                {/* Protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cases"
                  element={
                    <ProtectedRoute>
                      <Cases />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cases/:id"
                  element={
                    <ProtectedRoute>
                      <CaseDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/calendar"
                  element={
                    <ProtectedRoute>
                      <Calendar />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/research"
                  element={
                    <ProtectedRoute>
                      <Research />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/trial-prep"
                  element={
                    <ProtectedRoute>
                      <TrialPrep />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/video"
                  element={
                    <ProtectedRoute>
                      <Video />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/billing"
                  element={
                    <ProtectedRoute>
                      <Billing />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                
                {/* 404 page */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;