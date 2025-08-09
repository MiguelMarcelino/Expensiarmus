import type { RouteDefinition } from 'svelte-spa-router';
import Login from './views/Login.svelte';
import Register from './views/Register.svelte';
import Dashboard from './views/Dashboard.svelte';
import Trip from './views/Trip.svelte';

const routes: RouteDefinition = {
  '/': Dashboard,
  '/login': Login,
  '/register': Register,
  '/trip/:id': Trip,
};

export default routes;
