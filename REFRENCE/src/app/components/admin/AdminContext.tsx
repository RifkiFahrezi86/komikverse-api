import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// ============ Types ============
export type ProjectStatus = "dalam_pengerjaan" | "selesai" | "kosong" | "dibatalkan";
export type ProjectPriority = "express" | "standard" | "reguler";

export interface Project {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  projectName: string;
  description: string;
  service: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  deadline: string;
  progress: number;
  price: number;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  joinedAt: string;
  lastOrderAt: string;
  notes: string;
}

export interface Comment {
  id: string;
  customerName: string;
  customerEmail: string;
  service: string;
  rating: number;
  comment: string;
  reply: string;
  isPublished: boolean;
  createdAt: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category: string;
  isActive: boolean;
  icon: string;
}

export interface PricingFeature {
  text: string;
  ok: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  color: string;
  icon: string;
  popular: boolean;
  features: PricingFeature[];
  order: number;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  phone: string;
  email: string;
  address: string;
  whatsappNumber: string;
  socialLinks: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    github?: string;
  };
  pricingPlans: PricingPlan[];
}

// ============ Helpers ============
export function formatRupiah(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID");
}

// ============ Config ============
export const priorityConfig = {
  express: {
    label: "Express",
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.3)",
  },
  standard: {
    label: "Standard",
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.15)",
    borderColor: "rgba(245,158,11,0.3)",
  },
  reguler: {
    label: "Reguler",
    color: "#06b6d4",
    bgColor: "rgba(6,182,212,0.15)",
    borderColor: "rgba(6,182,212,0.3)",
  },
};

export const statusConfig = {
  dalam_pengerjaan: {
    label: "Dalam Pengerjaan",
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.15)",
    borderColor: "rgba(245,158,11,0.3)",
  },
  selesai: {
    label: "Selesai",
    color: "#22c55e",
    bgColor: "rgba(34,197,94,0.15)",
    borderColor: "rgba(34,197,94,0.3)",
  },
  kosong: {
    label: "Menunggu",
    color: "#94a3b8",
    bgColor: "rgba(148,163,184,0.15)",
    borderColor: "rgba(148,163,184,0.3)",
  },
  dibatalkan: {
    label: "Dibatalkan",
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.3)",
  },
};

// servicesList is no longer hardcoded — admin pages derive it from the services state

