/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{svelte,ts,js}',
    './node_modules/@skeletonlabs/skeleton/**/*.svelte'
  ],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/forms')],
};
