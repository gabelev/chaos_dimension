import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Landing from './pages/Landing';
import About from './pages/About';
import Login from './pages/Login';
import App from './pages/App';
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
  { path: '/app', element: <ProtectedApp /> },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
