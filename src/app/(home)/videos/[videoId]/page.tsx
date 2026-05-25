import type { Metadata } from "next";

import { DEFAULT_LIMIT } from "@/constants";
import VideoView from "@/modules/videos/ui/views/video-view";
import { HydrateClient, trpc } from "@/trpc/server";
import { createCaller } from "@/trpc/server";
export const dynamic = "force-dynamic";

interface VideoPageProps {
  params: Promise<{
    videoId: string;
  }>;
}

export async function generateMetadata({
  params,
}: VideoPageProps): Promise<Metadata> {
  const { videoId } = await params;

  try {
    const caller = await createCaller();
    const video = await caller.videos.getOne({ id: videoId });

    const title = video.title ?? "동영상";
    const description = video.description ?? "newtube 에서 영상을 시청하세요.";
    const thumbnail = video.thumbnailUrl ?? undefined;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "video.other",
        images: thumbnail ? [{ url: thumbnail }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: thumbnail ? [thumbnail] : undefined,
      },
    };
  } catch {
    return {
      title: "동영상을 찾을 수 없습니다",
    };
  }
}

const VideoPage = async ({ params }: VideoPageProps) => {
  const { videoId } = await params;
  void trpc.videos.getOne.prefetch({ id: videoId });
  void trpc.comments.getMany.prefetchInfinite({ videoId, limit: DEFAULT_LIMIT });
  void trpc.suggestions.getMany.prefetchInfinite({ videoId, limit: DEFAULT_LIMIT });


  return (
    <HydrateClient>
      <VideoView videoId={videoId} />
    </HydrateClient>
  );
};

export default VideoPage;