import { redirect } from 'next/navigation';

export default function SigninPage() {
    const authUrl = process.env.NEXT_PUBLIC_AUTH_URL;
    redirect(`${authUrl}/sign-in`);
}
