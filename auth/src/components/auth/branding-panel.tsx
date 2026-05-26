import { Shield, Users, BarChart3 } from 'lucide-react';
import Logo from '@/components/logo';

const features = [
    { icon: Shield, text: 'Secure role-based access control' },
    { icon: Users, text: 'Complete employee lifecycle management' },
    { icon: BarChart3, text: 'Real-time analytics & insights' },
];

export default function BrandingPanel() {
    return (
        <div className="hidden lg:flex lg:w-[42%] flex-col justify-between bg-primary p-12 text-primary-foreground">
            <div className="bg-white dark:bg-white/35 p-3 w-fit">
                <Logo />
            </div>
            <div className="space-y-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                        Manage your team, effortlessly.
                    </h2>
                    <p className="mt-3 text-primary-foreground/70 text-lg">
                        Everything you need to run HR operations — in one place.
                    </p>
                </div>
                <ul className="space-y-4">
                    {features.map(({ icon: Icon, text }) => (
                        <li key={text} className="flex items-center gap-3">
                            <div className="flex-shrink-0 rounded-full bg-primary-foreground/10 p-2">
                                <Icon className="h-5 w-5" />
                            </div>
                            <span className="text-primary-foreground/90">
                                {text}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
            <p className="text-sm text-primary-foreground/50">
                © {new Date().getFullYear()} WebBriks. All rights reserved.
            </p>
        </div>
    );
}
