import type { RouteDefinition } from 'svelte-spa-router';
import Landing from './views/Landing.svelte';
import Login from './views/Login.svelte';
import Register from './views/Register.svelte';
import Dashboard from './views/Dashboard.svelte';
import Trip from './views/Trip.svelte';

const routes: RouteDefinition = {
  '/': Landing,
  '/login': Login,
  '/register': Register,
  '/dashboard': Dashboard,
  '/trip/:id': Trip,
};

export default routes;
