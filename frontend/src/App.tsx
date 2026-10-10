import { createBrowserRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { Providers } from '@/app/Providers';
import { routes } from '@/app/routes';

/** Wrap the route tree so providers can use router hooks. */
export function withProviders(routeList: RouteObject[]): RouteObject[] {
  return routeList.map((r) => ({ ...r, element: <Providers>{r.element}</Providers> }));
}

const router = createBrowserRouter(withProviders(routes));

export default function App() {
  return <RouterProvider router={router} />;
}
