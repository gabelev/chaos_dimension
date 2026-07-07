// Copyright (C) 2026 Gabe Levine
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, version 3.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Landing from './pages/Landing';
import About from './pages/About';
import Login from './pages/Login';
import Signup from './pages/Signup';
import App from './pages/App';
import Connect from './pages/Connect';
import Admin from './pages/Admin';
import OauthConsent from './pages/OauthConsent';
import PublicLedger from './pages/PublicLedger';
import { api } from './lib/api';

const PUBLIC_DEMO = import.meta.env.VITE_PUBLIC_DEMO === 'true';

function ProtectedApp() {
  const [state, setState] = useState('loading');
  useEffect(() => {
    api.me().then(() => setState('ok')).catch(() => setState('redirect'));
  }, []);
  if (state === 'loading') return null;
  if (state === 'redirect') return <Navigate to="/login" replace />;
  return <App mode="live" />;
}

// Owner-only gate. Non-owners (and signed-out visitors) are redirected to the
// board, which itself bounces signed-out users to /login.
function OwnerOnly({ children }) {
  const [state, setState] = useState('loading');
  useEffect(() => {
    api.me().then((r) => setState(r?.isOwner ? 'ok' : 'redirect')).catch(() => setState('redirect'));
  }, []);
  if (state === 'loading') return null;
  if (state === 'redirect') return <Navigate to="/app" replace />;
  return children;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: PUBLIC_DEMO ? <Landing /> : <Navigate to="/login" replace />,
  },
  { path: '/about', element: <About /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/app', element: <ProtectedApp /> },
  { path: '/connect', element: <Connect /> },
  { path: '/admin', element: <OwnerOnly><Admin /></OwnerOnly> },
  { path: '/oauth/consent', element: <OauthConsent /> },
  // Public ledger vanity URLs (e.g. /mold). Dynamic segments rank below the
  // static routes above, so this only catches otherwise-unmatched paths; a
  // slug that isn't a public workstream renders the page's not-found state.
  { path: '/:slug', element: <PublicLedger /> },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
