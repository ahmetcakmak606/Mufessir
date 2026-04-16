# Railway Deployment Debug Guide

## Common Build Issues

### TypeScript Not Found (tsc: not found)

**Error**: `sh: 1: tsc: not found`
**Fix**: Use `tsc` which should be in PATH after npm install

```json
"build": "tsc -p tsconfig.json"
```

### npm exec npx Issues

- **DON'T use**: `npx tsc`, `npx typescript`, `npm exec tsc`  
  These pull fake packages or have PATH issues in Railway's container
- **Avoid**: `node ../../node_modules/typescript/bin/tsc` - path differs between local and Railway

### Working Build Command

```json
"build": "tsc -p tsconfig.json"
```

This works because Railway copies package\*.json first, runs `npm install`, then runs build - tsc should be in PATH from the monorepo's node_modules/.bin

---

## Debug Steps

1. **Check error message** - Is it "tsc not found", "npx tsc fake package", or path error?

2. **Test locally first**:

   ```bash
   cd apps/backend && npm run build
   ```

3. **Check Railway logs** - Look for the exact error at the `[9/9] RUN npm run build` step

4. **Common fixes in order**:
   - Try `tsc -p tsconfig.json` (simplest)
   - Try `npx typescript` (with -p flag)
   - Check if typescript is in monorepo root's node_modules/.bin

---

## What NOT to Do

- Don't use hardcoded paths like `/app/node_modules/...`
- Don't use complex bash scripts with `test -d /app`
- Don't use `npm exec` or `npx` without testing locally first

---

## Local Testing

Before push, ALWAYS run:

```bash
cd apps/backend && npm run build && node dist/src/index.js
```

And check the health endpoint:

```bash
curl http://localhost:4000/health
```
