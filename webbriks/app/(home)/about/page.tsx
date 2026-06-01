import BookCallMarquee from "../_sections/BookCallMarquee";
import ContactSection from "../_sections/ContactSection";
import DesignProcess from "../_sections/DesignProcess";
import Faq from "../_sections/Faq";
import Review from "../_sections/Review";
import StartProject from "../_sections/StartProject";
import AboutHero from "./_sections/AboutHero";
import MissionSectionAbout from "./_sections/MissionSectionAbout";
import ShapingFuture from "./_sections/ShapingFuture";
import Team from "./_sections/Team";

const page = () => {
    return (
        <div>
            <AboutHero/>
            <MissionSectionAbout/>
            <ShapingFuture/>
            <DesignProcess/>
            <Review/>
            <Team/>
            <Faq/>
            <StartProject/>
            <ContactSection/>
            <BookCallMarquee/>
        </div>
    );
};

export default page;