module.exports = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px', // Extra small breakpoint for better mobile control
      },
    },
  },
  plugins: [],
}
