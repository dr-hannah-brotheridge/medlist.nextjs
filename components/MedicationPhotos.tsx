"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MedicationPhotoWithUrl } from "@/lib/types";
import { PlusIcon, SpinnerIcon } from "@/components/icons";

const MAX_PHOTOS = 4;

export function MedicationPhotos({
  userId,
  patientMedicationId,
  initial,
}: {
  userId: string;
  patientMedicationId: number;
  initial: MedicationPhotoWithUrl[];
}) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<MedicationPhotoWithUrl[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from("medication_photos")
      .select("*")
      .eq("patient_medication_id", patientMedicationId)
      .order("position", { ascending: true });
    if (error) {
      setError(error.message);
      return;
    }
    const rows = (data ?? []) as Omit<MedicationPhotoWithUrl, "url">[];
    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from("medication-photos")
          .createSignedUrl(row.storage_path, 3600);
        return { ...row, url: signed?.signedUrl ?? "" } as MedicationPhotoWithUrl;
      }),
    );
    setPhotos(withUrls);
  }, [supabase, patientMedicationId]);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      setError(`You can only upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const nextPosition = photos.length > 0 ? Math.max(...photos.map((p) => p.position)) + 1 : 0;
      const storagePath = `${userId}/${patientMedicationId}/${nextPosition}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("medication-photos")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: rowErr } = await supabase.from("medication_photos").insert({
        patient_medication_id: patientMedicationId,
        user_id: userId,
        storage_path: storagePath,
        position: nextPosition,
      });
      if (rowErr) throw rowErr;
      await refreshPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(index: number) {
    const photo = photos[index];
    if (!photo) return;
    if (!confirm("Delete this photo?")) return;
    setError(null);
    try {
      const { error: rowErr } = await supabase.from("medication_photos").delete().eq("id", photo.id);
      if (rowErr) throw rowErr;
      await supabase.storage.from("medication-photos").remove([photo.storage_path]);
      setLightboxIndex(null);
      await refreshPhotos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  const closeLightbox = () => setLightboxIndex(null);
  const nextPhoto = () => setLightboxIndex((i) => (i === null ? i : (i + 1) % photos.length));
  const prevPhoto = () => setLightboxIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") nextPhoto();
      else if (e.key === "ArrowLeft") prevPhoto();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, photos.length]);

  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0]?.clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) nextPhoto();
      else prevPhoto();
    }
    touchStartX.current = null;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-card p-4">
      <h2 className="text-base font-semibold text-slate-900">Medication Photos</h2>
      <p className="mt-1 text-sm text-slate-500">
        Upload an image of your prescription or medications so you know what they look like. Never mix up your different pills again!
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setLightboxIndex(i)} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Medication photo ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-400 hover:text-brand-500 disabled:opacity-60" aria-label="Add photo">
            {uploading ? <SpinnerIcon width={22} height={22} /> : <PlusIcon width={22} height={22} />}
          </button>
        ) : null}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />
      {photos.length > 0 ? (
        <p className="mt-2 text-xs text-slate-400">{photos.length}/{MAX_PHOTOS} photos · tap to view</p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {lightboxIndex !== null && photos[lightboxIndex] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={closeLightbox} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <button type="button" onClick={(e) => { e.stopPropagation(); closeLightbox(); }} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(lightboxIndex); }} className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-600/90 text-white transition hover:bg-red-600" aria-label="Delete photo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          {photos.length > 1 ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); prevPhoto(); }} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4" aria-label="Previous">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[lightboxIndex].url} alt={`Medication photo ${lightboxIndex + 1}`} className="max-h-[85vh] max-w-[90vw] object-contain" onClick={(e) => e.stopPropagation()} />
          {photos.length > 1 ? (
            <button type="button" onClick={(e) => { e.stopPropagation(); nextPhoto(); }} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4" aria-label="Next">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ) : null}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
            {lightboxIndex + 1} / {photos.length}
          </span>
        </div>
      ) : null}
    </section>
  );
}