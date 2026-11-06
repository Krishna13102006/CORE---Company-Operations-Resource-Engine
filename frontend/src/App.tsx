import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ModalProvider } from './context/ModalContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { ScrollToTop } from './components/ScrollToTop';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-loaded pages for optimized bundle size & fast initial load
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const Docs = lazy(() => import('./pages/Docs').then((m) => ({ default: m.Docs })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/TermsOfService').then((m) => ({ default: m.TermsOfService })));
const SecurityCompliance = lazy(() => import('./pages/SecurityCompliance').then((m) => ({ default: m.SecurityCompliance })));
const Contact = lazy(() => import('./pages/Contact').then((m) => ({ default: m.Contact })));
const PublicCareers = lazy(() => import('./pages/PublicCareers').then((m) => ({ default: m.PublicCareers })));
const PublicInterviewBooking = lazy(() => import('./pages/PublicInterviewBooking').then((m) => ({ default: m.PublicInterviewBooking })));

const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/Signup').then((m) => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite').then((m) => ({ default: m.AcceptInvite })));

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Documents = lazy(() => import('./pages/Documents').then((m) => ({ default: m.Documents })));
const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })));
const Departments = lazy(() => import('./pages/Departments').then((m) => ({ default: m.Departments })));
const Hiring = lazy(() => import('./pages/Hiring').then((m) => ({ default: m.Hiring })));
const Database = lazy(() => import('./pages/Database').then((m) => ({ default: m.Database })));
const MailPage = lazy(() => import('./pages/Mail').then((m) => ({ default: m.MailPage })));
const Meetings = lazy(() => import('./pages/Meetings').then((m) => ({ default: m.Meetings })));
const MeetingRoom = lazy(() => import('./pages/MeetingRoom').then((m) => ({ default: m.MeetingRoom })));
const MeetingDetail = lazy(() => import('./pages/MeetingDetail').then((m) => ({ default: m.MeetingDetail })));
const Expenses = lazy(() => import('./pages/Expenses').then((m) => ({ default: m.Expenses })));
const Automations = lazy(() => import('./pages/Automations').then((m) => ({ default: m.Automations })));

const PageLoader: React.FC = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
    <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono tracking-wider animate-pulse">
      LOADING...
    </span>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ThemeProvider>
          <ScrollToTop />
        <AuthProvider>
          <ModalProvider>
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
            {/* Public Marketing, Legal & Documentation Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/security" element={<SecurityCompliance />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/careers/:slug" element={<PublicCareers />} />
            <Route path="/careers/:slug/jobs/:jobId" element={<PublicCareers />} />
            <Route path="/careers/schedule/:token" element={<PublicInterviewBooking />} />

            {/* Public Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />

            {/* Protected Workspace Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={<Navigate to="/documents" replace />}
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Documents />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Projects />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/departments"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'manager', 'employee']}>
                  <Layout>
                    <Departments />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaves"
              element={<Navigate to="/departments" replace />}
            />
            <Route
              path="/finance"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'manager', 'employee']}>
                  <Layout>
                    <Expenses />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={<Navigate to="/finance" replace />}
            />
            <Route
              path="/hiring"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr']}>
                  <Layout>
                    <Hiring />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/governance"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <Database />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/database"
              element={<Navigate to="/governance" replace />}
            />

            <Route
              path="/automations"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Layout>
                    <Automations />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/mail"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'manager', 'employee']}>
                  <Layout>
                    <MailPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/meetings"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'manager', 'employee']}>
                  <Layout>
                    <Meetings />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/meetings/room/:roomCode"
              element={<MeetingRoom />}
            />

            <Route
              path="/meetings/:id"
              element={
                <ProtectedRoute allowedRoles={['admin', 'hr', 'manager', 'employee']}>
                  <Layout>
                    <MeetingDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Catch All Redirect to Landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
        <CookieConsentBanner />
          </ModalProvider>
        </AuthProvider>
        </ThemeProvider>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
