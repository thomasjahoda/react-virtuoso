const config = {
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
  plugins: ['prettier-plugin-astro'],
  printWidth: 140,
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
}
export default config
