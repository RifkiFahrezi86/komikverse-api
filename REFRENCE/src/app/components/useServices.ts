import { useState, useEffect } from "react";

export interface ServiceData {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category: string;
  isActive: boolean;
  icon: string;
}

const fallbackServices: ServiceData[] = [
  { id: "s1", name: "Website Development", description: "Landing page, company profile, e-commerce, dan web app dengan teknologi terkini.", basePrice: 150000, category: "Web", isActive: true, icon: "Globe" },
  { id: "s2", name: "Mobile App Development", description: "Aplikasi Android & iOS dengan React Native, Flutter, atau native development.", basePrice: 500000, category: "Mobile", isActive: true, icon: "Smartphone" },
  { id: "s3", name: "UI/UX Design", description: "Desain modern dan user-friendly menggunakan Figma. Wireframe & prototype.", basePrice: 100000, category: "Design", isActive: true, icon: "Palette" },
  { id: "s4", name: "Tugas Pemrograman", description: "Bantuan tugas kampus: Java, Python, C++, PHP, JavaScript, dan lainnya.", basePrice: 50000, category: "Academic", isActive: true, icon: "Code" },
  { id: "s5", name: "Database & Backend", description: "API development, server config dengan MySQL, PostgreSQL, MongoDB.", basePrice: 200000, category: "Backend", isActive: true, icon: "Server" },
  { id: "s6", name: "Bug Fixing", description: "Perbaikan bug, error fixing, dan debugging pada website atau aplikasi.", basePrice: 75000, category: "Maintenance", isActive: true, icon: "Bug" },
  { id: "s7", name: "API Integration", description: "Integrasi payment gateway, maps, social media, dan layanan cloud.", basePrice: 200000, category: "Backend", isActive: true, icon: "Plug" },
];

/**
 * Hook to fetch services from the API.
 * Returns only active services. Falls back to defaults if API unavailable.
 */
export function useServices(): ServiceData[] {
  const [services, setServices] = useState<ServiceData[]>(fallbackServices);

  useEffect(() => {
    fetch("/api/services")
      .then(res => res.json())
      .then(data => {
        if (data.services && data.services.length > 0) {
          setServices(data.services.filter((s: ServiceData) => s.isActive));
        }
      })
      .catch(() => { /* use fallback */ });
  }, []);

  return services;
}
