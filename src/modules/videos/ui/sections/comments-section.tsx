"use client";

import CommentForm from "@/modules/comments/ui/components/comment-form";
import { CommentItem } from "@/modules/comments/ui/components/comment-item";
import { trpc } from "@/trpc/client";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface CommentsSectionProps {
    videoId: string;
}

const CommentsSection = ({ videoId }: CommentsSectionProps) => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ErrorBoundary fallback={<div>Error...</div>}>
                <CommentsSectionSuspense videoId={videoId} />
            </ErrorBoundary>
        </Suspense>
    );
};

const CommentsSectionSuspense = ({ videoId }: CommentsSectionProps) => {
    const [comments] = trpc.comments.getMany.useSuspenseQuery({ videoId });
    return (
        <div className="mt-6">
            <div className="flex flex-col gap-6">
                <h1>
                    0 Comments
                </h1>
                <CommentForm videoId={videoId} onSuccess={() => {}} />
            </div>
            <div className="flex flex-col gap-4 mt-2">
                {
                    comments.map((comment)=>(
                        <CommentItem key={comment.id} comment={comment} />
                    ))
                }
            </div>
        </div>
    );
};

export default CommentsSection;