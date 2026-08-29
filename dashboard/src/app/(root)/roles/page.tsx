'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RolesTab } from '@/components/roles/roles-tab';
import { ScopePermissionsPanel } from '@/components/roles/scope-permissions-panel';
import { usePermissions } from '@/hooks/use-permissions';
import { useGetAllDepartmentsQuery } from '@/redux/features/department/departmentApi';
import { useGetAllDesignationsQuery } from '@/redux/features/designation/designationApi';
import {
    useUpdateDepartmentPermissionsMutation,
    useUpdateDesignationPermissionsMutation,
} from '@/redux/features/role/roleApi';

export default function RolesPage() {
    const { can } = usePermissions();
    const canAssign = can('role.assign');

    const { data: deptData, isLoading: deptLoading } = useGetAllDepartmentsQuery();
    const { data: desigData, isLoading: desigLoading } =
        useGetAllDesignationsQuery();

    const [updateDeptPerms] = useUpdateDepartmentPermissionsMutation();
    const [updateDesigPerms] = useUpdateDesignationPermissionsMutation();

    return (
        <div className="mx-auto w-full max-w-5xl space-y-4">
            <h1 className="text-xl font-semibold">Roles &amp; Permissions</h1>

            <Tabs defaultValue="roles">
                <TabsList>
                    <TabsTrigger value="roles">Roles</TabsTrigger>
                    <TabsTrigger value="departments">Departments</TabsTrigger>
                    <TabsTrigger value="designations">Designations</TabsTrigger>
                </TabsList>

                <TabsContent value="roles" className="mt-4">
                    <RolesTab />
                </TabsContent>

                <TabsContent value="departments" className="mt-4">
                    <ScopePermissionsPanel
                        description="Extra permissions granted to every staff member in a department, on top of their role."
                        items={deptData?.departments ?? []}
                        isLoading={deptLoading}
                        canManage={canAssign}
                        onSave={(id, permissions) =>
                            updateDeptPerms({ id, permissions }).unwrap()
                        }
                    />
                </TabsContent>

                <TabsContent value="designations" className="mt-4">
                    <ScopePermissionsPanel
                        description="Extra permissions granted to every staff member with a designation (e.g. telemarketer), on top of their role."
                        items={desigData?.designations ?? []}
                        isLoading={desigLoading}
                        canManage={canAssign}
                        onSave={(id, permissions) =>
                            updateDesigPerms({ id, permissions }).unwrap()
                        }
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
