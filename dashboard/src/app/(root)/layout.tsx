import { AppSidebar } from '@/components/sidebar/app-sidebar';
import { SiteHeader } from '@/components/sidebar/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { FloatingNoticePopup } from '@/components/notice/FloatingNoticePopup';
import { ProfileCompletionDialog } from '@/components/account/profile-completion-dialog';
import { FloatingAIChat } from '@/components/ai-chat/FloatingAIChat';

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider
            style={
                {
                    '--sidebar-width': 'calc(var(--spacing) * 72)',
                    '--header-height': 'calc(var(--spacing) * 12)',
                } as React.CSSProperties
            }
        >
            <AppSidebar variant="sidebar" />
            <SidebarInset>
                <SiteHeader />
                <div className="flex flex-1 flex-col min-h-0 overflow-auto">
                    <div className="@container/main flex flex-1 flex-col gap-2 p-4 min-h-0 overflow-auto">
                        {children}
                    </div>
                </div>
            </SidebarInset>
            <FloatingNoticePopup />
            <ProfileCompletionDialog />
            <FloatingAIChat />
        </SidebarProvider>
    );
}
