"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });

    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "10px 14px",
        marginTop: "20px",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}
