import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

export default function createAppRouter() {
  return createBrowserRouter(routes, { basename: '/' });
}
