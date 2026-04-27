import { createHashRouter } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { Home } from "./pages/Home";
import { Lobby } from "./pages/Lobby";
import { Room } from "./pages/Room";
import { Login, Register } from "./pages/Auth";
import { Rules } from "./pages/Rules";
import { Leaderboard } from "./pages/Leaderboard";
import { Profile } from "./pages/Profile";

export const router = createHashRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Home },
      { path: "lobby", Component: Lobby },
      { path: "room/:id", Component: Room },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
      { path: "rules", Component: Rules },
      { path: "leaderboard", Component: Leaderboard },
      { path: "profile", Component: Profile },
    ],
  },
]);
