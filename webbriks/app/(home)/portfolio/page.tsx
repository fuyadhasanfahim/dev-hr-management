import BookCallMarquee from "../_sections/BookCallMarquee";
import ContactSection from "../_sections/ContactSection";
import Faq from "../_sections/Faq";
import StartProject from "../_sections/StartProject";
import PortfolioHero from "./_sections/PortfolioHero";
import PortfolioProject from "./_sections/PortfolioProject";

const page = () => {
    return (
        <div>
            <PortfolioHero/>
            <PortfolioProject/>
            <Faq/>
            <StartProject/>
            <ContactSection/>
            <BookCallMarquee/>
        </div>
    );
};

export default page;