// ============ Default Data ============
const defaultProjects: Project[] = [
  {
    id: "1",
    clientName: "Ahmad Rizky",
    clientEmail: "ahmad@email.com",
    clientPhone: "081234567890",
    projectName: "E-Commerce Platform",
    description: "Website e-commerce lengkap dengan payment gateway dan admin dashboard",
    service: "Website Development",
    status: "dalam_pengerjaan",
    priority: "express",
    deadline: "2026-03-15",
    progress: 75,
    price: 1500000,
    isApproved: true,
    createdAt: "2026-02-20",
    updatedAt: "2026-03-04",
  },
  {
    id: "2",
    clientName: "Siti Nurhaliza",
    clientEmail: "siti@email.com",
    clientPhone: "081298765432",
    projectName: "Sistem Informasi Perpustakaan",
    description: "Aplikasi perpustakaan digital untuk skripsi dengan fitur peminjaman dan pengembalian",
    service: "Skripsi & Thesis IT",
    status: "dalam_pengerjaan",
    priority: "standard",
    deadline: "2026-03-20",
    progress: 45,
    price: 800000,
    isApproved: true,
    createdAt: "2026-02-25",
    updatedAt: "2026-03-03",
  },
  {
    id: "3",
    clientName: "Budi Santoso",
    clientEmail: "budi@email.com",
    clientPhone: "081345678901",
    projectName: "Company Profile Website",
    description: "Website company profile modern dengan animasi dan SEO optimized",
    service: "Website Development",
    status: "selesai",
    priority: "reguler",
    deadline: "2026-03-01",
    progress: 100,
    price: 350000,
    isApproved: true,
    createdAt: "2026-02-10",
    updatedAt: "2026-03-01",
  },
  {
    id: "4",
    clientName: "Dewi Anggraeni",
    clientEmail: "dewi@email.com",
    clientPhone: "081456789012",
    projectName: "Mobile App Kasir",
    description: "Aplikasi kasir POS untuk toko retail dengan fitur inventory management",
    service: "Mobile App Development",
    status: "dalam_pengerjaan",
    priority: "express",
    deadline: "2026-03-10",
    progress: 60,
    price: 2000000,
    isApproved: true,
    createdAt: "2026-02-15",
    updatedAt: "2026-03-04",
  },
  {
    id: "5",
    clientName: "Reza Firmansyah",
    clientEmail: "reza@email.com",
    clientPhone: "081567890123",
    projectName: "Tugas Machine Learning",
    description: "Implementasi algoritma klasifikasi dengan Python dan TensorFlow",
    service: "Tugas Pemrograman",
    status: "selesai",
    priority: "standard",
    deadline: "2026-02-28",
    progress: 100,
    price: 500000,
    isApproved: true,
    createdAt: "2026-02-20",
    updatedAt: "2026-02-28",
  },
  {
    id: "6",
    clientName: "Faisal Hakim",
    clientEmail: "faisal@email.com",
    clientPhone: "081678901234",
    projectName: "REST API Development",
    description: "Pembuatan REST API untuk aplikasi inventory management dengan Node.js dan MongoDB",
    service: "API Integration",
    status: "kosong",
    priority: "reguler",
    deadline: "2026-04-01",
    progress: 0,
    price: 250000,
    isApproved: false,
    createdAt: "2026-03-05",
    updatedAt: "2026-03-05",
  },
];

const defaultCustomers: Customer[] = [
  {
    id: "c1",
    name: "Ahmad Rizky",
    email: "ahmad@email.com",
    phone: "081234567890",
    totalOrders: 3,
    totalSpent: 3500000,
    joinedAt: "2025-11-15",
    lastOrderAt: "2026-02-20",
    notes: "Pelanggan setia, sering order website development",
  },
  {
    id: "c2",
    name: "Siti Nurhaliza",
    email: "siti@email.com",
    phone: "081298765432",
    totalOrders: 1,
    totalSpent: 800000,
    joinedAt: "2026-02-25",
    lastOrderAt: "2026-02-25",
    notes: "Mahasiswa, order untuk skripsi",
  },
  {
    id: "c3",
    name: "Budi Santoso",
    email: "budi@email.com",
    phone: "081345678901",
    totalOrders: 2,
    totalSpent: 700000,
    joinedAt: "2026-01-05",
    lastOrderAt: "2026-02-10",
    notes: "",
  },
  {
    id: "c4",
    name: "Dewi Anggraeni",
    email: "dewi@email.com",
    phone: "081456789012",
    totalOrders: 1,
    totalSpent: 2000000,
    joinedAt: "2026-02-15",
    lastOrderAt: "2026-02-15",
    notes: "Pemilik toko retail",
  },
  {
    id: "c5",
    name: "Reza Firmansyah",
    email: "reza@email.com",
    phone: "081567890123",
    totalOrders: 4,
    totalSpent: 1800000,
    joinedAt: "2025-09-20",
    lastOrderAt: "2026-02-20",
    notes: "Mahasiswa informatika, sering order tugas pemrograman",
  },
];

