# PTO Connect Backend

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your Supabase URL and Service Role Key
3. Install dependencies:

```
npm install
```

4. Start the server:

```
npm start
```

## Routes

- `GET /` — health check
- `GET /auth/check` — verifies Supabase token from Authorization header