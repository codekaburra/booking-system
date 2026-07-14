import "server-only";

import { cookies } from "next/headers";
import { hasSupabaseEnv } from "@/lib/data";
import { createAuthClient } from "@/lib/supabase/server-auth";
import { isAdminUser } from "@/lib/auth/admin";
import type { Client } from "@/types/db";
import { getClientDataSource } from "@/lib/data/client";

export const DEMO_CLIENT_COOKIE = "demo_client_session";

export interface ClientSession {
  demo: boolean;
  clientId: string;
  name: string;
  phone: string;
  email: string | null;
}

export async function getClientSession(): Promise<ClientSession | null> {
  if (hasSupabaseEnv()) {
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || isAdminUser(user)) return null;
    const ds = await getClientDataSource();
    const client = await ds.findClientByAuthUserId(user.id);
    if (!client) return null;
    return {
      demo: false,
      clientId: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email,
    };
  }

  const jar = await cookies();
  const raw = jar.get(DEMO_CLIENT_COOKIE)?.value;
  if (!raw) return null;
  const ds = await getClientDataSource();
  const client = await ds.findClientById(raw);
  if (!client) return null;
  return {
    demo: true,
    clientId: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
  };
}

export async function requireClient(): Promise<ClientSession> {
  const session = await getClientSession();
  if (!session) throw new Error("unauthorized");
  return session;
}

export function clientToSession(client: Client, demo: boolean): ClientSession {
  return {
    demo,
    clientId: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
  };
}
