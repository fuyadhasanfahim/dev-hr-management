import { MessagesView } from '@/components/messages/messages-view';

export default async function MessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <MessagesView conversationId={id} />;
}
