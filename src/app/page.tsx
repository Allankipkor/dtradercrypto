import { Navbar } from "@/components/Navbar";
import { TickerMarquee } from "@/components/TickerMarquee";
import { LiveChartPreview } from "@/components/LiveChartPreview";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Steps } from "@/components/landing/Steps";
import { Stats } from "@/components/landing/Stats";
import { Reviews } from "@/components/landing/Reviews";
import { Cta } from "@/components/landing/Cta";
import { AppDownload } from "@/components/landing/AppDownload";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="bg-[#030706] text-white min-h-screen-safe overflow-x-hidden transition-colors duration-300">
      <Navbar />
      <Hero />
      <TickerMarquee />
      <LiveChartPreview />
      <Features />
      <Steps />
      <Stats />
      <Reviews />
      <Cta />
      <AppDownload />
      <Footer />
    </div>
  );
}
