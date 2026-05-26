import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
    className?: string;
}

export default function Logo({ className }: LogoProps) {
    return (
        <Image
            src="https://res.cloudinary.com/dny7zfbg9/image/upload/v1777996436/q83auvamwih8u8ftw5zu.png"
            alt="WebBriks"
            width={150}
            height={45}
            priority
            style={{ width: 'auto', height: 'auto' }}
            className={cn('max-w-[150px] object-contain', className)}
        />
    );
}
