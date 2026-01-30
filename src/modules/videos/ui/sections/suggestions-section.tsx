"use client";

import { DEFAULT_LIMIT } from "@/constants";
import { trpc } from "@/trpc/client";
import { VideoRowCard } from "../components/video-row-card";
import { VideoGridCard } from "../components/video_grid_card";
import { InfiniteScroll } from "@/components/infinite-scroll";

interface SuggestionsSectionProps {
    videoId: string;
    isManual?: boolean;
}

const SuggestionsSection = ({ videoId, isManual }: SuggestionsSectionProps) => {
    const [suggestions, query] = trpc.suggestions.getMany.useSuspenseInfiniteQuery({
        videoId,
        limit: DEFAULT_LIMIT,
    }, {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
    });
    return (
        <>
            <div className="hidden md:block space-y-3">
                {suggestions.pages.flatMap((page) => page.items.map((video) => (
                    <VideoRowCard key={video.id} data={video} onRemove={() => { }} size="compact" />
                )))}
            </div>
            <div className="block md:hidden space-y-10">
                {suggestions.pages.flatMap((page) => page.items.map((video) => (
                    <VideoGridCard key={video.id} data={video} onRemove={() => { }} />
                )))}
            </div>
            <InfiniteScroll isManual={isManual} hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
        </>
    );
};

export default SuggestionsSection;