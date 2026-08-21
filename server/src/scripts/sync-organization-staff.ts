import mongoose from 'mongoose';
import envConfig from '../config/env.config.js';
import DepartmentModel from '../models/department.model.js';
import DesignationModel from '../models/designation.model.js';
import BranchModel from '../models/branch.model.js';
import StaffModel from '../models/staff.model.js';
import UserModel from '../models/user.model.js';

// Default Departments with standardized names and codes
const DEFAULT_DEPARTMENTS = [
    { code: 'PRODUCTION', name: 'Production', description: 'Operations & Production Department' },
    { code: 'MARKETING', name: 'Marketing', description: 'Brand Marketing & Outreach' },
    { code: 'SALES', name: 'Sales', description: 'Sales & Telemarketing Department' },
    { code: 'HR', name: 'Human Resources', description: 'Talent, People & HR Operations' },
    { code: 'ADMINISTRATION', name: 'Administration', description: 'Company Administration & Facilities' },
    { code: 'IT', name: 'Information Technology', description: 'IT Infrastructure & Software Systems' },
    { code: 'FINANCE', name: 'Finance', description: 'Accounts, Billing & Financial Management' },
    { code: 'UI_UX_DESIGN', name: 'UI/UX Design', description: 'User Experience & Interface Design' },
    { code: 'WEB_DEVELOPMENT', name: 'Web Development', description: 'Frontend, Backend & Fullstack Web Engineering' },
    { code: 'CREATIVE_BRANDING', name: 'Creative & Branding', description: 'Graphics, Photo & Video Production' },
    { code: 'SEO_WEB_PERFORMANCE', name: 'SEO & Web Performance', description: 'Search Engine Optimization & Web Analytics' },
    { code: 'OTHER', name: 'Other', description: 'General & Miscellaneous Department' },
];

// Default Designations with mapped default departments
const DEFAULT_DESIGNATIONS = [
    { code: 'telemarketer', name: 'Telemarketer', department: 'Sales', description: 'Client Outreach & Telemarketing' },
    { code: 'team_leader', name: 'Team Leader', department: 'Administration', description: 'Team Leadership & Operations Management' },
    { code: 'hr_executive', name: 'HR Executive', department: 'Human Resources', description: 'HR Coordination & Employee Management' },
    { code: 'software_engineer', name: 'Software Engineer', department: 'Information Technology', description: 'Software Architecture & Development' },
    { code: 'quality_assurance', name: 'Quality Assurance', department: 'Information Technology', description: 'QA Testing & Release Verification' },
    { code: 'graphic_designer', name: 'Graphic Designer', department: 'Creative & Branding', description: 'Visual Assets & Creative Design' },
    { code: 'photo_editor', name: 'Photo Editor', department: 'Creative & Branding', description: 'Image Retouching & Photo Editing' },
    { code: 'video_editor', name: 'Video Editor', department: 'Creative & Branding', description: 'Video Production & Editing' },
    { code: 'ui_ux_designer', name: 'UI/UX Designer', department: 'UI/UX Design', description: 'Product Design & User Experience' },
    { code: 'front_end_developer', name: 'Front End Developer', department: 'Web Development', description: 'Client-side Web Development' },
    { code: 'full_stack_developer', name: 'Full Stack Developer', department: 'Web Development', description: 'End-to-end Web Applications' },
    { code: 'marketing_manager', name: 'Marketing Manager', department: 'Marketing', description: 'Marketing Strategy & Campaign Management' },
    { code: 'ai_specialist', name: 'AI Specialist', department: 'Information Technology', description: 'AI Models & Intelligent Automation' },
    { code: 'administrative_assistant', name: 'Administrative Assistant', department: 'Administration', description: 'Office Administration & Support' },
    { code: 'office_boy', name: 'Office Boy', department: 'Administration', description: 'Office Assistance & Logistics' },
    { code: 'other', name: 'Other', department: 'Other', description: 'General Staff Member' },
];

// Normalization lookup dictionaries
const DEPARTMENT_NORMALIZE_MAP: Record<string, string> = {
    production: 'Production',
    marketing: 'Marketing',
    sales: 'Sales',
    hr: 'Human Resources',
    'human resources': 'Human Resources',
    human_resources: 'Human Resources',
    administration: 'Administration',
    admin: 'Administration',
    it: 'Information Technology',
    'information technology': 'Information Technology',
    information_technology: 'Information Technology',
    finance: 'Finance',
    accounts: 'Finance',
    ui_ux_design: 'UI/UX Design',
    'ui/ux design': 'UI/UX Design',
    'ui ux design': 'UI/UX Design',
    web_development: 'Web Development',
    'web development': 'Web Development',
    creative_branding: 'Creative & Branding',
    'creative & branding': 'Creative & Branding',
    'creative and branding': 'Creative & Branding',
    seo_web_performance: 'SEO & Web Performance',
    'seo & web performance': 'SEO & Web Performance',
    other: 'Other',
    general: 'Other',
};

