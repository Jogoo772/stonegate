import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { Ticker } from "@/components/home/Ticker";
import { MarketOverview } from "@/components/home/MarketOverview";
import { Features } from "@/components/home/Features";
import { MobileApp } from "@/components/home/MobileApp";
import { PriceTable } from "@/components/home/PriceTable";
import { Stats } from "@/components/home/Stats";
import { FinalCTA } from "@/components/home/FinalCTA";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <Navbar />
      <main>
        <Hero />
        <Ticker />
        <MarketOverview />
        <Features />
        <Stats />
        <MobileApp />
        <PriceTable />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
