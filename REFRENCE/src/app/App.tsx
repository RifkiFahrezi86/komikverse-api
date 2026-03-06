import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { ProjectProvider } from "./components/ProjectContext";
import { AuthProvider } from "../lib/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <RouterProvider router={router} />
      </ProjectProvider>
    </AuthProvider>
  );
}
