"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-red-600">
          Something went wrong!
        </h2>
        <p className="mt-2 text-gray-600">
          {error.message || "An error occurred"}
        </p>
        <button
          onClick={() => router.push("/login")}
          className="mt-4 rounded bg-[var(--brand)] px-4 py-2 text-white"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}
