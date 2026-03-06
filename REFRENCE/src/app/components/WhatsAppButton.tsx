import { MessageCircle } from "lucide-react";
import { useSiteSettings } from "./useSiteSettings";

export default function WhatsAppButton() {
  const settings = useSiteSettings();
  return (
    <a
      href={`https://wa.me/${settings.whatsappNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-110"
      style={{
        background: "linear-gradient(135deg, #25d366, #128c7e)",
        boxShadow: "0 6px 24px rgba(37,211,102,0.4)",
      }}
      aria-label="Chat WhatsApp"
    >
      <MessageCircle size={26} className="text-white" />
    </a>
  );
}
