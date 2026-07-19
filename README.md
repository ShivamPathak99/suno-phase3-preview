# Suno

Suno is a teacher-first oral-reading assessment workflow for early-grade classrooms.

## Foundation setup

1. Copy `.env.example` to `.env.local` and add the service credentials when they are available.
2. Install dependencies with `npm.cmd install` on Windows or `npm install` elsewhere.
3. Run `npm run dev`.

The C-1 foundation intentionally contains no live OpenAI or Supabase calls. Those arrive through the frozen Agent A and Agent C tickets.
