import { supabase } from "@/integrations/supabase/client";

let cachedUsers: any[] | null = null;
let cacheTimestamp = 0;
let pendingRequest: Promise<any[]> | null = null;

const CACHE_TTL = 30000; // 30 seconds

export async function fetchAdminUsers(): Promise<any[]> {
  const now = Date.now();
  
  // Return cached data if fresh
  if (cachedUsers && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedUsers;
  }

  // Deduplicate concurrent requests
  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = (async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return [];

      const response = await fetch(
        `https://gidvpxxfgvivjbzfpxcg.supabase.co/functions/v1/admin-users`,
        {
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) return cachedUsers || [];

      const data = await response.json();
      cachedUsers = data.users || [];
      cacheTimestamp = Date.now();
      return cachedUsers;
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return cachedUsers || [];
    } finally {
      pendingRequest = null;
    }
  })();

  return pendingRequest;
}

export function invalidateAdminUsersCache() {
  cachedUsers = null;
  cacheTimestamp = 0;
}
