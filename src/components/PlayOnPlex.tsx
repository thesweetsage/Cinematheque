"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/*
 * Play on Plex. On Android (the TV box, phones) it opens the Plex app with its plex://preplay link
 * (undocumented by Plex, so check it on the box); elsewhere it opens the title in Plex Web.
 */
export function PlayOnPlex({ machineId, ratingKey, series }: { machineId: string; ratingKey: string; series: boolean }) {
  const android = useSyncExternalStore(noop, () => /Android/i.test(navigator.userAgent), () => false);
  const key = encodeURIComponent(`/library/metadata/${ratingKey}`);
  const href = android
    ? `plex://preplay/?metadataKey=${key}&metadataType=${series ? 2 : 1}&server=${machineId}`
    : `https://app.plex.tv/desktop#!/server/${machineId}/details?key=${key}`;
  return <a className="btn primary" href={href} target={android ? undefined : "_blank"} rel="noreferrer">Play on Plex ▶</a>;
}
