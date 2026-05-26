export function formatRole(role: string): string {
    const map: Record<string, string> = {
        super_admin: 'Super Admin',
        admin: 'Admin',
        hr_manager: 'HR Manager',
        team_leader: 'Team Leader',
        staff: 'Staff',
    };
    return map[role] ?? role;
}
