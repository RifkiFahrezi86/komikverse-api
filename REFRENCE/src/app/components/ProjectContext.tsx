import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ProjectStatus = "dalam_pengerjaan" | "selesai" | "kosong";
export type ProjectPriority = "express" | "standard" | "reguler";

export interface Project {
  id: string;
  clientName: string;
  projectName: string;
  description: string;
  service: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  deadline: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectContextType {
  projects: Project[];
  addProject: (p: Omit<Project, "id" | "createdAt" | "updatedAt">) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

const defaultProjects: Project[] = [
  {
    id: "1",
    clientName: "Ahmad Rizky",
    projectName: "E-Commerce Platform",
    description: "Website e-commerce lengkap dengan payment gateway dan admin dashboard",
    service: "Website Development",
    status: "dalam_pengerjaan",
    priority: "express",
    deadline: "2026-03-15",
    progress: 75,
    createdAt: "2026-02-20",
    updatedAt: "2026-03-04",
  },
  {
    id: "2",
    clientName: "Siti Nurhaliza",
    projectName: "Sistem Informasi Perpustakaan",
    description: "Aplikasi perpustakaan digital untuk skripsi dengan fitur peminjaman dan pengembalian",
    service: "Skripsi & Thesis IT",
    status: "dalam_pengerjaan",
    priority: "standard",
    deadline: "2026-03-20",
    progress: 45,
    createdAt: "2026-02-25",
    updatedAt: "2026-03-03",
  },
  {
    id: "3",
    clientName: "Budi Santoso",
    projectName: "Company Profile Website",
    description: "Website company profile modern dengan animasi dan SEO optimized",
    service: "Website Development",
    status: "selesai",
    priority: "reguler",
    deadline: "2026-03-01",
    progress: 100,
    createdAt: "2026-02-10",
    updatedAt: "2026-03-01",
  },
  {
    id: "4",
    clientName: "Dewi Anggraeni",
    projectName: "Mobile App Kasir",
    description: "Aplikasi kasir POS untuk toko retail dengan fitur inventory management",
    service: "Mobile App Development",
    status: "dalam_pengerjaan",
    priority: "express",
    deadline: "2026-03-10",
    progress: 60,
    createdAt: "2026-02-15",
    updatedAt: "2026-03-04",
  },
  {
    id: "5",
    clientName: "Reza Firmansyah",
    projectName: "Tugas Machine Learning",
    description: "Implementasi algoritma klasifikasi dengan Python dan TensorFlow",
    service: "Tugas Pemrograman",
    status: "selesai",
    priority: "standard",
    deadline: "2026-02-28",
    progress: 100,
    createdAt: "2026-02-20",
    updatedAt: "2026-02-28",
  },
];

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem("codehelp_projects");
      return saved ? JSON.parse(saved) : defaultProjects;
    } catch {
      return defaultProjects;
    }
  });

  useEffect(() => {
    localStorage.setItem("codehelp_projects", JSON.stringify(projects));
  }, [projects]);

  const addProject = (p: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString().split("T")[0];
    const newProject: Project = {
      ...p,
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now,
    };
    setProjects((prev) => [newProject, ...prev]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, ...updates, updatedAt: new Date().toISOString().split("T")[0] }
          : p
      )
    );
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <ProjectContext.Provider value={{ projects, addProject, updateProject, deleteProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectProvider");
  return ctx;
}

export const priorityConfig = {
  express: {
    label: "Express",
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.15)",
    borderColor: "rgba(239,68,68,0.3)",
    desc: "1-3 Hari | Rp 500K - 2Jt",
    icon: "Zap",
  },
  standard: {
    label: "Standard",
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.15)",
    borderColor: "rgba(245,158,11,0.3)",
    desc: "3-7 Hari | Rp 150K - 500K",
    icon: "Clock",
  },
  reguler: {
    label: "Reguler",
    color: "#06b6d4",
    bgColor: "rgba(6,182,212,0.15)",
    borderColor: "rgba(6,182,212,0.3)",
    desc: "7-14 Hari | Rp 50K - 150K",
    icon: "Calendar",
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
};
