// Centralized constants for designations and departments
// These replace the dynamic Metadata model

export const DESIGNATIONS = [
    { value: "telemarketer", label: "Telemarketer" },
    { value: "team_leader", label: "Team Leader" },
    { value: "hr_executive", label: "HR Executive" },
    { value: "software_engineer", label: "Software Engineer" },
    { value: "quality_assurance", label: "Quality Assurance" },
    { value: "graphic_designer", label: "Graphic Designer" },
    { value: "photo_editor", label: "Photo Editor" },
    { value: "video_editor", label: "Video Editor" },
    { value: "ui_ux_designer", label: "UI UX Designer" },
    { value: "front_end_developer", label: "Front End Developer" },
    { value: "full_stack_developer", label: "Full Stack Developer" },
    { value: "marketing_manager", label: "Marketing Manager" },
    { value: "ai_specialist", label: "AI Specialist" },
    { value: "administrative_assistant", label: "Administrative Assistant" },
    { value: "office_boy", label: "Office Boy" },
    { value: "other", label: "Other" },
] as const;

export const DEPARTMENTS = [
    { value: "production", label: "Production" },
    { value: "marketing", label: "Marketing" },
    { value: "sales", label: "Sales" },
    { value: "hr", label: "Human Resources" },
    { value: "administration", label: "Administration" },
    { value: "it", label: "Information Technology" },
    { value: "finance", label: "Finance" },
    { value: "ui_ux_design", label: "UI/UX Design" },
    { value: "web_development", label: "Web Development" },
    { value: "creative_branding", label: "Creative & Branding" },
    { value: "seo_web_performance", label: "SEO & Web Performance" },
    { value: "other", label: "Other" },
] as const;
