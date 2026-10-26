import { MessagesView } from '@/components/messages/messages-view';

export default async function WebChatPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;
    return <MessagesView webSessionId={sessionId} />;
}
