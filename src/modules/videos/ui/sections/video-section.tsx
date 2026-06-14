"use client";

import { trpc } from "@/trpc/client";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {cn} from "@/lib/utils";
import VideoPlayer, { VideoPlayerSkeleton } from "../components/video-player";
import { VideoBanner } from "../components/video-banner";
import { VideoTopRow, VideoTopRowSkeleton } from "../components/video-top-row";
import { useAuth } from "@clerk/nextjs";
import { SectionError } from "@/components/section-error";

interface VideoSectionProps {
  videoId: string;
}

const VideoSection = ({ videoId }: VideoSectionProps) => {
    return (
        <Suspense fallback={<VideoSectionSkeleton />}>
            <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => (
                <SectionError message="영상을 불러오지 못했어요." onRetry={resetErrorBoundary} />
            )}>
                <VideoSectionSuspense videoId={videoId} />
            </ErrorBoundary>
        </Suspense>
    );
};

const VideoSectionSkeleton = () => {
    return (
        <>
            <VideoPlayerSkeleton />
            <VideoTopRowSkeleton />
        </>
    );
}

const VideoSectionSuspense = ({ videoId }: VideoSectionProps) =>{
    const {isSignedIn} = useAuth();

    const utils = trpc.useUtils();
    const [video] = trpc.videos.getOne.useSuspenseQuery({ id: videoId });

    const createView = trpc.videoViews.create.useMutation({
        onSuccess: () => {
            utils.videos.getOne.invalidate({ id: videoId });
        },
    });

    const handlePlay = () => {
        if(!isSignedIn) return;
        createView.mutate({ videoId });
    }
    return (
        <>
            <div className={
                cn("aspect-video bg-black rounded-xl overflow-hidden relative",
                    video.muxStatus !== "ready" && "rounded-b-none"
                )
            }>
                <VideoPlayer 
                    autoPlay
                    onPlay={handlePlay}
                    playbackId={video.muxPlaybackId}
                    thumbnailUrl={video.thumbnailUrl}
                />
            </div>
            <VideoBanner status={video.muxStatus} />
            <VideoTopRow video={video} />
        </>
    );
}

export default VideoSection;