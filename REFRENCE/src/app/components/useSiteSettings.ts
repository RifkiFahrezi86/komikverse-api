import { useState, useEffect } from "react";
import type { SiteSettings } from "./admin/AdminContext";

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
  pricingPlans: [
    {
      id: "p1", name: "Reguler", price: "Rp 50K - 150K", color: "#06b6d4", icon: "Calendar", popular: false, order: 1,
      features: [
        { text: "Tugas sederhana", ok: true }, { text: "Pengerjaan 7-14 hari", ok: true }, { text: "1x revisi gratis", ok: true },
        { text: "Source code", ok: true }, { text: "Chat support", ok: true }, { text: "Priority support", ok: false }, { text: "Video call konsultasi", ok: false },
      ],
    },
    {
      id: "p2", name: "Standard", price: "Rp 150K - 500K", color: "#f59e0b", icon: "Clock", popular: true, order: 2,
      features: [
        { text: "Kompleksitas menengah", ok: true }, { text: "Pengerjaan 3-7 hari", ok: true }, { text: "3x revisi gratis", ok: true },
        { text: "Source code + dokumentasi", ok: true }, { text: "Chat support", ok: true }, { text: "Priority support", ok: true }, { text: "Video call konsultasi", ok: false },
      ],
    },
    {
      id: "p3", name: "Express", price: "Rp 500K - 2Jt", color: "#ef4444", icon: "Zap", popular: false, order: 3,
      features: [
        { text: "Proyek kompleks", ok: true }, { text: "Pengerjaan 1-3 hari", ok: true }, { text: "Unlimited revisi", ok: true },
        { text: "Source code + dokumentasi lengkap", ok: true }, { text: "Chat support", ok: true }, { text: "Priority support", ok: true }, { text: "Video call konsultasi", ok: true },
      ],
    },
  ],
};

/**
 * Hook to read SiteSettings from server API.
 * Falls back to defaults if API is unavailable.
 */
export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data.settings) setSettings({ ...defaultSettings, ...data.settings });
      })
      .catch(() => { /* use defaults */ });
  }, []);

  return settings;
}
