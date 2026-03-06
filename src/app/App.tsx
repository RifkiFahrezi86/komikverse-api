import { createBrowserRouter, RouterProvider } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import DashboardPage from "./components/DashboardPage";
import EndpointTester from "./components/EndpointTester";
import CachePage from "./components/CachePage";
import LogsPage from "./components/LogsPage";

const router = createBrowserRouter([
  {
    element: <DashboardLayout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/tester", element: <EndpointTester /> },
      { path: "/cache", element: <CachePage /> },
      { path: "/logs", element: <LogsPage /> },
    ],
  },
], { basename: "/dashboard" });

export default function App() {
  return <RouterProvider router={router} />;
}
