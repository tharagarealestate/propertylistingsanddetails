// 🔹 getMatches.js
// Fetch buyer matches from Supabase cached_matches by id

const SUPABASE_URL = "https://wedevtjjmdvngyshqdro.supabase.co"; // ⬅️ replace with yours
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZGV2dGpqbWR2bmd5c2hxZHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0NzYwMzgsImV4cCI6MjA3MTA1MjAzOH0.Ex2c_sx358dFdygUGMVBohyTVto6fdEQ5nydDRh9m6M";               // ⬅️ replace with your anon key

async function fetchMatchesById(id) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cached_matches?id=eq.${id}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
    }
    const rows = await res.json();
    if (!rows.length) return null;

    return rows[0]; // { id, results, created_at }
  } catch (err) {
    console.error("fetchMatchesById failed:", err);
    return null;
  }
}
