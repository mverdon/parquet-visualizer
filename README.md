# Parquet Visualizer

Web-based tool for viewing and querying Parquet files. Everything runs in the browser using DuckDB WASM.

## What it does

Drop in a Parquet file (or multiple files, or a whole folder) and you can:

- Browse the data with sorting, filtering, and pagination
- See the schema and basic statistics
- Run SQL queries across one or more files
- Export results to CSV or JSON
- Use the visual filter builder if you don't want to write SQL

The SQL editor has autocomplete and query history. You can join multiple files together since each file gets registered as a table in DuckDB.

All processing happens locally in your browser - files never leave your machine.

## Built with

- SvelteKit + TypeScript
- DuckDB-WASM for the Parquet engine
- Monaco Editor for SQL editing
- AG-Grid for the data table
- TailwindCSS for styling

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

To build for production:

```bash
npm run build
```

Output goes to `.svelte-kit/cloudflare` for deployment to Cloudflare Pages.

## Customizing the theme

Design tokens are in `tailwind.config.js`. Change the colors there and the whole app updates:

```javascript
colors: {
  background: '#fafafa',
  foreground: '#171717',
  muted: '#f5f5f5',
  border: '#e5e5e5',
  accent: '#2563eb',
  // etc...
}
```

## Project structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/              # Button, Card, Badge, ThemeToggle
│   │   ├── DataGrid.svelte
│   │   ├── SqlEditor.svelte
│   │   ├── QueryResults.svelte
│   │   └── ...
│   ├── duckdb.ts            # DuckDB wrapper
│   ├── parquet-loader.ts    # File loading
│   └── schema-utils.ts
├── routes/
│   └── +page.svelte         # Main app
└── app.css
```

## License

MIT
