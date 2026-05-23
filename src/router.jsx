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
import OauthConsent from './pages/OauthConsent';
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
  { path: '/oauth/consent', element: <OauthConsent /> },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
