"use client";
import { useEffect } from "react";
import { adoptWorkspace, pullWorkspace } from "@/lib/sync";

/** Opening "/?ws=…" (the device link) joins that workspace, then pulls its data into this browser. */
export function WorkspaceSync() {
  useEffect(() => {
    const url = new URL(location.href);
    const ws = url.searchParams.get("ws");
    if (ws && adoptWorkspace(ws)) {
      url.searchParams.delete("ws");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
      pullWorkspace().then(() => location.assign("/new"));
    }
  }, []);
  return null;
}
