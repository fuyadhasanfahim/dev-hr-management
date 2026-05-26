export default function DashboardPage() {
    return (
        <div className="flex flex-1 flex-col gap-6 p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Welcome to the WebBriks Support Console.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {["Open Tickets", "Live Chats", "Resolved Today"].map((label) => (
                    <div
                        key={label}
                        className="rounded-xl border bg-card p-5 shadow-sm"
                    >
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="mt-1 text-3xl font-bold text-foreground">—</p>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">
                    Recent activity will appear here once connected to the API.
                </p>
            </div>
        </div>
    )
}
