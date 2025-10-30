// This file is now the one and only config.
// We are using module.exports and require, which is the most stable syntax.
// The .cjs extension tells Node to read this as a CommonJS file.
module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('autoprefixer'),
  ],
}