const DESIGNATION_NORMALIZE_MAP: Record<string, { name: string; defaultDept: string }> = {
    telemarketer: { name: 'Telemarketer', defaultDept: 'Sales' },
    team_leader: { name: 'Team Leader', defaultDept: 'Administration' },
    'team leader': { name: 'Team Leader', defaultDept: 'Administration' },
    hr_executive: { name: 'HR Executive', defaultDept: 'Human Resources' },
    'hr executive': { name: 'HR Executive', defaultDept: 'Human Resources' },
    software_engineer: { name: 'Software Engineer', defaultDept: 'Information Technology' },
    'software engineer': { name: 'Software Engineer', defaultDept: 'Information Technology' },
    quality_assurance: { name: 'Quality Assurance', defaultDept: 'Information Technology' },
    'quality assurance': { name: 'Quality Assurance', defaultDept: 'Information Technology' },
    graphic_designer: { name: 'Graphic Designer', defaultDept: 'Creative & Branding' },
    'graphic designer': { name: 'Graphic Designer', defaultDept: 'Creative & Branding' },
    photo_editor: { name: 'Photo Editor', defaultDept: 'Creative & Branding' },
    'photo editor': { name: 'Photo Editor', defaultDept: 'Creative & Branding' },
    video_editor: { name: 'Video Editor', defaultDept: 'Creative & Branding' },
    'video editor': { name: 'Video Editor', defaultDept: 'Creative & Branding' },
    ui_ux_designer: { name: 'UI/UX Designer', defaultDept: 'UI/UX Design' },
    'ui/ux designer': { name: 'UI/UX Designer', defaultDept: 'UI/UX Design' },
    'ui ux designer': { name: 'UI/UX Designer', defaultDept: 'UI/UX Design' },
    front_end_developer: { name: 'Front End Developer', defaultDept: 'Web Development' },
    'front end developer': { name: 'Front End Developer', defaultDept: 'Web Development' },
    full_stack_developer: { name: 'Full Stack Developer', defaultDept: 'Web Development' },
    'full stack developer': { name: 'Full Stack Developer', defaultDept: 'Web Development' },
    marketing_manager: { name: 'Marketing Manager', defaultDept: 'Marketing' },
    'marketing manager': { name: 'Marketing Manager', defaultDept: 'Marketing' },
    ai_specialist: { name: 'AI Specialist', defaultDept: 'Information Technology' },
    'ai specialist': { name: 'AI Specialist', defaultDept: 'Information Technology' },
    administrative_assistant: { name: 'Administrative Assistant', defaultDept: 'Administration' },
    'administrative assistant': { name: 'Administrative Assistant', defaultDept: 'Administration' },
    office_boy: { name: 'Office Boy', defaultDept: 'Administration' },
    'office boy': { name: 'Office Boy', defaultDept: 'Administration' },
    other: { name: 'Other', defaultDept: 'Other' },
};

