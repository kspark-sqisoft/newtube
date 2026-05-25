import type { Metadata } from "next";

import { DEFAULT_LIMIT } from "@/constants";
import UserView from "@/modules/users/ui/views/user-view";
import { HydrateClient, trpc, createCaller } from "@/trpc/server";

interface UserPageProps {
    params: Promise<{
        userId: string;
    }>;
}

export async function generateMetadata({
    params,
}: UserPageProps): Promise<Metadata> {
    const { userId } = await params;

    try {
        const caller = await createCaller();
        const user = await caller.users.getOne({ id: userId });

        const title = user.name ?? "사용자";
        const description = `${title} 의 채널`;
        const image = user.imageUrl ?? undefined;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                type: "profile",
                images: image ? [{ url: image }] : undefined,
            },
        };
    } catch {
        return { title: "사용자를 찾을 수 없습니다" };
    }
}

const UserPage = async ({ params }: UserPageProps) => {
    const { userId } = await params;

    void trpc.users.getOne.prefetch({ id: userId });
    void trpc.videos.getMany.prefetch({ userId, limit: DEFAULT_LIMIT });

    return (
        <HydrateClient>
            <UserView userId={userId} />
        </HydrateClient>
    );
};

export default UserPage;