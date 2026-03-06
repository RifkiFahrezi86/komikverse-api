import { createBrowserRouter, Navigate } from "react-router-dom";
import { createElement } from "react";
import LandingPage from "./components/LandingPage";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ProtectedRoute from "./components/ProtectedRoute";
import CustomerDashboard from "./components/CustomerDashboard";
import AdminPanel from "./components/AdminPanel";
import DashboardPage from "./components/admin/DashboardPage";
import OrdersPage from "./components/admin/OrdersPage";
import CustomersPage from "./components/admin/CustomersPage";
import CommentsPage from "./components/admin/CommentsPage";
import ServicesPage from "./components/admin/ServicesPage";
import PricingPage from "./components/admin/PricingPage";
import SettingsPage from "./components/admin/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: createElement(LandingPage),
  },
  {
    path: "/login",
    element: createElement(LoginPage),
  },
  {
    path: "/register",
    element: createElement(RegisterPage),
  },
  {
    path: "/forgot-password",
    element: createElement(ForgotPasswordPage),
  },
  {
    path: "/dashboard",
    element: createElement(ProtectedRoute, null, createElement(CustomerDashboard)),
  },
  {
    path: "/admin",
    element: createElement(ProtectedRoute, { requireAdmin: true }, createElement(AdminPanel)),
    children: [
      {
        index: true,
        element: createElement(DashboardPage),
      },
      {
        path: "orders",
        element: createElement(OrdersPage),
      },
      {
        path: "customers",
        element: createElement(CustomersPage),
      },
      {
        path: "comments",
        element: createElement(CommentsPage),
      },
      {
        path: "services",
        element: createElement(ServicesPage),
      },
      {
        path: "pricing",
        element: createElement(PricingPage),
      },
      {
        path: "settings",
        element: createElement(SettingsPage),
      },
      {
        path: "*",
        element: createElement(Navigate, { to: "/admin", replace: true }),
      },
    ],
  },
]);
