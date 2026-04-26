import { Outlet } from "react-router";
import { Navbar } from "../components/Navbar";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
