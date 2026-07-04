"use client";

export default function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="rounded-md border border-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/10"
      >
        Logout
      </button>
    </form>
  );
}
