// Types from svelte-spa-router are not compatible with Svelte 5 yet; avoid strict typing here
import Landing from './views/Landing.svelte';
import Login from './views/Login.svelte';
import Register from './views/Register.svelte';
import Dashboard from './views/Dashboard.svelte';
import Trip from './views/Trip.svelte';
import Profile from './views/Profile.svelte';
import AddExpense from './views/AddExpense.svelte';

const routes = {
  '/': Landing,
  '/login': Login,
  '/register': Register,
  '/dashboard': Dashboard,
  '/trip/:id': Trip,
  '/trip/:id/add-expense': AddExpense,
  '/profile': Profile,
} as any;

export default routes;
