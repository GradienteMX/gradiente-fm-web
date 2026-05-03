'use client'

// ── Image upload — compress + upload to Supabase Storage ───────────────────
//
// Replaces the prototype's data-URL-in-jsonb path. Files are compressed in
// a Web Worker via browser-image-compression, then uploaded to the
// `uploads` bucket (migration 0013) under `${user.id}/${random}.{ext}`.
// The returned public URL goes wherever the data URL used to (item.imageUrl,
// foro post imageUrl, marketplace listing image, etc).
//
// GIFs pass through uncompressed — recompression destroys animation. The
// caller's per-surface size cap should account for this (foro: GIFs allowed
// under stricter raw caps per Backend Plan).
//
// Path layout:
//   uploads/<user.id>/<timestamp>-<rand>.<ext>
// First folder segment is the auth uid — the storage RLS policies gate
// writes by `(storage.foldername(name))[1] = auth.uid()::text`.

import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'

export interface UploadOptions {
  /** Target compressed output size in MB. Default 1MB. */
  maxSizeMB?: number
  /** Cap the longest image dimension. Default 1920. */
  maxWidthOrHeight?: number
}

export type UploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string }

export async function compressAndUploadImage(
  file: File,
  userId: string,
  opts?: UploadOptions,
): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    return { ok: false, error: 'Solo imágenes (jpg, png, webp, gif).' }
  }

  // GIFs lose animation under recompression — pass through. The browser-image
  // -compression library would render them as still frames otherwise.
  const isGif = file.type === 'image/gif'
  let toUpload: Blob | File = file
  let extension = inferExtension(file)

  if (!isGif) {
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: opts?.maxSizeMB ?? 1,
        maxWidthOrHeight: opts?.maxWidthOrHeight ?? 1920,
        useWebWorker: true,
        // browser-image-compression converts to JPEG by default for non-PNG;
        // explicit so the extension we infer matches what we upload.
        fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
      })
      toUpload = compressed
      extension = file.type === 'image/png' ? 'png' : 'jpg'
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'compression failed',
      }
    }
  }

  const supabase = createClient()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  const { error } = await supabase.storage
    .from('uploads')
    .upload(path, toUpload, {
      cacheControl: '3600',
      upsert: false,
      contentType: isGif ? 'image/gif' : `image/${extension}`,
    })
  if (error) {
    return { ok: false, error: error.message }
  }

  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
  return { ok: true, url: urlData.publicUrl, path }
}

function inferExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  // Fall back to mime — strips the "image/" prefix.
  const fromMime = file.type.split('/')[1]?.toLowerCase()
  return fromMime || 'jpg'
}
