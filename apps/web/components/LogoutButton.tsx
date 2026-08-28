"use client";

export default function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        className="game-header__menu-item block w-full rounded-xl px-3 py-2 text-left font-semibold transition"
      >
        Log Out
      </button>
    </form>
  );
}
