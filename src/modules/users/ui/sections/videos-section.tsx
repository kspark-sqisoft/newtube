"use client";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { trpc } from "@/trpc/client";
import { DEFAULT_LIMIT } from "@/constants";
import { VideoGridCard, VideoGridCardSkeleton } from "@/modules/videos/ui/components/video_grid_card";
import { InfiniteScroll } from "@/components/infinite-scroll";

interface VideosSectionProps {
    userId?: string;
}

const VideosSection = (props: VideosSectionProps) => {
    return (
        <Suspense fallback={<VideosSectionSkeleton />}>
            <ErrorBoundary fallback={<p>Error</p>}>
                <VideosSectionSuspense {...props} />
            </ErrorBoundary>
        </Suspense>
    );
};

export default VideosSection;

const VideosSectionSkeleton = () => {
    return <div className="gap-4 gap-y-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
        {
            Array.from({ length: 18 }).map((_, index) => (
                <VideoGridCardSkeleton key={index} />
            ))
        }
    </div>;
};

const VideosSectionSuspense = ({ userId }: VideosSectionProps) => {
    const [videos, query] = trpc.videos.getMany.useSuspenseInfiniteQuery({
        userId,
        limit: DEFAULT_LIMIT,
    }, {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
    return <div>
        <div className="gap-4 gap-y-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
            {
                videos.pages.flatMap((page) => page.items).map((video) => (
                    <VideoGridCard key={video.id} data={video} />
                ))
            }
        </div>
        <InfiniteScroll hasNextPage={query.hasNextPage}
            isFetchingNextPage={query.isFetchingNextPage}
            fetchNextPage={query.fetchNextPage} />

    </div>;
};
