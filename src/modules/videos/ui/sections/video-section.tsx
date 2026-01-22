"use client";

import { trpc } from "@/trpc/client";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface VideoSectionProps {
  videoId: string;
}

const VideoSection = ({ videoId }: VideoSectionProps) => {
    return (
        <Suspense fallback={<p>Loading...</p>}>
            <ErrorBoundary fallback={<div>Error...</div>}>
                <VideoSectionSuspense videoId={videoId} />
            </ErrorBoundary>
        </Suspense>
    );

};

const VideoSectionSuspense = ({ videoId }: VideoSectionProps) =>{
    const [video] = trpc.videos.getOne.useSuspenseQuery({ id: videoId });
    return (
        <div>
            {JSON.stringify(video)}
        </div>
    );
}

export default VideoSection;