export async function syncOrganizationAndStaff() {
    console.log('🚀 Starting Organization & Staff Data Synchronization...');

    try {
        if (mongoose.connection.readyState === 0) {
            console.log('📡 Connecting to MongoDB database...');
            await mongoose.connect(envConfig.mongo_uri as string);
            console.log('✅ Connected to MongoDB successfully.');
        }

        // Find a fallback admin user ID to associate created items if required
        const adminUser = await UserModel.findOne({
            role: { $in: ['super_admin', 'admin'] },
        });
        const systemAdminId = adminUser?._id || new mongoose.Types.ObjectId();

        // --------------------------------------------------------------------
        // 1. Sync / Seed Standard Departments
        // --------------------------------------------------------------------
        console.log('\n--- 1. Syncing Departments ---');
        let deptsCreated = 0;
        let deptsUpdated = 0;

        for (const dept of DEFAULT_DEPARTMENTS) {
            const existing = await DepartmentModel.findOne({
                $or: [{ code: dept.code }, { name: { $regex: new RegExp(`^${dept.name}$`, 'i') } }],
            });

            if (!existing) {
                await DepartmentModel.create({
                    name: dept.name,
                    code: dept.code,
                    description: dept.description,
                    isActive: true,
                    createdBy: systemAdminId,
                });
                deptsCreated++;
                console.log(`  + Created Department: ${dept.name} (${dept.code})`);
            } else {
                let changed = false;
                if (!existing.isActive) {
                    existing.isActive = true;
                    changed = true;
                }
                if (!existing.description && dept.description) {
                    existing.description = dept.description;
                    changed = true;
                }
                if (changed) {
                    await existing.save();
                    deptsUpdated++;
                    console.log(`  * Updated Department: ${existing.name}`);
                }
            }
        }
        console.log(`✅ Departments synchronized. Created: ${deptsCreated}, Updated: ${deptsUpdated}`);

        // --------------------------------------------------------------------
        // 2. Sync / Seed Standard Designations
        // --------------------------------------------------------------------
        console.log('\n--- 2. Syncing Designations ---');
        let desigsCreated = 0;
        let desigsUpdated = 0;

        for (const desig of DEFAULT_DESIGNATIONS) {
            const existing = await DesignationModel.findOne({
                $or: [{ code: desig.code }, { name: { $regex: new RegExp(`^${desig.name}$`, 'i') } }],
            });

            if (!existing) {
                await DesignationModel.create({
                    name: desig.name,
                    code: desig.code,
                    department: desig.department,
                    description: desig.description,
                    isActive: true,
                    createdBy: systemAdminId,
                });
                desigsCreated++;
                console.log(`  + Created Designation: ${desig.name} -> Dept: ${desig.department}`);
            } else {
                let changed = false;
                if (!existing.department && desig.department) {
                    existing.department = desig.department;
                    changed = true;
                }
                if (!existing.isActive) {
                    existing.isActive = true;
                    changed = true;
                }
                if (changed) {
                    await existing.save();
                    desigsUpdated++;
                    console.log(`  * Updated Designation: ${existing.name}`);
                }
            }
        }
        console.log(`✅ Designations synchronized. Created: ${desigsCreated}, Updated: ${desigsUpdated}`);

        // --------------------------------------------------------------------
        // 3. Ensure Default Branch Exists
        // --------------------------------------------------------------------
        console.log('\n--- 3. Verifying Branches ---');
        let defaultBranch = await BranchModel.findOne({ isActive: true });
        if (!defaultBranch) {
            defaultBranch = await BranchModel.create({
                name: 'Head Office',
                code: 'DHA',
                address: 'Dhaka, Bangladesh',
                isActive: true,
                createdBy: systemAdminId,
            });
            console.log(`  + Created Default Branch: ${defaultBranch.name} (${defaultBranch.code})`);
        } else {
            console.log(`  ✓ Active branch found: ${defaultBranch.name} (${defaultBranch.code})`);
        }

        // --------------------------------------------------------------------
        // 4. Normalize & Sync Existing Staff Records
        // --------------------------------------------------------------------
        console.log('\n--- 4. Normalizing Staff Records ---');
        const allStaffs = await StaffModel.find({});
        console.log(`Found ${allStaffs.length} total staff record(s) to inspect.`);

        let staffUpdatedCount = 0;

        for (const staff of allStaffs) {
            let modified = false;

            const rawDesig = (staff.designation || '').trim();
            const rawDept = (staff.department || '').trim();

            // Normalize designation
            const desigLower = rawDesig.toLowerCase();
            const matchedDesig = DESIGNATION_NORMALIZE_MAP[desigLower];
            let normalizedDesig = rawDesig;

            if (matchedDesig) {
                if (rawDesig !== matchedDesig.name) {
                    normalizedDesig = matchedDesig.name;
                    staff.designation = normalizedDesig;
                    modified = true;
                }
            } else if (!rawDesig) {
                staff.designation = 'Other';
                normalizedDesig = 'Other';
                modified = true;
            }

            // Normalize department
            const deptLower = rawDept.toLowerCase();
            const matchedDept = DEPARTMENT_NORMALIZE_MAP[deptLower];

            if (matchedDept) {
                if (rawDept !== matchedDept) {
                    staff.department = matchedDept;
                    modified = true;
                }
            } else if (!rawDept || rawDept === '') {
                // Infer department from designation if missing
                const inferredDept = matchedDesig?.defaultDept || 'Other';
                staff.department = inferredDept;
                modified = true;
            }

            // Ensure branchId is set
            if (!staff.branchId && defaultBranch) {
                staff.branchId = defaultBranch._id;
                modified = true;
            }

            if (modified) {
                await staff.save();
                staffUpdatedCount++;
                console.log(
                    `  * Staff [${staff.staffId}]: Designation -> "${staff.designation}", Department -> "${staff.department}"`
                );
            }
        }

        console.log(`\n======================================================`);
        console.log(`🎉 Organization & Staff Synchronization Complete!`);
        console.log(`   - Total Staff Inspected : ${allStaffs.length}`);
        console.log(`   - Total Staff Updated   : ${staffUpdatedCount}`);
        console.log(`   - Departments Synced    : ${DEFAULT_DEPARTMENTS.length}`);
        console.log(`   - Designations Synced   : ${DEFAULT_DESIGNATIONS.length}`);
        console.log(`======================================================\n`);

        return {
            success: true,
            totalStaff: allStaffs.length,
            staffUpdated: staffUpdatedCount,
            deptsCreated,
            desigsCreated,
        };
    } catch (error) {
        console.error('❌ Error during organization sync:', error);
        throw error;
    }
}

// Auto-run if executed directly via CLI
if (import.meta.url === `file://${process.argv[1]}`) {
    syncOrganizationAndStaff()
        .then(() => {
            console.log('Script execution finished.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}
