import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import AuthGuard from "@/components/providers/auth-guard"

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>
            <SidebarProvider
                style={{ "--sidebar-width": "350px" } as React.CSSProperties}
            >
                <AppSidebar />
                <SidebarInset>
                    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 data-[orientation=vertical]:h-4"
                        />
                        <span className="text-sm font-medium text-muted-foreground">
                            WebBriks Support Console
                        </span>
                    </header>
                    <main className="flex flex-1 flex-col">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </AuthGuard>
    )
}
