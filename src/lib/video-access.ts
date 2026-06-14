type VideoVisibility = "public" | "private";

/** public 영상이거나, 로그인 사용자가 업로더인 경우 접근 허용 */
export function canAccessVideo(params: {
  visibility: VideoVisibility;
  ownerId: string;
  viewerId?: string | null;
}) {
  if (params.visibility === "public") return true;
  return params.viewerId === params.ownerId;
}
