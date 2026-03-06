import { Outlet } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout";
import { AdminProvider } from "./admin/AdminContext";

export default function AdminPanel() {
  return (
    <AdminProvider>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </AdminProvider>
  );
}