const defaultComments: Comment[] = [
  {
    id: "r1",
    customerName: "Ahmad Rizky",
    customerEmail: "ahmad@email.com",
    service: "Website Development",
    rating: 5,
    comment: "Hasilnya sangat bagus dan profesional! Website e-commerce saya berjalan lancar. Terima kasih CodeHelp!",
    reply: "Terima kasih Ahmad! Senang bisa membantu. Jangan ragu untuk order lagi ya!",
    isPublished: true,
    createdAt: "2026-03-01",
  },
  {
    id: "r2",
    customerName: "Siti Nurhaliza",
    customerEmail: "siti@email.com",
    service: "Skripsi & Thesis IT",
    rating: 5,
    comment: "Alhamdulillah skripsi saya diterima! Sistem informasi perpustakaan yang dibuat sangat lengkap dan sesuai kebutuhan.",
    reply: "",
    isPublished: true,
    createdAt: "2026-03-03",
  },
  {
    id: "r3",
    customerName: "Budi Santoso",
    customerEmail: "budi@email.com",
    service: "Website Development",
    rating: 4,
    comment: "Website company profile-nya keren. Dikerjakan cepat dan sesuai deadline. Cuma revisi warna sedikit, sisanya perfect.",
    reply: "Terima kasih Budi! Semoga website-nya bermanfaat untuk bisnis Anda.",
    isPublished: true,
    createdAt: "2026-03-02",
  },
  {
    id: "r4",
    customerName: "Reza Firmansyah",
    customerEmail: "reza@email.com",
    service: "Tugas Pemrograman",
    rating: 5,
    comment: "Tugas machine learning saya dapat nilai A! Kodenya rapi, ada penjelasan juga. Recommended banget!",
    reply: "Mantap Reza! Sukses terus kuliahnya!",
    isPublished: true,
    createdAt: "2026-02-28",
  },
  {
    id: "r5",
    customerName: "Dewi Anggraeni",
    customerEmail: "dewi@email.com",
    service: "Mobile App Development",
    rating: 4,
    comment: "Aplikasi kasir-nya sudah jadi dan berfungsi dengan baik. Fitur inventory-nya lengkap. Recommended!",
    reply: "",
    isPublished: false,
    createdAt: "2026-03-04",
  },
];

const defaultServices: ServiceItem[] = [
  { id: "s1", name: "Website Development", description: "Landing page, company profile, e-commerce, dan web app dengan teknologi terkini.", basePrice: 150000, category: "Web", isActive: true, icon: "Globe" },
  { id: "s2", name: "Mobile App Development", description: "Aplikasi Android & iOS dengan React Native, Flutter, atau native development.", basePrice: 500000, category: "Mobile", isActive: true, icon: "Smartphone" },
  { id: "s3", name: "UI/UX Design", description: "Desain modern dan user-friendly menggunakan Figma. Wireframe & prototype.", basePrice: 100000, category: "Design", isActive: true, icon: "Palette" },
  { id: "s4", name: "Tugas Pemrograman", description: "Bantuan tugas kampus: Java, Python, C++, PHP, JavaScript, dan lainnya.", basePrice: 50000, category: "Academic", isActive: true, icon: "Code" },
  { id: "s5", name: "Skripsi & Thesis IT", description: "Sistem informasi, aplikasi, dan dokumentasi untuk skripsi/thesis IT.", basePrice: 300000, category: "Academic", isActive: true, icon: "BookOpen" },
  { id: "s6", name: "Database & Backend", description: "API development, server config dengan MySQL, PostgreSQL, MongoDB.", basePrice: 200000, category: "Backend", isActive: true, icon: "Server" },
  { id: "s7", name: "Bug Fixing", description: "Perbaikan bug, error fixing, dan debugging pada website atau aplikasi.", basePrice: 75000, category: "Maintenance", isActive: true, icon: "Bug" },
  { id: "s8", name: "API Integration", description: "Integrasi payment gateway, maps, social media, dan layanan cloud.", basePrice: 200000, category: "Backend", isActive: true, icon: "Plug" },
];

