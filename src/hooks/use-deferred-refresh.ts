"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export function useDeferredRefresh() {
  const router = useRouter();
  const [needsRefresh, setNeedsRefresh] = React.useState(false);

  const markForRefresh = React.useCallback(() => {
    setNeedsRefresh(true);
  }, []);

  const flushRefresh = React.useCallback(() => {
    if (needsRefresh) {
      setNeedsRefresh(false);
      router.refresh();
    }
  }, [needsRefresh, router]);

  return { markForRefresh, flushRefresh };
}
