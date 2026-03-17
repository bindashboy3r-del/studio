
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirects to the new Home Page (/chat) which now contains the order form.
 */
export default function NewOrderPageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/chat');
  }, [router]);

  return null;
}
