import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getCloudAuthContext, type CloudAuthContext } from "./server";
import { metadataForCloudSession, type CloudSessionKind, type CloudSessionPayload } from "./session-metadata";

export type CloudContextProvider = () => Promise<CloudAuthContext>;

export class CloudStorageError extends Error {
  constructor(message: string, public readonly code = "cloud_storage_failed", public readonly status = 503) {
    super(message);
    this.name = "CloudStorageError";
  }
}

function authenticated(context: CloudAuthContext): context is { state: "authenticated"; client: SupabaseClient; user: User } {
  return context.state === "authenticated";
}

export async function saveCloudSession(
  kind: CloudSessionKind,
  payload: CloudSessionPayload,
  contextProvider: CloudContextProvider = getCloudAuthContext,
): Promise<boolean> {
  const context = await contextProvider();
  if (!authenticated(context)) return false;
  const metadata = metadataForCloudSession(kind, payload);
  const { error } = await context.client.from("learning_sessions").upsert({
    user_id: context.user.id,
    client_id: metadata.clientId,
    kind,
    title: metadata.title,
    subtitle: metadata.subtitle,
    provider_label: metadata.providerLabel,
    payload,
    schema_version: 1,
    created_at: metadata.createdAt,
    updated_at: metadata.updatedAt,
  }, { onConflict: "user_id,kind,client_id" });
  if (error) throw new CloudStorageError("Unable to save the cloud learning session.");
  return true;
}

export async function loadCloudSession<T extends CloudSessionPayload>(
  kind: CloudSessionKind,
  clientId: string,
  contextProvider: CloudContextProvider = getCloudAuthContext,
): Promise<{ usedCloud: boolean; payload: T | null }> {
  const context = await contextProvider();
  if (!authenticated(context)) return { usedCloud: false, payload: null };
  const { data, error } = await context.client
    .from("learning_sessions")
    .select("payload")
    .eq("kind", kind)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new CloudStorageError("Unable to read the cloud learning session.");
  return { usedCloud: true, payload: data?.payload as T | null };
}

export async function deleteCloudSession(
  kind: CloudSessionKind,
  clientId: string,
  contextProvider: CloudContextProvider = getCloudAuthContext,
): Promise<{ usedCloud: boolean; deleted: boolean }> {
  const context = await contextProvider();
  if (!authenticated(context)) return { usedCloud: false, deleted: false };
  const { data, error } = await context.client
    .from("learning_sessions")
    .delete()
    .eq("kind", kind)
    .eq("client_id", clientId)
    .select("id");
  if (error) throw new CloudStorageError("Unable to delete the cloud learning session.");
  return { usedCloud: true, deleted: Boolean(data?.length) };
}

export interface CloudLibraryRow {
  client_id: string;
  kind: CloudSessionKind;
  title: string;
  subtitle: string;
  provider_label: string;
  updated_at: string;
}

export async function listCloudSessions(
  contextProvider: CloudContextProvider = getCloudAuthContext,
): Promise<CloudLibraryRow[] | null> {
  const context = await contextProvider();
  if (!authenticated(context)) return null;
  const { data, error } = await context.client
    .from("learning_sessions")
    .select("client_id,kind,title,subtitle,provider_label,updated_at")
    .order("updated_at", { ascending: false })
    .limit(400);
  if (error) throw new CloudStorageError("Unable to list cloud learning sessions.");
  return (data || []) as CloudLibraryRow[];
}
