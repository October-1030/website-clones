# AuthApp specification

Target src/components/auth-app.tsx. Page assembly only. Hash navigation: #/auth/register shows registration, all other hashes show login until an authenticated dashboard can be inspected. Hash changes must work with browser Back/Forward. Locale is local React state retained between auth routes. Key the form by route to clear sensitive field values on route changes. No auth state, cookies, localStorage credentials, network requests, or fictional dashboard.
