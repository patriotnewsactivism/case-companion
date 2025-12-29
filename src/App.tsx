import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Loading component for suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
  </div>
);

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
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
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;