const defaultPricingPlans: PricingPlan[] = [
  {
    id: "p1", name: "Reguler", price: "Rp 50K - 150K", color: "#06b6d4", icon: "Calendar", popular: false, order: 1,
    features: [
      { text: "Tugas sederhana", ok: true },
      { text: "Pengerjaan 7-14 hari", ok: true },
      { text: "1x revisi gratis", ok: true },
      { text: "Source code", ok: true },
      { text: "Chat support", ok: true },
      { text: "Priority support", ok: false },
      { text: "Video call konsultasi", ok: false },
    ],
  },
  {
    id: "p2", name: "Standard", price: "Rp 150K - 500K", color: "#f59e0b", icon: "Clock", popular: true, order: 2,
    features: [
      { text: "Kompleksitas menengah", ok: true },
      { text: "Pengerjaan 3-7 hari", ok: true },
      { text: "3x revisi gratis", ok: true },
      { text: "Source code + dokumentasi", ok: true },
      { text: "Chat support", ok: true },
      { text: "Priority support", ok: true },
      { text: "Video call konsultasi", ok: false },
    ],
  },
  {
    id: "p3", name: "Express", price: "Rp 500K - 2Jt", color: "#ef4444", icon: "Zap", popular: false, order: 3,
    features: [
      { text: "Proyek kompleks", ok: true },
      { text: "Pengerjaan 1-3 hari", ok: true },
      { text: "Unlimited revisi", ok: true },
      { text: "Source code + dokumentasi lengkap", ok: true },
      { text: "Chat support", ok: true },
      { text: "Priority support", ok: true },
      { text: "Video call konsultasi", ok: true },
    ],
  },
];

const defaultSettings: SiteSettings = {
  siteName: "CodeHelp",
  tagline: "Jasa IT #1 Terpercaya di Indonesia",
  heroTitle: "Solusi Digital untuk Proyek & Tugas Anda",
  heroSubtitle: "Website, mobile app, tugas pemrograman, dan skripsi IT.",
  heroDescription: "Dikerjakan profesional, tepat waktu, dengan kualitas terbaik.",
  phone: "+62 859-5409-2060",
  email: "hello@codehelp.id",
  address: "Jakarta, Indonesia",
  whatsappNumber: "6285954092060",
  socialLinks: {
    instagram: "#",
    facebook: "#",
    twitter: "#",
    github: "#",
  },
  pricingPlans: defaultPricingPlans,
};

// ============ Context ============
interface AdminContextType {
  projects: Project[];
  customers: Customer[];
  comments: Comment[];
  services: ServiceItem[];
  settings: SiteSettings;
  loading: boolean;
  addProject: (p: Omit<Project, "id" | "createdAt" | "updatedAt">) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addCustomer: (c: Omit<Customer, "id">) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addComment: (c: Omit<Comment, "id">) => void;
  updateComment: (id: string, updates: Partial<Comment>) => void;
  deleteComment: (id: string) => void;
  addService: (s: Omit<ServiceItem, "id">) => void;
  updateService: (id: string, updates: Partial<ServiceItem>) => void;
  deleteService: (id: string) => void;
  updateSettings: (s: Partial<SiteSettings>) => void;
  refreshData: () => void;
}

