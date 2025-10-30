// This file is now the one and only config.
// We are using module.exports and require, which is the most stable syntax.
module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('autoprefixer'),
  ],
}

