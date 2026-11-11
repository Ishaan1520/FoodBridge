# FoodBridge

A friendly food-rescue platform with separate Donor, NGO, Volunteer and Admin interfaces.

## Current project status

- Supabase Auth: connected for real user registration, login, session restore and logout.
- Profiles: created automatically by the database trigger when a user signs up.
- Role selection: public registration supports donor, NGO and volunteer. Admin accounts must be provisioned separately by the project owner.
- Dashboard workflows: still use local demo data at this stage. Shared Supabase donations, requests, assignments, notifications and live location are later integration stages.

Do not describe the dashboard data workflows as multi-user/live until those stages are implemented and tested.

## Run locally

1. Install Node.js LTS if it is not already installed: https://nodejs.org/
2. Extract this ZIP and open the `FoodBridge` folder in VS Code.
3. Copy `.env.example` to a new file named `.env` in the project root.
4. Add your Supabase Project URL and publishable key to `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_YOUR_KEY