const AdminContext = createContext<AdminContextType | null>(null);

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      apiFetch("/api/projects").catch(() => ({ projects: [] })),
      apiFetch("/api/customers").catch(() => ({ customers: [] })),
      apiFetch("/api/comments").catch(() => ({ comments: [] })),
      apiFetch("/api/services").catch(() => ({ services: [] })),
      apiFetch("/api/settings").catch(() => ({ settings: defaultSettings })),
    ]).then(([pData, cData, cmData, sData, stData]) => {
      setProjects(pData.projects || []);
      setCustomers(cData.customers || []);
      setComments(cmData.comments || []);
      setServices(sData.services || []);
      setSettings({ ...defaultSettings, ...(stData.settings || {}) });
    }).catch(err => console.error("Failed to load admin data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Projects CRUD ──
  const addProject = (p: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
    apiFetch("/api/projects", { method: "POST", body: JSON.stringify(p) })
      .then(data => { if (data.project) setProjects(prev => [data.project, ...prev]); })
      .catch(err => { console.error(err); alert("Gagal menambah pesanan"); });
  };
  const updateProject = (id: string, updates: Partial<Project>) => {
    apiFetch(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(updates) })
      .then(data => { if (data.project) setProjects(prev => prev.map(p => p.id === id ? data.project : p)); })
      .catch(err => { console.error(err); alert("Gagal mengupdate pesanan"); });
  };
  const deleteProject = (id: string) => {
    apiFetch(`/api/projects/${id}`, { method: "DELETE" })
      .then(() => setProjects(prev => prev.filter(p => p.id !== id)))
      .catch(err => { console.error(err); alert("Gagal menghapus pesanan"); });
  };

  // ── Customers CRUD ──
  const addCustomer = (c: Omit<Customer, "id">) => {
    apiFetch("/api/customers", { method: "POST", body: JSON.stringify(c) })
      .then(data => { if (data.customer) setCustomers(prev => [data.customer, ...prev]); })
      .catch(err => { console.error(err); alert("Gagal menambah pelanggan"); });
  };
  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    apiFetch(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify(updates) })
      .then(data => { if (data.customer) setCustomers(prev => prev.map(c => c.id === id ? data.customer : c)); })
      .catch(err => { console.error(err); alert("Gagal mengupdate pelanggan"); });
  };
  const deleteCustomer = (id: string) => {
    apiFetch(`/api/customers/${id}`, { method: "DELETE" })
      .then(() => setCustomers(prev => prev.filter(c => c.id !== id)))
      .catch(err => { console.error(err); alert("Gagal menghapus pelanggan"); });
  };

  // ── Comments CRUD ──
  const addComment = (c: Omit<Comment, "id">) => {
    apiFetch("/api/comments", { method: "POST", body: JSON.stringify(c) })
      .then(data => { if (data.comment) setComments(prev => [data.comment, ...prev]); })
      .catch(err => { console.error(err); alert("Gagal menambah komentar"); });
  };
  const updateComment = (id: string, updates: Partial<Comment>) => {
    apiFetch(`/api/comments/${id}`, { method: "PATCH", body: JSON.stringify(updates) })
      .then(data => { if (data.comment) setComments(prev => prev.map(c => c.id === id ? data.comment : c)); })
      .catch(err => { console.error(err); alert("Gagal mengupdate komentar"); });
  };
  const deleteComment = (id: string) => {
    apiFetch(`/api/comments/${id}`, { method: "DELETE" })
      .then(() => setComments(prev => prev.filter(c => c.id !== id)))
      .catch(err => { console.error(err); alert("Gagal menghapus komentar"); });
  };

  // ── Services CRUD ──
  const addService = (s: Omit<ServiceItem, "id">) => {
    apiFetch("/api/services", { method: "POST", body: JSON.stringify(s) })
      .then(data => { if (data.service) setServices(prev => [data.service, ...prev]); })
      .catch(err => { console.error(err); alert("Gagal menambah layanan"); });
  };
  const updateService = (id: string, updates: Partial<ServiceItem>) => {
    apiFetch(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(updates) })
      .then(data => { if (data.service) setServices(prev => prev.map(s => s.id === id ? data.service : s)); })
      .catch(err => { console.error(err); alert("Gagal mengupdate layanan"); });
  };
  const deleteService = (id: string) => {
    apiFetch(`/api/services/${id}`, { method: "DELETE" })
      .then(() => setServices(prev => prev.filter(s => s.id !== id)))
      .catch(err => { console.error(err); alert("Gagal menghapus layanan"); });
  };

  // ── Settings ──
  const updateSettings = (s: Partial<SiteSettings>) => {
    const merged = { ...settings, ...s };
    setSettings(merged);
    apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(merged) })
      .catch(err => { console.error(err); alert("Gagal menyimpan pengaturan"); });
  };

  return (
    <AdminContext.Provider
      value={{
        projects, customers, comments, services, settings, loading,
        addProject, updateProject, deleteProject,
        addCustomer, updateCustomer, deleteCustomer,
        addComment, updateComment, deleteComment,
        addService, updateService, deleteService,
        updateSettings, refreshData: fetchAll,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}
