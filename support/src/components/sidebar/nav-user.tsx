'use client';

import { useState } from 'react';
import { EllipsisVertical, Loader2, LogOut, Moon, Sun, UserIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authClient, useSession } from '@/lib/auth-client';
import { redirectToSignIn } from '@/lib/auth-redirect';
import { cn } from '@/lib/utils';

export function NavUser() {
    const { theme, setTheme, systemTheme } = useTheme();
    const { data: session, isPending } = useSession();
    const [signingOut, setSigningOut] = useState(false);
    const isLoading = isPending;

    const userName = session?.user?.name ?? 'Staff User';
    const userEmail = session?.user?.email ?? '';
    const userImage = session?.user?.image ?? undefined;
    const isDark = (theme === 'system' ? systemTheme : theme) === 'dark';

    const handleSignOut = async () => {
        setSigningOut(true);
        await authClient.signOut();
        redirectToSignIn();
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="lg" variant="ghost" className="outline-none focus-visible:ring-0 px-0!">
                    <Avatar className="h-8 w-8 rounded-full">
                        <AvatarImage src={userImage} alt={userName} />
                        <AvatarFallback className="rounded-lg">
                            {isLoading ? '' : (userName.charAt(0) ?? <UserIcon className="size-4" />)}
                        </AvatarFallback>
                    </Avatar>
                    <div className={cn('grid flex-1 text-left text-sm leading-tight')}>
                        <span className="truncate font-medium">{userName}</span>
                        <span className="text-muted-foreground truncate text-xs">{userEmail}</span>
                    </div>
                    <EllipsisVertical className="ml-auto size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
                side="bottom"
                align="end"
                sideOffset={4}
            >
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-8 w-8 rounded-full">
                            <AvatarImage src={userImage} alt={userName} />
                            <AvatarFallback className="rounded-lg">{userName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium">{userName}</span>
                            <span className="text-muted-foreground truncate text-xs">{userEmail}</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => setTheme(isDark ? 'light' : 'dark')}>
                        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                        {isDark ? 'Light mode' : 'Dark mode'}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="text-destructive focus:text-destructive"
                >
                    {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                    {signingOut ? 'Signing out...' : 'Log out'}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
