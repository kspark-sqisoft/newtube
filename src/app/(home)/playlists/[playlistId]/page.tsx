import type { Metadata } from "next";

import { DEFAULT_LIMIT } from "@/constants";
import { VideosView } from "@/modules/playlists/ui/views/videos-view";
import { HydrateClient, trpc, createCaller } from "@/trpc/server";

export const dynamic = "force-dynamic";

interface PlaylistDetailPageProps {
    params: Promise<{ playlistId: string }>;
}

export async function generateMetadata({
    params,
}: PlaylistDetailPageProps): Promise<Metadata> {
    const { playlistId } = await params;

    try {
        const caller = await createCaller();
        const playlist = await caller.playlists.getOne({ id: playlistId });

        const title = playlist.name ?? "재생목록";
        const description = playlist.description ?? `${title} 재생목록`;

        return {
            title,
            description,
            openGraph: { title, description },
        };
    } catch {
        return { title: "재생목록을 찾을 수 없습니다" };
    }
}

const PlaylistDetailPage = async ({ params }: PlaylistDetailPageProps) => {
    const { playlistId } = await params;
    void trpc.playlists.getOne.prefetch({ id: playlistId });
    void trpc.playlists.getVideos.prefetchInfinite({ playlistId, limit: DEFAULT_LIMIT });
    return (
        <HydrateClient>
            <VideosView playlistId={playlistId} />
        </HydrateClient>
    );
};

export default PlaylistDetailPage;