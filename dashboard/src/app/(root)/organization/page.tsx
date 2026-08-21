'use client';

import { useState } from 'react';
import { Building2, Briefcase, MapPin, ShieldAlert } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { Role } from '@/constants/role';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import DepartmentManagement from '@/components/organization/DepartmentManagement';
import DesignationManagement from '@/components/organization/DesignationManagement';
import BranchManagement from '@/components/organization/BranchManagement';

export default function OrganizationPage() {
    const { data: session, isPending } = useSession();
    const [activeTab, setActiveTab] = useState<'departments' | 'designations' | 'branches'>('departments');

    const userRole = session?.user?.role as Role | undefined;
    const isAuthorized =
        userRole === Role.SUPER_ADMIN ||
        userRole === Role.ADMIN ||
        userRole === Role.HR_MANAGER;

    if (isPending) {
        return (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Spinner className="size-8 text-primary" />
                <p className="text-sm">Loading organization settings...</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="py-20 flex flex-col items-center justify-center text-center gap-3">
                <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                    <ShieldAlert className="size-6" />
                </div>
                <h2 className="text-lg font-semibold">Access Restricted</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                    You do not have permission to view or manage organization settings.
                    Please contact an administrator or HR manager.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Organization Setup</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage departments, job designations, and company branches in one centralized hub.
                </p>
            </div>

            {/* Main Tabs */}
            <Tabs
                value={activeTab}
                onValueChange={(val: any) => setActiveTab(val)}
                className="space-y-6"
            >
                <div className="border-b border-border pb-1">
                    <TabsList className="bg-muted/60 p-1">
                        <TabsTrigger value="departments" className="gap-2 px-4">
                            <Building2 className="size-4" />
                            Departments
                        </TabsTrigger>
                        <TabsTrigger value="designations" className="gap-2 px-4">
                            <Briefcase className="size-4" />
                            Designations
                        </TabsTrigger>
                        <TabsTrigger value="branches" className="gap-2 px-4">
                            <MapPin className="size-4" />
                            Branches
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="departments" className="space-y-4 outline-none">
                    <DepartmentManagement />
                </TabsContent>

                <TabsContent value="designations" className="space-y-4 outline-none">
                    <DesignationManagement />
                </TabsContent>

                <TabsContent value="branches" className="space-y-4 outline-none">
                    <BranchManagement />
                </TabsContent>
            </Tabs>
        </div>
    );
}
