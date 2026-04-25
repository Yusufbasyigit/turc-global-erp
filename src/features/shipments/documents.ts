import { createClient } from "@/lib/supabase/client";
import { SHIPMENT_DOCUMENTS_BUCKET } from "@/lib/constants";

export async function uploadShipmentDocument(
  shipmentId: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "bin";
  const path = `${shipmentId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(SHIPMENT_DOCUMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  return path;
}

export async function deleteShipmentDocument(path: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(SHIPMENT_DOCUMENTS_BUCKET)
    .remove([path]);
  if (error) throw error;
}
