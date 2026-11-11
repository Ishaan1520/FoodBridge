# FoodBridge backend integration – change log

## Files changed
- `src/lib/store.js`: replaced localStorage/demo seed persistence with Supabase queries for donations, requests, assignments, notifications and community profiles. Added realtime database change subscription and refresh, maps database snake_case fields to the existing UI shape, and makes create/update actions asynchronous.
- `src/lib/supabase.js`: supports the Supabase anon key or publishable key and configures persistent browser auth sessions.
- `src/App.jsx`: changes ownership filters to stable Supabase user IDs; awaits donation/request/delivery operations; replaces the hardcoded demo volunteer with the first registered volunteer; changes the admin directory to live community profiles.
- `supabase/schema.sql`: adds a secure database trigger to keep donation lifecycle status synchronized with volunteer assignment progress, plus an admin donation read policy.
- `.env.example`: documents the two browser-safe Vite environment variables. The original `.env` has deliberately been excluded.
- `vercel.json`: adds SPA route rewrites so React Router paths work on Vercel refresh/deep links.

## New runtime flow
1. Supabase Auth signs in/registers the user. The existing `handle_new_user` trigger in `schema.sql` creates the matching profile.
2. `store.js` fetches the five application tables and the `community_profiles` view for the signed-in user.
3. Donation creation inserts into `donations`; NGO requests insert into `donation_requests`; donor approval updates request and donation state; NGO assignment inserts a registered volunteer into `pickup_assignments`; volunteer progress updates the assignment. A database trigger updates donation status when delivery advances.
4. Supabase Realtime changes refresh the client-side data cache.

## Required before deployment
- In Supabase SQL Editor, run the updated `supabase/schema.sql` against the project. Review the SQL and existing policies first; the script includes `create or replace`, trigger creation and named policy creation. If running over an existing schema with differently named policies, inspect and remove conflicting policies deliberately.
- Ensure Realtime is enabled for `donations`, `donation_requests`, `pickup_assignments` and `notifications` in Supabase publication settings. The app will still refresh after its own writes without Realtime, but cross-user live refresh requires publication membership.
- Set Vercel environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`) for Production and Preview, then redeploy.
- Create the admin account through normal signup, then promote its `profiles.role` to `admin` from the Supabase SQL editor as project owner. Never expose a service-role key in Vite or Vercel client variables.
- Have at least one registered volunteer account before an NGO attempts to assign a delivery.
- Test donor signup/login, donation creation, NGO request, donor accept, NGO assignment, volunteer status progression and admin visibility using separate browser sessions/accounts.

## Known limitations / verification
- The local build could not be verified in this execution environment because dependency installation (`npm install`) timed out and Vite was unavailable. Run `npm ci && npm run build` locally before deployment.
- The existing schema's `community_profiles` view is used as a limited profile directory. Verify its grants and view security settings in your Supabase project.
- The donor form currently supplies a placeholder Lucknow coordinate and human-readable availability text from the existing UI; those values are not reliable GPS/time inputs. The store safely stores unparsable date strings as null. Update the form to collect actual date/time and GPS before production use.
- Image URL is stored if supplied; this update does not implement a new Storage upload UI.
- Admin user listing depends on the community profile view being available to authenticated users. Do not add email or phone fields to that public directory view.