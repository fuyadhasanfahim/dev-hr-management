import BookCallMarquee from "../_sections/BookCallMarquee";
import ContactSection from "../_sections/ContactSection";
import DesignProcess from "../_sections/DesignProcess";
import Faq from "../_sections/Faq";
import StartProject from "../_sections/StartProject";
import WhyUs from "../_sections/WhyUs";
import ExploreRecentProject from "./_sections/ExploreRecentProject";
import ServiceHero from "./_sections/ServiceHero";
import ServicesCard from "./_sections/ServicesCard";


const page = () => {
    return (
        <div>
            <ServiceHero/>
            <ServicesCard/>
            <WhyUs/>
            <DesignProcess/>
            <ExploreRecentProject/>
            <Faq/>
            <StartProject/>
            <ContactSection/>
            <BookCallMarquee/>
        </div>
    );
};

export default page;