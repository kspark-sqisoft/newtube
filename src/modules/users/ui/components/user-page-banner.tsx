import { cn } from "@/lib/utils";
import { UserGetOneOutput } from "../../types";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Edit2Icon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { BannerUploadModal } from "./banner-upload-modal";

interface UserPageBannerProps {
    user: UserGetOneOutput;
}

export const UserPageBannerSkeleton = () => {
    return (
        <Skeleton className="w-full max-h-[200px] h-[15vh] md:h-[25vh]" />
    );
}

const UserPageBanner = ({ user }: UserPageBannerProps) => {
    const { userId } = useAuth();
    const [isBannerUploadModalOpen, setIsBannerUploadModalOpen] = useState(false);
    return (
        <div className="relative group">
            <BannerUploadModal userId={user.id} open={isBannerUploadModalOpen} onOpenChange={setIsBannerUploadModalOpen} />
            <div className={cn(
                "w-full max-h-[200px] h-[15vh] md:h-[25vh] bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl"
            )}
                style={{
                    backgroundImage: user.bannerUrl ? `url(${user.bannerUrl})` : undefined,
                    backgroundSize: "cover",
                }}
            >
                {
                    user.clerkId === userId && (
                        <Button
                            onClick={() => setIsBannerUploadModalOpen(true)}
                            type="button"
                            size="icon"
                            className="absolute top-4 right-4 rounded-full bg-black/50 hover:bg-black/50
                            opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300
                            "
                        >
                            <Edit2Icon className="size-4 text-white" />
                        </Button>
                    )
                }

            </div>
        </div>
    );
}

export default UserPageBanner;