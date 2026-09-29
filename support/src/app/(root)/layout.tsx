import AuthGuard from '@/components/providers/auth-guard';
import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SidebarFloatingTrigger } from '@/components/sidebar/sidebar-floating-trigger';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <SidebarProvider
                style={
                    {
                        '--sidebar-width': 'calc(var(--spacing) * 72)',
                        '--header-height': 'calc(var(--spacing) * 12)',
                    } as React.CSSProperties
                }
            >
                <AppSidebar variant="floating" />
                <SidebarFloatingTrigger />
                <SidebarInset>
                    <div className="flex flex-1 flex-col min-h-0 overflow-auto">
                        <div className="@container/main flex flex-1 flex-col gap-2 p-2 min-h-0 overflow-auto">
                            {children}
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </AuthGuard>
    );
}
