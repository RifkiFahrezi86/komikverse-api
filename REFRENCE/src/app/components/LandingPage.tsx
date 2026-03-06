import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import StatsBar from "./StatsBar";
import ServicesSection from "./ServicesSection";
import ProjectsSection from "./ProjectsSection";
import HowToOrder from "./HowToOrder";
import PricingSection from "./PricingSection";
import TestimonialsSection from "./TestimonialsSection";
import FAQSection from "./FAQSection";
import CTABanner from "./CTABanner";
import OrderForm from "./OrderForm";
import Footer from "./Footer";
import WhatsAppButton from "./WhatsAppButton";

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ scrollBehavior: "smooth" }}>
      <Navbar />
      <HeroSection />
      <StatsBar />
      <ServicesSection />
      <ProjectsSection />
      <HowToOrder />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <CTABanner />
      <OrderForm />
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
